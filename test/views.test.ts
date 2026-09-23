import { Either, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as Chapter from "@/core/Chapter";
import * as Position from "@/core/Position";
import * as Story from "@/core/Story";
import * as Wire from "@/server/schemas";
import * as views from "@/server/views";
import { decision, playedTurn, sessionId } from "./helpers";

const seed = Story.seed(sessionId, new Date("2026-01-01T00:00:00.000Z"));

describe("views.position", () => {
  it("resolves a place id into the name the header shows and the artwork behind it", () => {
    expect(views.position(Position.at("wutan-city"), Option.none())).toEqual({
      location: { id: "wutan-city", name: "乌坦城", region: "乌坦城" },
      background: "/scenes/wutan-city.webp",
    });
  });

  it("keeps the place in the header and gives the beat the backdrop", () => {
    expect(views.position(Position.at("wutan-city"), Option.some("wedding"))).toEqual({
      location: { id: "wutan-city", name: "乌坦城", region: "乌坦城" },
      background: "/scenes/beat-wedding.webp",
    });
  });

  it("leaves the backdrop to the place for a beat that carries no artwork", () => {
    expect(views.position(Position.at("wutan-city"), Option.some("journey"))).toEqual(
      views.position(Position.at("wutan-city"), Option.none()),
    );
  });
});

describe("views.story", () => {
  it("opens a fresh session with the prologue alone", () => {
    const view = views.story(seed, 15);
    expect(Schema.decodeUnknownSync(Wire.StoryView)(view)).toEqual(view);
    expect(view.turn).toBe(0);
    expect(view.turnsRemaining).toBe(15);
    expect(view.ended).toBe(false);
    expect(view.messages.length).toBe(1);
    expect(view.messages[0].id).toBe("prologue");
    expect(view.messages[0].role).toBe("assistant");
    expect(view.messages[0].mood).toBe("tense");
    expect(view.messages[0].position).toEqual(
      views.position(Position.at("xiao-clan-training-ground"), Option.none()),
    );
    expect(view.position.background).toBe("/scenes/xiao-clan-training-ground.webp");
    expect(view.chapter).toEqual({
      id: Chapter.fallback,
      title: Chapter.byId[Chapter.fallback].title,
      goal: Chapter.byId[Chapter.fallback].goal,
      index: 1,
      total: Chapter.all.length,
      stage: "setup",
    });
  });

  it("follows the prologue with one pair of messages per played turn", () => {
    const played = playedTurn({
      action: "I ride south",
      narration: "You ride south.",
      decision: decision({ position: Position.at("jia-ma-capital"), mood: "triumphant" }),
    });
    const view = views.story(
      { ...seed, turns: [played], position: Position.at("jia-ma-capital") },
      15,
    );

    expect(Schema.decodeUnknownSync(Wire.StoryView)(view)).toEqual(view);
    expect(view.messages.map((message) => message.id)).toEqual([
      "prologue",
      "turn-1-user",
      "turn-1-assistant",
    ]);
    expect(view.messages[1].text).toBe("I ride south");
    expect(view.messages[2].mood).toBe("triumphant");
    expect(view.messages[2].position).toEqual(
      views.position(Position.at("jia-ma-capital"), Option.some("journey")),
    );
    expect(view.turn).toBe(1);
    expect(view.turnsRemaining).toBe(14);
  });
});

describe("views.turn", () => {
  it("answers a played turn with its labels", () => {
    const view = views.turn({
      decision: decision({
        position: Position.at("jia-ma-capital"),
        mood: "battle",
        beat: "battle",
      }),
      text: "You ride through the gates.",
      reading: {
        location: {
          choice: "jia-ma-capital",
          confidence: 0.9,
          probabilities: { "jia-ma-capital": 0.9, "xiao-clan-manor": 0.1 },
        },
        beat: { choice: "battle", confidence: 1, probabilities: { battle: 1 } },
        mood: { choice: "battle", confidence: 1, probabilities: { battle: 1 } },
        danger: {
          score: 3,
          confidence: 1,
          probabilities: { 0: 0, 1: 0, 2: 0, 3: 1, 4: 0 },
        },
        inFiction: { noul: 0.99 },
        arcStage: {
          score: 2,
          confidence: 0.8,
          probabilities: { 0: 0, 1: 0.1, 2: 0.8, 3: 0.1 },
        },
        companion: { choice: "none", confidence: 0.9, probabilities: { none: 0.9 } },
        latencyMs: 420,
        inputTokens: 1234,
      },
      chapter: Chapter.fallback,
      arcStageReached: "turn",
      turn: 4,
      turnsRemaining: 11,
      ended: false,
      sceneDanger: 30,
      tension: 55,
      morality: 65,
      gold: 20,
      affection: { "yao-lao": 70 },
    });
    expect(Schema.decodeUnknownSync(Wire.TurnView)(view)).toEqual(view);
    expect(view.mood).toBe("battle");
    expect(view.beat).toBe("battle");
    expect(view.position).toEqual(
      views.position(Position.at("jia-ma-capital"), Option.some("battle")),
    );
    expect(view.position.background).toBe("/scenes/beat-battle.webp");
    expect(view.chapter).toEqual({
      id: Chapter.fallback,
      title: Chapter.byId[Chapter.fallback].title,
      goal: Chapter.byId[Chapter.fallback].goal,
      index: 1,
      total: Chapter.all.length,
      stage: "turn",
    });
  });
});

describe("views.story: a turn saved before arcStage and companion existed", () => {
  it("reads the missing questions as zero instead of throwing", () => {
    const older = playedTurn();
    const answers = { ...older.answers, arcStage: undefined, companion: undefined };
    const played = { ...older, answers: answers as unknown as Story.Turn["answers"] };

    const view = views.story({ ...seed, turns: [played] }, 15);
    const assistant = view.messages.find((message) => message.id === "turn-1-assistant");
    expect(assistant?.reading?.arcStage).toEqual({ score: 0, confidence: 0, probabilities: {} });
    expect(assistant?.reading?.companion).toEqual({ choice: "none", confidence: 0, probabilities: {} });
  });
});

describe("views.story: a story saved before chapters existed", () => {
  it("reads as chapter one instead of throwing", () => {
    const preChapterStory = {
      ...seed,
      chapter: undefined,
      arcStageReached: undefined,
    } as unknown as Story.StoryState;

    const view = views.story(preChapterStory, 15);
    expect(view.chapter).toEqual({
      id: Chapter.fallback,
      title: Chapter.byId[Chapter.fallback].title,
      goal: Chapter.byId[Chapter.fallback].goal,
      index: 1,
      total: Chapter.all.length,
      stage: "setup",
    });
  });
});

describe("views.story backdrop", () => {
  it("stands the reloaded story under the beat of its last turn", () => {
    const played = playedTurn({
      decision: decision({ position: Position.at("auction-house"), beat: "wedding" }),
    });
    const view = views.story(
      { ...seed, turns: [played], position: Position.at("auction-house") },
      15,
    );
    expect(view.position.background).toBe("/scenes/beat-wedding.webp");
    expect(view.position.location.id).toBe("auction-house");
  });
});

describe("request schemas", () => {
  it("trims an action and rejects an empty or oversized one", () => {
    expect(Either.getOrNull(Wire.decodeTurnRequest({ action: "  I wait  ", turn: 0 }))).toEqual({
      action: "I wait",
      turn: 0,
    });
    expect(Wire.decodeTurnRequest({ action: "   ", turn: 0 })._tag).toBe("Left");
    expect(Wire.decodeTurnRequest({ action: "x".repeat(201), turn: 0 })._tag).toBe("Left");
    expect(Wire.decodeTurnRequest({ action: "I wait", turn: -1 })._tag).toBe("Left");
    expect(Wire.decodeTurnRequest({ action: "I wait" })._tag).toBe("Left");
  });

  it("rejects a session id that is not a uuid", () => {
    expect(Wire.decodeSessionId(sessionId)._tag).toBe("Right");
    expect(Wire.decodeSessionId("not-a-uuid")._tag).toBe("Left");
  });
});
