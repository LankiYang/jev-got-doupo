/**
 * Wire types and fetch helpers for the story API. Nothing here imports the server
 * core, so the label lists below are copies rather than the catalogs themselves,
 * which keeps the lore and the grading criteria out of the bundle.
 * `test/wire.test.ts` holds the copies and the catalogs in step.
 */
import { assetUrl } from "@/cdn";

export const MOODS = [
  "martial", "battle", "tense", "scheming", "ominous", "mystical", "sorrowful",
  "romantic", "calm", "relaxed", "bustling", "curious", "triumphant",
] as const;

export type MoodId = (typeof MOODS)[number];

export const trackFor = (mood: MoodId): string => assetUrl(`/music/${mood}.mp3`);

/**
 * The backdrop of last resort, for a plate the server resolved but the browser
 * could not load. `Background.pathOf(defaultBackground)` is the same path
 * server-side; `test/wire.test.ts` holds the two together.
 */
export const defaultBackdrop = assetUrl("/scenes/default.webp");

export const BEATS = [
  "battle", "duel", "intrigue", "feast", "wedding", "trial", "journey",
  "oath", "siege", "parley", "vision", "stealth", "supernatural", "quiet",
] as const;

export type BeatId = (typeof BEATS)[number];

export const DANGERS = ["safe", "uneasy", "dangerous", "perilous", "deadly"] as const;

export type DangerId = (typeof DANGERS)[number];

export const ARC_STAGES = ["setup", "development", "turn", "resolution"] as const;

export type ArcStageId = (typeof ARC_STAGES)[number];

/** The recurring cast Jev is asked to notice; `none` stands for everyone else. */
export const COMPANIONS = [
  "yao-lao", "xiao-zhan", "xiao-xun-er", "nalan-yanran", "xiao-yixian",
  "yun-yun", "medusa-queen", "yun-shan", "yun-ling",
] as const;

export type CompanionId = (typeof COMPANIONS)[number] | "none";

export type LocationRef = {
  readonly id: string;
  readonly name: string;
  readonly region: string;
};

/** `background` arrives already resolved to a public path by the server. */
export type Position = {
  readonly location: LocationRef;
  readonly background: string;
};

/**
 * Jev's full answer for one scene. Mirrors `@/core/JevReading` on the wire; the
 * catalogs stay server-side, so the ids here are plain strings.
 */
export type LabelledChoice = {
  readonly choice: string;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
};

export type LabelledScore = {
  readonly score: number;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
};

export type LabelledNoul = {
  readonly noul: number;
};

export type JevReading = {
  readonly location: LabelledChoice;
  readonly beat: LabelledChoice;
  readonly mood: LabelledChoice;
  readonly danger: LabelledScore;
  readonly inFiction: LabelledNoul;
  readonly arcStage: LabelledScore;
  readonly companion: LabelledChoice;
  readonly latencyMs: number;
  readonly inputTokens: number;
};

/**
 * Where the story stands in its chapter arc. Title and goal arrive resolved from the
 * server, so the client never needs the chapter catalog itself — only the label ids
 * (`stage`) get mirrored client-side, the way mood/beat/danger already are.
 */
export type ChapterView = {
  readonly id: string;
  readonly title: string;
  readonly goal: string;
  readonly index: number;
  readonly total: number;
  readonly stage: ArcStageId;
};

/**
 * The three running gauges, current as of one message. `affection` is keyed by every
 * companion the catalog knows; `companion` names whoever had a real presence in this
 * particular scene, so the panel knows whose affection bar to show right now.
 */
export type Stats = {
  readonly sceneDanger: number;
  readonly tension: number;
  readonly morality: number;
  readonly gold: number;
  readonly affection: Readonly<Record<string, number>>;
  readonly companion: CompanionId;
};

export type StoryMessage = {
  readonly id: string;
  readonly role: "assistant" | "user";
  readonly text: string;
  readonly position?: Position;
  readonly mood?: MoodId;
  readonly beat?: BeatId;
  readonly danger?: DangerId;
  readonly reading?: JevReading;
  readonly options?: ReadonlyArray<string>;
  readonly stats?: Stats;
};

export type Story = {
  readonly sessionId: string;
  readonly position: Position;
  readonly mood: MoodId;
  readonly chapter: ChapterView;
  readonly turn: number;
  readonly turnsRemaining: number;
  readonly ended: boolean;
  readonly messages: readonly StoryMessage[];
};

export type TurnResult = {
  readonly position: Position;
  readonly mood: MoodId;
  readonly beat: BeatId;
  readonly danger: DangerId;
  readonly text: string;
  readonly reading: JevReading;
  readonly chapter: ChapterView;
  readonly turn: number;
  readonly turnsRemaining: number;
  readonly ended: boolean;
  readonly stats: Stats;
};

/** In-theme wording for every failure the composer can surface. */
export const FAILURES = {
  invalid_request: "That deed cannot be done. Try fewer words.",
  story_ended: "Your tale has already ended.",
  turn_conflict: "The tale moved on without you. Try again.",
  rate_limited: "The relay is overwhelmed. Wait a moment.",
  upstream_failed: "No word made it back. Try again.",
  budget_exhausted: "Today's ink is spent.",
  network: "No signal could be found. Try again.",
  unknown: "No word made it back. Try again.",
} as const;

export type FailureCode = keyof typeof FAILURES;

export type TurnOutcome =
  | { readonly kind: "ok"; readonly result: TurnResult }
  | { readonly kind: "error"; readonly code: FailureCode };

const isFailureCode = (value: string): value is FailureCode => value in FAILURES;

const failureOf = async (response: Response): Promise<FailureCode> => {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  const code = body?.error;
  if (!code) return "unknown";
  if (!isFailureCode(code)) return "unknown";
  return code;
};

export const fetchStory = async (sessionId: string, signal: AbortSignal): Promise<Story> => {
  const response = await fetch(`/api/story/${sessionId}`, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`story_unavailable_${response.status}`);
  return (await response.json()) as Story;
};

/**
 * Transport and status failures come back as an outcome so the adapter can branch
 * on them. An abort is rethrown instead, so the runtime treats it as a cancellation.
 */
export const postTurn = async (
  sessionId: string,
  body: { readonly action: string; readonly turn: number },
  signal: AbortSignal,
): Promise<TurnOutcome> => {
  try {
    const response = await fetch(`/api/story/${sessionId}/turn`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) return { kind: "error", code: await failureOf(response) };
    return { kind: "ok", result: (await response.json()) as TurnResult };
  } catch (cause) {
    if (signal.aborted) throw cause;
    return { kind: "error", code: "network" };
  }
};


/** Display names for the catalog ids, so the panel reads in Chinese. */
export const MOOD_NAMES: Record<MoodId, string> = {
  martial: "行军", battle: "战斗", tense: "紧绷", scheming: "权谋", ominous: "不祥",
  mystical: "玄秘", sorrowful: "哀伤", romantic: "柔情", calm: "静谧",
  relaxed: "闲适", bustling: "喧闹", curious: "好奇", triumphant: "凯旋",
};

export const BEAT_NAMES: Record<BeatId, string> = {
  battle: "正面会战", duel: "小规模厮杀", intrigue: "朝堂权谋", feast: "宴席",
  wedding: "婚礼", trial: "处决或审判", journey: "旅途", oath: "宣誓",
  siege: "围城", parley: "谈判", vision: "幻象", stealth: "潜行",
  supernatural: "超自然遭遇", quiet: "温情时刻",
};

export const DANGER_NAMES: Record<DangerId, string> = {
  safe: "安全", uneasy: "不安", dangerous: "危险", perilous: "凶险", deadly: "致命",
};

export const ARC_STAGE_NAMES: Record<ArcStageId, string> = {
  setup: "起", development: "承", turn: "转", resolution: "合",
};

export const COMPANION_NAMES: Record<CompanionId, string> = {
  none: "无",
  "yao-lao": "药老",
  "xiao-zhan": "萧战",
  "xiao-xun-er": "萧薰儿",
  "nalan-yanran": "纳兰嫣然",
  "xiao-yixian": "小医仙",
  "yun-yun": "云韵",
  "medusa-queen": "美杜莎女王",
  "yun-shan": "云山",
  "yun-ling": "云棱",
};

/** Fall back to the raw id for a label this build does not know. */
export const nameOfMood = (id: string): string => MOOD_NAMES[id as MoodId] ?? id;
export const nameOfBeat = (id: string): string => BEAT_NAMES[id as BeatId] ?? id;
export const nameOfDanger = (id: string): string => DANGER_NAMES[id as DangerId] ?? id;
export const nameOfArcStage = (id: string): string => ARC_STAGE_NAMES[id as ArcStageId] ?? id;
export const nameOfCompanion = (id: string): string =>
  COMPANION_NAMES[id as CompanionId] ?? id;


/** One event from the streamed turn endpoint. Mirrors `StoryEngine.TurnEvent`. */
export type TurnEvent =
  | { readonly _tag: "chunk"; readonly text: string }
  | { readonly _tag: "reading"; readonly reading: JevReading }
  | { readonly _tag: "options"; readonly options: ReadonlyArray<string> }
  | { readonly _tag: "saved"; readonly result: TurnResult }
  | { readonly _tag: "reset" }
  | { readonly _tag: "error"; readonly cause: string };

/** SSE frames are separated by a blank line; a frame's fields by a single newline. */
const BLANK_LINE = String.fromCharCode(10) + String.fromCharCode(10);
const NEWLINE = String.fromCharCode(10);

/**
 * Posts a turn and yields its events as they arrive.
 *
 * The response is server-sent events, so the prose lands incrementally rather than
 * after the whole scene — which is the difference between a reader watching nothing for
 * seven seconds and a reader watching the first sentence in two.
 *
 * A failure *before* the stream opens still arrives as a normal error response, and is
 * translated to the same `TurnOutcome` the non-streaming call used to return.
 */
export async function* streamTurn(
  sessionId: string,
  body: { readonly action: string; readonly turn: number },
  signal: AbortSignal,
): AsyncGenerator<TurnEvent, void, void> {
  const response = await fetch(`/api/story/${sessionId}/turn`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || response.body === null) {
    const code = await failureOf(response).catch(() => "unknown" as FailureCode);
    yield { _tag: "error", cause: code };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Events are separated by a blank line; anything after the last one is a partial
      // frame and stays buffered until its terminator arrives.
      let boundary = buffer.indexOf(BLANK_LINE);
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf(BLANK_LINE);

        const line = raw.split(NEWLINE).find((part) => part.startsWith("data:"));
        if (line === undefined) continue;
        try {
          yield JSON.parse(line.slice("data:".length).trim()) as TurnEvent;
        } catch {
          // A frame we cannot parse is dropped; the stream continues.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
