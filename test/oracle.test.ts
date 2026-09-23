import { describe, expect, it } from "vitest";
import * as ArcStage from "@/core/ArcStage";
import * as Beat from "@/core/Beat";
import * as Chapter from "@/core/Chapter";
import * as Companion from "@/core/Companion";
import * as Danger from "@/core/Danger";
import * as Location from "@/core/Location";
import * as Mood from "@/core/Mood";
import * as Oracle from "@/core/Oracle";
import * as Story from "@/core/Story";
import { playedTurn, sessionId } from "./helpers";

const openedAt = new Date("2026-01-01T00:00:00.000Z");
const seed = Story.seed(sessionId, openedAt);

describe("Oracle.questions", () => {
  it("asks eighteen questions in one request", () => {
    expect(Object.keys(Oracle.questions)).toEqual([
      "location",
      "beat",
      "mood",
      "danger",
      "inFiction",
      "arcStage",
      "companion",
      "optionsSound",
      "affectionDirection",
      "affectionMagnitude",
      "sceneDangerDirection",
      "sceneDangerMagnitude",
      "tensionDirection",
      "tensionMagnitude",
      "moralityDirection",
      "moralityMagnitude",
      "goldDirection",
      "goldAmount",
    ]);
  });

  it("offers every catalog place and nothing that is not one", () => {
    const labels = Object.keys(Oracle.questions.location.criteria);
    expect(labels.length).toBe(Location.all.length);
    expect(labels.every(Location.isLocationId)).toBe(true);
    expect(labels).toContain("xiao-clan-manor");
  });

  it("asks for a real place even when the scene ends between two", () => {
    const instructions = String(Oracle.questions.location.instructions);
    expect(instructions).toContain("务必给出一个真实的地点");
  });

  it("describes every place with the same shape", () => {
    const shapes = new Set(
      Object.values(Oracle.questions.location.criteria).map((option) =>
        Object.keys(option).sort().join(","),
      ),
    );
    expect([...shapes]).toEqual(["also_called,region,summary"]);
  });

  it("describes beats and moods by what they are and one thing they look like", () => {
    expect(Object.keys(Oracle.questions.beat.criteria).length).toBe(Beat.all.length);
    expect(Oracle.questions.beat.criteria.battle.definition).toBe(Beat.byId.battle.definition);
    expect(Oracle.questions.beat.criteria.battle.example).toBe(Beat.byId.battle.example);

    expect(Object.keys(Oracle.questions.mood.criteria).length).toBe(Mood.all.length);
    expect(Oracle.questions.mood.criteria.calm.feel).toBe(Mood.byId.calm.feel);
    expect(Oracle.questions.mood.criteria.calm.examples).toEqual([...Mood.byId.calm.examples]);
  });

  it("scores danger against the whole rubric", () => {
    expect(Oracle.questions.danger.criteria.length).toBe(Danger.levels.length);
  });

  it("scores arcStage against the whole 起承转合 rubric", () => {
    expect(Oracle.questions.arcStage.criteria.length).toBe(ArcStage.levels.length);
  });

  it("offers every companion, plus none, and nothing else", () => {
    const labels = Object.keys(Oracle.questions.companion.criteria);
    expect(labels.length).toBe(Companion.all.length + 1);
    expect(labels).toContain("none");
    expect(labels).toContain("yao-lao");
  });

  it("judges arcStage against the chapter's goal, not the scene alone", () => {
    expect(String(Oracle.questions.arcStage.instructions)).toContain("`story.chapter_goal`");
  });

  it("points every question at the shared state by path", () => {
    const instructions = Object.values(Oracle.questions)
      .map((question) => String(question.instructions))
      .join(" ");
    expect(instructions).toContain("`scene.narration`");
    expect(instructions).toContain("`story.previous_position`");
  });
});

describe("Oracle.stateFor", () => {
  it("carries the opening position, chapter goal, no history and the new scene", () => {
    const state = Oracle.stateFor(
      seed,
      "I look north",
      "You look north, and the wind answers.",
      ["walk on", "look back"],
    );
    expect(state.story.previous_position).toEqual({
      location: "萧家演武场",
      region: "乌坦城",
    });
    expect(state.story.chapter_goal).toBe(Chapter.goalOf(Chapter.fallback));
    expect(state.story.recent).toEqual([]);
    expect(state.scene).toEqual({
      action: "I look north",
      narration: "You look north, and the wind answers.",
      options: "walk on\nlook back",
    });
  });

  it("still judges a turn for a story saved before chapters existed", () => {
    const preChapterStory = { ...seed, chapter: undefined } as unknown as Story.StoryState;
    const state = Oracle.stateFor(preChapterStory, "I wait", "You wait.", []);
    expect(state.story.chapter_goal).toBe(Chapter.goalOf(Chapter.fallback));
    expect(state.scene).toEqual({ action: "I wait", narration: "You wait.", options: "" });
  });

  it("shows only the last few exchanges", () => {
    const turns = [1, 2, 3, 4, 5].map((index) =>
      playedTurn({ action: `action ${index}`, narration: `narration ${index}` }),
    );
    const state = Oracle.stateFor({ ...seed, turns }, "now", "then", []);
    expect(state.story.recent.length).toBe(Oracle.recentTurnCount);
    expect(state.story.recent.map((scene) => scene.action)).toEqual([
      "action 3",
      "action 4",
      "action 5",
    ]);
  });
});
