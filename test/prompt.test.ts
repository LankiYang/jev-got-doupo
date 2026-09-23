import { describe, expect, it } from "vitest";
import * as Prompt from "@/core/Prompt";
import * as Story from "@/core/Story";
import { decision, playedTurn, sessionId } from "./helpers";

const seed = Story.seed(sessionId, new Date("2026-01-01T00:00:00.000Z"));
const action = "I climb the winch cage and look north";

const systemOf = (messages: ReadonlyArray<{ role: string; content: string }>): string =>
  messages.find((message) => message.role === "system")?.content ?? "";

const userOf = (messages: ReadonlyArray<{ role: string; content: string }>): string =>
  messages.find((message) => message.role === "user")?.content ?? "";

describe("Prompt.build", () => {
  it("keeps the player's action out of the rules", () => {
    const messages = Prompt.build(seed, action, { isFinalTurn: false });
    expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(userOf(messages)).toBe(`<action>${action}</action>`);
    expect(systemOf(messages)).not.toContain(action);
  });

  it("carries the current place's lore", () => {
    const system = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    expect(system).toContain("萧家大宅");
    expect(system).toContain("测气石柱");
    expect(system).toContain("这是故事的开场场景。");
  });

  it("asks to close the whole story only on the final turn", () => {
    const ordinary = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    const closing = systemOf(Prompt.build(seed, action, { isFinalTurn: true }));
    expect(ordinary).not.toContain("把它收束起来");
    expect(ordinary).toContain("写下下一个场景。");
    expect(closing).toContain("把它收束起来");
  });

  it("carries the current chapter's title, goal and arc stage", () => {
    const system = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    expect(system).toContain("废柴");
    expect(system).toContain("撑过又一次当众落魄的测验，直面纳兰嫣然登门退婚，咬牙立下三年之约");
    expect(system).toContain("眼下正是「起」");
  });

  it("follows the chapter's arc stage as it advances", () => {
    const advanced = { ...seed, arcStageReached: "turn" as const };
    const system = systemOf(Prompt.build(advanced, action, { isFinalTurn: false }));
    expect(system).toContain("眼下正是「转」");
  });

  it("still builds a prompt for a story saved before chapters existed", () => {
    const preChapterStory = { ...seed, chapter: undefined, arcStageReached: undefined } as unknown as Parameters<
      typeof Prompt.build
    >[0];
    const system = systemOf(Prompt.build(preChapterStory, action, { isFinalTurn: false }));
    expect(system).toContain("废柴");
    expect(system).toContain("眼下正是「起」");
  });

  it("ties the suggested actions to the chapter goal, not just variety", () => {
    const system = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    expect(system).toContain("朝「撑过又一次当众落魄的测验，直面纳兰嫣然登门退婚，咬牙立下三年之约。」这件事迈出的真实下一步");
    expect(system).toContain("不要给不改变处境的动作，比如观察、打量、发呆、继续做手头的事");
  });

  it("keeps suggested actions grounded in the scene and honest about each relationship", () => {
    const system = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    expect(system).toContain("不要凭空编出正文里没有的角色、地点或事实");
    expect(system).toContain("药老是恩师，态度是求教、商议、依靠——不是质问或防备。");
    expect(system).toContain("云山是明确的敌人，态度是正面对峙、拆穿手段。");
  });

  it("changes what advancing the chapter means as the arc stage moves", () => {
    const turning = { ...seed, arcStageReached: "turn" as const };
    const system = systemOf(Prompt.build(turning, action, { isFinalTurn: false }));
    expect(system).toContain("逼近那个摊牌的抉择本身");
  });

  it("asks for no suggested actions on the closing turn", () => {
    const system = systemOf(Prompt.build(seed, action, { isFinalTurn: true }));
    expect(system).not.toContain(Prompt.optionsMarker);
  });

  it("has the scene arrive however far the place is", () => {
    const system = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    expect(system).toContain("绝不要因为地方遥远而拒绝一段旅程");
    expect(system).toContain("无论目的地多远，场景都会抵达");
    expect(system).toContain("以萧炎抵达他所要去的地方收尾");
  });

  it("carries last turn's beat, mood and danger forward", () => {
    const played = playedTurn({
      decision: decision({ beat: "battle", mood: "battle", danger: "deadly" }),
    });
    const system = systemOf(
      Prompt.build({ ...seed, turns: [played] }, action, { isFinalTurn: false }),
    );
    expect(system).toContain("正面会战");
    expect(system).toContain("它的情绪是「battle」");
    expect(system).toContain("萧炎的危险程度是 deadly");
  });

  it("reads the seed's five gauges into prose, never as raw numbers", () => {
    const system = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    expect(system).toContain("萧炎眼下的状态：");
    expect(system).toContain("他一向讲信用、肯担责，是非分得清楚。");
    expect(system).toContain("他心里绷着一点，还没到坐不住的程度。");
    expect(system).toContain("眼下没有什么真正的威胁悬在他头上。");
    expect(system).toContain("手头不算宽裕（约 20 枚金币），花销要精打细算");
    expect(system).not.toContain("morality");
    expect(system).not.toContain(": 65");
  });

  it("omits the relationship line until a companion has actually appeared", () => {
    const system = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    expect(system).not.toContain("的关系：");
  });

  it("surfaces the last companion who had a real presence, not a stale one", () => {
    const played = playedTurn({ decision: decision({ companion: "yao-lao" }) });
    const system = systemOf(
      Prompt.build({ ...seed, turns: [played] }, action, { isFinalTurn: false }),
    );
    expect(system).toContain("与药老的关系：对他抱着不小的信任和好感");
  });

  it("adds the stricter reminder only on the regeneration", () => {
    const first = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    const second = systemOf(
      Prompt.build(seed, action, { isFinalTurn: false, strictReminder: true }),
    );
    expect(first).not.toContain("脱离了虚构世界");
    expect(second).toContain("脱离了虚构世界");
  });
});
