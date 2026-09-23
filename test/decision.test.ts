import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as Decision from "@/core/Decision";
import * as Location from "@/core/Location";
import * as Mood from "@/core/Mood";
import * as Position from "@/core/Position";
import { StoredAnswers } from "@/core/Question";
import { storedAnswers } from "./helpers";

describe("Decision.resolve", () => {
  it("moves to the place Jev names", () => {
    const decision = Decision.resolve(
      storedAnswers({ location: { "wutan-city": 0.82, "jia-ma-trade-road": 0.1 } }),
    );
    expect(decision.position).toEqual(Position.at("wutan-city"));
  });

  it("folds a sub-place into the city it sits in", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: {
          "xiao-clan-training-ground": 0.34,
          "xiao-clan-manor": 0.3,
          "xiao-clan-hall": 0.21,
        },
      }),
    );
    expect(decision.position).toEqual(Position.at("xiao-clan-manor"));
  });

  it("folds the city's own sub-places back into it", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: {
          "xiao-clan-manor": 0.3,
          "xiao-clan-training-ground": 0.25,
          "xiao-clan-hall": 0.2,
        },
      }),
    );
    expect(decision.position).toEqual(Position.at("xiao-clan-manor"));
  });

  it("keeps a sub-place that holds the scene on its own", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { "xiao-clan-training-ground": 0.9, "xiao-clan-manor": 0.05 },
      }),
    );
    expect(decision.position).toEqual(Position.at("xiao-clan-training-ground"));
  });

  it("moves on weak evidence rather than standing still", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { "wutan-city": 0.2, "jia-ma-capital": 0.18, "yunlan-sect": 0.12 },
      }),
    );
    expect(decision.position).toEqual(Position.at("wutan-city"));
  });

  it("treats an omitted option as zero and falls back on Jev's own pick", () => {
    const decision = Decision.resolve(storedAnswers({ location: {}, choice: "jia-ma-capital" }));
    expect(decision.position).toEqual(Position.at("jia-ma-capital"));
  });

  it("reads the mood, the beat, the danger and the fiction check", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { "wutan-city": 0.9 },
        mood: "battle",
        beat: "duel",
        danger: 3.6,
        inFiction: 0.51,
      }),
    );
    expect(decision.mood).toBe("battle");
    expect(decision.beat).toBe("duel");
    expect(decision.danger).toBe("deadly");
    expect(decision.inFiction).toBe(true);
  });

  it("falls back rather than throwing when a saved id left the catalog", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: {},
        choice: "kings-cross",
        mood: "wistful",
        beat: "montage",
        inFiction: 0.49,
      }),
    );
    expect(decision.position).toEqual(Position.at(Location.fallback));
    expect(decision.mood).toBe(Mood.fallback);
    expect(decision.beat).toBe("quiet");
    expect(decision.inFiction).toBe(false);
  });

  it("reads the scene-danger and tension gauges regardless of who is in the scene", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { "wutan-city": 0.9 },
        sceneDangerDirection: 0.9,
        sceneDangerMagnitude: 3,
        tensionDirection: 0.1,
        tensionMagnitude: 1,
      }),
    );
    expect(decision.sceneDangerDelta).toBe(15);
    expect(decision.tensionDelta).toBe(-3);
  });

  it("reads the affection gauge when a companion has a real presence", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { "wutan-city": 0.9 },
        companion: "yao-lao",
        affectionDirection: 0.9,
        affectionMagnitude: 2,
      }),
    );
    expect(decision.companion).toBe("yao-lao");
    expect(decision.affectionDelta).toBe(8);
  });

  it("zeroes the affection delta when no companion had a real presence", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { "wutan-city": 0.9 },
        companion: "none",
        affectionDirection: 0.9,
        affectionMagnitude: 4,
      }),
    );
    expect(decision.companion).toBe("none");
    expect(decision.affectionDelta).toBe(0);
  });

  it("reads the morality gauge and the gold amount from the same scene", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { "wutan-city": 0.9 },
        moralityDirection: 0.1,
        moralityMagnitude: 3,
        goldDirection: 0.9,
        goldAmount: "50",
      }),
    );
    expect(decision.moralityDelta).toBe(-15);
    // The rung Jev picked, signed by the direction reading.
    expect(decision.goldDelta).toBe(50);
  });

  it("signs the gold amount down when the scene spent rather than earned", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { "wutan-city": 0.9 },
        goldDirection: 0.1,
        goldAmount: "30",
      }),
    );
    expect(decision.goldDelta).toBe(-30);
  });

  it("moves gold by nothing when the scene had no coin transaction", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { "wutan-city": 0.9 },
        goldDirection: 0.9,
        goldAmount: "0",
      }),
    );
    expect(decision.goldDelta).toBe(0);
  });
});

describe("replay", () => {
  it("re-decides a turn from the stored record alone", () => {
    const answers = storedAnswers({
      location: {
        "xiao-clan-training-ground": 0.34,
        "xiao-clan-manor": 0.3,
        "xiao-clan-hall": 0.21,
      },
      mood: "battle",
      beat: "duel",
      danger: 2.4,
    });
    const onDisk = JSON.parse(JSON.stringify(Schema.encodeSync(StoredAnswers)(answers))) as unknown;
    const reread = Schema.decodeUnknownSync(StoredAnswers)(onDisk);

    expect(Decision.resolve(reread)).toEqual(Decision.resolve(answers));
    expect(Decision.resolve(reread).position).toEqual(Position.at("xiao-clan-manor"));
  });
});
