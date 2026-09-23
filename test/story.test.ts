import { Option } from "effect";
import { describe, expect, it } from "vitest";
import * as ArcStage from "@/core/ArcStage";
import * as Chapter from "@/core/Chapter";
import * as Story from "@/core/Story";
import { decision, playedTurn, sessionId } from "./helpers";

const openedAt = new Date("2026-01-01T00:00:00.000Z");
const seed = Story.seed(sessionId, openedAt);

describe("Story.seed", () => {
  it("opens on the first chapter, at 起, with nothing played yet", () => {
    expect(seed.chapter).toBe(Chapter.fallback);
    expect(seed.arcStageReached).toBe("setup");
    expect(seed.chapterStartedAtTurn).toBe(0);
  });

  it("seeds every gauge before anything is played", () => {
    expect(seed.sceneDanger).toBe(Story.initialSceneDanger);
    expect(seed.tension).toBe(Story.initialTension);
    expect(seed.morality).toBe(Story.initialMorality);
    expect(seed.gold).toBe(Story.initialGold);
    expect(seed.affection["yao-lao"]).toBeGreaterThan(seed.affection["yun-shan"]);
  });
});

describe("Story.appendTurn: the running gauges", () => {
  it("moves scene danger and tension by the turn's signed deltas", () => {
    const after = Story.appendTurn(
      seed,
      playedTurn({ decision: decision({ sceneDangerDelta: 15, tensionDelta: -8 }) }),
      15,
    );
    expect(after.sceneDanger).toBe(seed.sceneDanger + 15);
    expect(after.tension).toBe(seed.tension - 8);
  });

  it("moves only the companion who was actually in the scene", () => {
    const after = Story.appendTurn(
      seed,
      playedTurn({ decision: decision({ companion: "yao-lao", affectionDelta: 8 }) }),
      15,
    );
    expect(after.affection["yao-lao"]).toBe(seed.affection["yao-lao"] + 8);
    expect(after.affection["yun-shan"]).toBe(seed.affection["yun-shan"]);
  });

  it("leaves every affection untouched when no companion was in the scene", () => {
    const after = Story.appendTurn(
      seed,
      playedTurn({ decision: decision({ companion: "none", affectionDelta: 0 }) }),
      15,
    );
    expect(after.affection).toEqual(seed.affection);
  });

  it("clamps a gauge rather than letting it run past the scale", () => {
    const after = Story.appendTurn(
      { ...seed, sceneDanger: 95 },
      playedTurn({ decision: decision({ sceneDangerDelta: 25 }) }),
      15,
    );
    expect(after.sceneDanger).toBe(100);
  });

  it("moves morality down and gold up independently of the other gauges", () => {
    const after = Story.appendTurn(
      seed,
      playedTurn({ decision: decision({ moralityDelta: -15, goldDelta: 8 }) }),
      15,
    );
    expect(after.morality).toBe(seed.morality - 15);
    expect(after.gold).toBe(seed.gold + 8);
  });

  it("floors gold at zero rather than clamping it to the 1-100 gauge scale", () => {
    const after = Story.appendTurn(
      { ...seed, gold: 10 },
      playedTurn({ decision: decision({ goldDelta: -60 }) }),
      15,
    );
    expect(after.gold).toBe(0);
  });

  it("lets gold climb past 100, unlike the other gauges", () => {
    const after = Story.appendTurn(
      { ...seed, gold: 80 },
      playedTurn({ decision: decision({ goldDelta: 150 }) }),
      15,
    );
    expect(after.gold).toBe(230);
  });
});

describe("Story.appendTurn: chapter progression", () => {
  it("ratchets arcStageReached forward and never lets it slide back", () => {
    const turnedUp = Story.appendTurn(
      seed,
      playedTurn({ decision: decision({ arcStage: "turn" }) }),
      15,
    );
    expect(turnedUp.arcStageReached).toBe("turn");

    const backslid = Story.appendTurn(
      turnedUp,
      playedTurn({ decision: decision({ arcStage: "setup" }) }),
      15,
    );
    expect(backslid.arcStageReached).toBe("turn");
  });

  it("does not close a chapter on 合 before it has run the minimum number of turns", () => {
    let state = seed;
    for (let played = 0; played < Chapter.minTurns - 1; played += 1) {
      state = Story.appendTurn(
        state,
        playedTurn({ decision: decision({ arcStage: "resolution" }) }),
        15,
      );
    }
    expect(state.chapter).toBe(Chapter.fallback);
    expect(state.arcStageReached).toBe("resolution");
  });

  it("advances to the next chapter once 合 is reached and minTurns has run", () => {
    let state = seed;
    for (let played = 0; played < Chapter.minTurns - 1; played += 1) {
      state = Story.appendTurn(
        state,
        playedTurn({ decision: decision({ arcStage: "setup" }) }),
        15,
      );
    }
    expect(state.chapter).toBe(Chapter.fallback);

    state = Story.appendTurn(
      state,
      playedTurn({ decision: decision({ arcStage: "resolution" }) }),
      15,
    );

    const expected = Chapter.next(Chapter.fallback);
    expect(expected._tag).toBe("Some");
    if (expected._tag === "Some") expect(state.chapter).toBe(expected.value);
    expect(state.arcStageReached).toBe("setup");
    expect(state.chapterStartedAtTurn).toBe(Chapter.minTurns);
  });

  it("stays resolved on the last chapter instead of falling off the catalog", () => {
    const lastChapter = Chapter.all[Chapter.all.length - 1].id;
    let state: Story.StoryState = {
      ...seed,
      chapter: lastChapter,
      chapterStartedAtTurn: 0,
    };
    for (let played = 0; played < Chapter.minTurns; played += 1) {
      state = Story.appendTurn(
        state,
        playedTurn({ decision: decision({ arcStage: "resolution" }) }),
        15,
      );
    }
    expect(state.chapter).toBe(lastChapter);
    expect(state.arcStageReached).toBe("resolution");
  });
});

describe("Chapter.next", () => {
  it("walks every chapter in order and stops after the last", () => {
    const walked: string[] = [Chapter.all[0].id];
    let current: Option.Option<Chapter.ChapterId> = Option.some(Chapter.all[0].id);
    while (current._tag === "Some") {
      current = Chapter.next(current.value);
      if (current._tag === "Some") walked.push(current.value);
    }
    expect(walked).toEqual(Chapter.all.map((chapter) => chapter.id));
  });
});

describe("ArcStage.furthest", () => {
  it("keeps the stage further along the 起承转合 order", () => {
    expect(ArcStage.furthest("setup", "turn")).toBe("turn");
    expect(ArcStage.furthest("resolution", "development")).toBe("resolution");
    expect(ArcStage.furthest("turn", "turn")).toBe("turn");
  });
});

describe("Chapter.resolve and ArcStage.resolve", () => {
  it("fall back rather than throwing on an id neither catalog has", () => {
    expect(Chapter.resolve("a-chapter-this-build-dropped")).toBe(Chapter.fallback);
    expect(Chapter.resolve(undefined)).toBe(Chapter.fallback);
    expect(ArcStage.resolve("an-old-stage-name")).toBe(ArcStage.fallback);
    expect(ArcStage.resolve(undefined)).toBe(ArcStage.fallback);
  });

  it("pass a real id straight through", () => {
    expect(Chapter.resolve(Chapter.all[1].id)).toBe(Chapter.all[1].id);
    expect(ArcStage.resolve("turn")).toBe("turn");
  });
});

describe("Story.appendTurn: a story saved before chapters existed", () => {
  it("self-heals to chapter one instead of carrying undefined forward", () => {
    // `as` stands in for the JSON a pre-chapter document decodes to: real code never
    // constructs a StoryState missing these fields, but a loaded one still can.
    const preChapterStory = {
      ...seed,
      chapter: undefined,
      arcStageReached: undefined,
      chapterStartedAtTurn: undefined,
    } as unknown as Story.StoryState;

    const after = Story.appendTurn(preChapterStory, playedTurn({ decision: decision() }), 15);
    expect(after.chapter).toBe(Chapter.fallback);
    expect(after.arcStageReached).toBe("setup");
    expect(after.chapterStartedAtTurn).toBe(0);
  });
});
