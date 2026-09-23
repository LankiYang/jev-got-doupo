import type { SystemOneResult } from "@typesafe-ai/sdk";
import { Effect } from "effect";
import * as ArcStage from "@/core/ArcStage";
import * as Beat from "@/core/Beat";
import * as Chapter from "@/core/Chapter";
import * as Companion from "@/core/Companion";
import * as Danger from "@/core/Danger";
import * as Location from "@/core/Location";
import * as Meter from "@/core/Meter";
import * as Mood from "@/core/Mood";
import * as Position from "@/core/Position";
import { choice, noul, score } from "@/core/Question";
import { QuestionModel } from "@/core/QuestionModel";
import * as Story from "@/core/Story";

/**
 * A `location` option as Jev sees it. Every option in a question shares a shape, so the
 * model compares like with like instead of reading seventy differently written blurbs.
 */
type LocationOption = {
  region: string;
  summary: string;
  also_called: string[];
};

type BeatOption = {
  definition: string;
  example: string;
};

type MoodOption = {
  feel: string;
  examples: string[];
};

type Scene = {
  readonly action: string;
  readonly narration: string;
};

/**
 * The current scene alone also carries the narrator's own suggested next actions, so
 * `optionsSound` can judge them without a second request. Past turns never kept this
 * text — the store persists the decision they resolved to, not the raw suggestion
 * lines — so `story.recent` stays plain `Scene`.
 */
type CurrentScene = Scene & { readonly options: string };

/** Where the story stood before this scene, in words rather than ids. */
type PreviousPosition = {
  readonly location: string;
  readonly region: string;
};

/**
 * The single state every question is asked about. Questions point into it by backticked
 * path (`scene.narration`, `story.previous_position`), so one request answers all five.
 */
export type OracleState = {
  readonly story: {
    /** The current chapter's one-line goal, so `arcStage` has something to measure against. */
    readonly chapter_goal: string;
    readonly previous_position: PreviousPosition;
    readonly recent: Array<Scene>;
  };
  readonly scene: CurrentScene;
};

/** `Object.fromEntries` widens the keys, so the cast is what keeps the catalog ids literal. */
const criteriaOf = <K extends string, A>(entries: ReadonlyArray<readonly [K, A]>): Record<K, A> =>
  Object.fromEntries(entries) as Record<K, A>;

const describeLocation = (location: Location.Location): LocationOption => ({
  region: location.region,
  summary: location.summary,
  also_called: [...location.also_called],
});

const locationCriteria: Record<Location.LocationId, LocationOption> = criteriaOf(
  Location.all.map((location) => [location.id, describeLocation(location)] as const),
);

const beatCriteria: Record<Beat.BeatId, BeatOption> = criteriaOf(
  Beat.all.map(
    (beat) => [beat.id, { definition: beat.definition, example: beat.example }] as const,
  ),
);

const moodCriteria: Record<Mood.MoodId, MoodOption> = criteriaOf(
  Mood.all.map(
    (mood) => [mood.id, { feel: mood.feel, examples: [...mood.examples] }] as const,
  ),
);

/**
 * `none` first, then the catalog: the honest majority answer for a scene built around
 * someone Jev has no label for, ahead of the recurring faces it does.
 */
const companionCriteria: Record<Companion.CompanionId, string> = {
  none: "没有任何熟悉的面孔在场，只有无名的人物，或者萧炎独自一人。",
  ...Object.fromEntries(Companion.all.map((companion) => [companion.id, companion.description])),
} as Record<Companion.CompanionId, string>;

/**
 * Declared as a constant so the `criteria` stay literal: the SDK's `const` generic
 * carries those keys into `SystemOneResult<typeof questions>`, which types
 * `answers.mood.choice` as a union of catalog ids rather than `string`.
 *
 * The keys name the answers, not the questions. Jev is never shown `location` or
 * `beat`, so every `instructions` string has to be self-contained.
 */
export const questions = {
  location: choice(
    "在 `scene.narration` 的结尾，萧炎在哪里？说出这个场景把他留在了哪个地方。" +
      "当文字没有让他移动时，以 `story.previous_position` 作为参照：一个只发生交谈、战斗或沉思的场景，" +
      "会把他留在原地。务必给出一个真实的地点——如果场景在两地之间结束，就给出他离得最近的那个，" +
      "或者他正要前往的那个。",
    locationCriteria,
  ),
  beat: choice(
    "`scene.narration` 是一场什么类型的场景？请从整体判断，看它大部分篇幅在做什么，" +
      "而不是看其中某一句话。",
    beatCriteria,
  ),
  mood: choice(
    "`scene.narration` 应该配什么样的背景音乐？选择听众应该贯穿整场场景的那种情绪，" +
      "而不是它最激烈那一刻的情绪。",
    moodCriteria,
  ),
  danger: score(
    "在 `scene.narration` 的结尾，萧炎面临多大的身体危险？判断他的身体，而不是他的名声或良心；" +
      "判断场景把他留在什么处境，而不是它开始时如何。",
    Danger.criteria,
  ),
  inFiction: noul(
    "`scene.narration` 是否保持在虚构世界之内？它必须始终以第二人称对萧炎说话，" +
      "留在斗气大陆的世界里，绝不打破第四面墙。",
    {
      true: "这段文字是设定在世界之内的第二人称叙述，没有对读者旁白，也没有提到 AI、助手、模型、玩家、规则、提示词或指令",
      false:
        "这段文字脱离第二人称、直接对读者说话、拒绝或评论该请求，或者提到 AI、模型、规则或提示词",
    },
  ),
  arcStage: score(
    "`scene.narration` 相对 `story.chapter_goal` 这条本章线索、以及 `story.recent` 里已经发生的事，" +
      "处在「起承转合」结构的哪一个阶段？判断要参照本章的目标和前情，而不是只看这一幕本身热闹不热闹。",
    ArcStage.criteria,
  ),
  companion: choice(
    "除了萧炎本人（以及常留在戒指中、随时可能现身或说话的药老——药老单独算一个选项）之外，`scene.narration` 里出场并有" +
      "实际存在感的最主要角色是谁？如果没有任何这样的角色，选 none。路人、无名黑衣兄弟、" +
      "被提到但没有实际出场的人都不算。",
    companionCriteria,
  ),
  optionsSound: noul(
    "`scene.options`（如果给出的话）是不是三条站得住脚的行动：每一条只涉及 `scene.narration` 里真的写出来的人物和处境，" +
      "语气要贴合萧炎和对方的实际关系（比如对师父是求教而不是质问，对明确的敌人才谈得上正面对峙），并且真的是朝 " +
      "`story.chapter_goal` 迈出的一步，而不是原地不动的场景装饰。如果 `scene.options` 是空的（比如收尾场景本就不" +
      "给选项），直接判为通过。",
    {
      true: "三条都紧贴 `scene.narration` 写出来的内容，语气对得上人物关系，也都在推进 `story.chapter_goal`；" +
        "或者这个场景本就没有给出选项",
      false: "至少一条凭空编了 `scene.narration` 里没有的人物或处境，某个角色的语气明显用反了，或者只是场景" +
        "装饰、没有真的推进 `story.chapter_goal`",
    },
  ),
  affectionDirection: noul(
    "`scene.narration` 里，如果有一位熟面孔真正在场并有实际存在感（参考 `companion` 问题判断的那位；" +
      "药老单独算一位），这一幕结束时萧炎和对方之间的好感是在上升还是在下降？没有这样的角色在场时随便回答，" +
      "这次判断会被丢弃。",
    {
      true: "更亲近、更信任，或裂痕在弥合——哪怕幅度很小",
      false: "更疏远、更提防，或信任在流失——哪怕幅度很小",
    },
  ),
  affectionMagnitude: score(
    "`scene.narration` 里，萧炎和在场那位熟面孔之间的好感发生了多大变化？没有这样的角色在场时判 0。",
    Meter.magnitudeCriteria,
  ),
  sceneDangerDirection: noul(
    "`scene.narration` 结束时，萧炎当下所处场景的危险程度，相比这一幕开始之前，是在上升还是在下降？",
    {
      true: "威胁更近、处境更紧迫，哪怕还没有真正爆发",
      false: "威胁在远离、处境在放松，哪怕还没有完全解除",
    },
  ),
  sceneDangerMagnitude: score(
    "`scene.narration` 里，萧炎所处场景的危险程度发生了多大变化？",
    Meter.magnitudeCriteria,
  ),
  tensionDirection: noul(
    "`scene.narration` 结束时，萧炎自己内心的紧绷程度，相比这一幕开始之前，是在上升还是在下降？" +
      "判断他的心理状态，而不是场景本身的物理危险——两者经常不同步。",
    {
      true: "更焦虑、更提防、更不安，哪怕表面还算镇定",
      false: "更松弛、更笃定、更安心，哪怕处境还没有真正解决",
    },
  ),
  tensionMagnitude: score(
    "`scene.narration` 里，萧炎自己内心的紧绷程度发生了多大变化？",
    Meter.magnitudeCriteria,
  ),
  moralityDirection: noul(
    "`scene.narration` 里萧炎自己的所作所为，是让他的道德操守上升还是下降？只判断他主动做出的事，" +
      "不要因为别人对他做了坏事、或者他只是身处一个肮脏的处境而扣分。没有任何可判断的行为时随便回答，" +
      "这次判断会被丢弃。",
    {
      true: "他做的事是正派、守信、体恤弱者的——救人、公平交易、信守承诺、放过可以伤害的对象",
      false: "他做的事是自私、失信、伤害无辜或巧取豪夺的——抢劫、偷盗、背弃承诺、殃及不该殃及的人",
    },
  ),
  moralityMagnitude: score(
    "`scene.narration` 里，萧炎自己的道德操守发生了多大变化？没有可判断的行为时判 0。",
    Meter.magnitudeCriteria,
  ),
  goldDirection: noul(
    "`scene.narration` 结束时，萧炎手头的财富相比这一幕开始前，是在增加还是在减少？只判断正文里真正发生的" +
      "财物往来，没有任何财物变化时随便回答，这次判断会被丢弃。",
    {
      true: "增加了——他卖出了东西、拿到了报酬、战利品或馈赠",
      false: "减少了——他买了东西、被劫掠或讹诈、破财免灾、挥霍或赔付了什么",
    },
  ),
  goldAmount: choice(
    "`scene.narration` 里，萧炎实际到手或付出的金币数目最接近下面哪一档？务必只根据正文真的写出来的" +
      "数目和量级判断——正文写「五十枚金币」就选 50，写「一袋金币」这类没有具体数目的说法时，" +
      "按上下文里它大概的分量估一个最接近的档。正文完全没有金钱往来、也没有提到任何数目时选「没有金钱往来」。",
    Meter.goldLadderCriteria,
  ),
};

export type Answers = SystemOneResult<typeof questions>["answers"];

const previousPosition = (position: Position.Position): PreviousPosition => ({
  location: Location.nameOf(position.location),
  region: Location.byId[position.location].region,
});

/** How many earlier turns Jev is shown for continuity. */
export const recentTurnCount = 3;

export const stateFor = (
  state: Story.StoryState,
  action: string,
  narration: string,
  options: ReadonlyArray<string>,
): OracleState => ({
  story: {
    // `Chapter.resolve`: a story saved before this build's chapter catalog existed
    // carries none, and a turn should still be judged rather than fail outright.
    chapter_goal: Chapter.goalOf(Chapter.resolve(state.chapter)),
    previous_position: previousPosition(state.position),
    recent: Story.recentTurns(state, recentTurnCount).map((turn) => ({
      action: turn.action,
      narration: turn.narration,
    })),
  },
  scene: { action, narration, options: options.join("\n") },
});

/**
 * What one labelling request produced. The raw `answers` keep Jev's own confidence
 * and distributions; the timing and token count are kept beside them so the reading
 * panel can show what the judgement cost as well as what it said.
 */
export interface Judgement {
  readonly answers: Answers;
  readonly latencyMs: number;
  readonly inputTokens: number;
}

/** Label one scene: one Jev request answering all five questions. */
export const judge = Effect.fn("Oracle.judge")(function* (state: OracleState) {
  const model = yield* QuestionModel;
  const startedAt = Date.now();
  const result = yield* model.evaluate(state, questions);
  const latencyMs = Date.now() - startedAt;
  yield* Effect.annotateCurrentSpan("jev.input_tokens", result.usage.input_tokens);
  yield* Effect.annotateCurrentSpan("jev.latency_ms", latencyMs);
  return {
    answers: result.answers,
    latencyMs,
    inputTokens: result.usage.input_tokens,
  } satisfies Judgement;
});
