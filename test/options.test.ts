import { Effect, Stream } from "effect";
import { describe, expect, it } from "vitest";
import * as Prompt from "@/core/Prompt";
import { parseOptions, soundOptions, withoutOptionsMarker } from "@/core/StoryEngine";

describe("StoryEngine.parseOptions", () => {
  it("splits a well-formed block into three trimmed actions", () => {
    expect(parseOptions("质问哈尔丁\n退开观察\n收剑离开")).toEqual([
      "质问哈尔丁",
      "退开观察",
      "收剑离开",
    ]);
  });

  it("strips stray numbering or bullets the model added anyway", () => {
    expect(parseOptions("1. 质问哈尔丁\n2、退开观察\n- 收剑离开")).toEqual([
      "质问哈尔丁",
      "退开观察",
      "收剑离开",
    ]);
  });

  it("drops blank lines and caps at three", () => {
    expect(parseOptions("\n质问哈尔丁\n\n退开观察\n收剑离开\n多出来的一条\n")).toEqual([
      "质问哈尔丁",
      "退开观察",
      "收剑离开",
    ]);
  });

  it("reads an empty block as no suggestions", () => {
    expect(parseOptions("")).toEqual([]);
    expect(parseOptions("   \n  ")).toEqual([]);
  });
});

describe("StoryEngine.soundOptions", () => {
  const drafted = ["质问云棱", "向药老请教", "先按下这件事"];

  it("keeps the drafted options once Jev reads them as grounded and in character", () => {
    expect(soundOptions(drafted, 0.9)).toEqual(drafted);
  });

  it("drops them rather than showing something ungrounded or out of character", () => {
    expect(soundOptions(drafted, 0.1)).toEqual([]);
  });

  it("treats an exact half as a pass, matching the same threshold inFiction uses", () => {
    expect(soundOptions(drafted, 0.5)).toEqual(drafted);
  });

  it("has nothing to drop when the narrator never drafted any", () => {
    expect(soundOptions([], 0.1)).toEqual([]);
  });
});

const collect = (chunks: ReadonlyArray<string>): Promise<string> =>
  Effect.runPromise(
    Stream.fromIterable(chunks).pipe(
      withoutOptionsMarker,
      Stream.runFold("", (acc, piece) => acc + piece),
    ),
  );

describe("StoryEngine.withoutOptionsMarker", () => {
  it("passes prose through untouched when the marker never appears", async () => {
    const text = await collect(["你走进", "萧家大宅的", "正厅。"]);
    expect(text).toBe("你走进萧家大宅的正厅。");
  });

  it("drops the marker and everything after it, marker whole in one chunk", async () => {
    const text = await collect(["你走进大厅。", `\n${Prompt.optionsMarker}\n质问哈尔丁\n退开观察`]);
    expect(text).toBe("你走进大厅。\n");
  });

  it("still catches the marker when it is split across chunk boundaries", async () => {
    const marker = Prompt.optionsMarker;
    const splitPoint = Math.floor(marker.length / 2);
    const chunks = [
      "你走进大厅。\n",
      marker.slice(0, splitPoint),
      marker.slice(splitPoint),
      "\n质问哈尔丁\n退开观察",
    ];
    const text = await collect(chunks);
    expect(text).toBe("你走进大厅。\n");
  });

  it("never lets the suggestion lines themselves reach the reader", async () => {
    const text = await collect(["场景。", `${Prompt.optionsMarker}\n1. 质问哈尔丁\n2. 退开观察`]);
    expect(text).not.toContain("质问哈尔丁");
    expect(text).not.toContain(Prompt.optionsMarker);
  });
});
