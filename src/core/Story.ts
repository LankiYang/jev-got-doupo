import { Option, Schema } from "effect";
import * as Affection from "@/core/Affection";
import * as ArcStage from "@/core/ArcStage";
import * as Chapter from "@/core/Chapter";
import * as Companion from "@/core/Companion";
import { Decision } from "@/core/Decision";
import * as Meter from "@/core/Meter";
import * as Mood from "@/core/Mood";
import * as Position from "@/core/Position";
import { openingLocationId, openingMoodId } from "@/core/data/prologue";
import { StoredAnswers } from "@/core/Question";

/** A browser-generated session id; one story per id. */
export const SessionId = Schema.UUID.pipe(Schema.brand("SessionId"));

export type SessionId = typeof SessionId.Type;

/** One played turn: what the player did, what the narrator wrote, and what Jev made of it. */
export const Turn = Schema.Struct({
  action: Schema.String,
  narration: Schema.String,
  answers: StoredAnswers,
  decision: Decision,
  at: Schema.Date,
});

export type Turn = typeof Turn.Type;

/**
 * `affection` is deliberately string-keyed rather than `Companion.CompanionId`: a
 * companion the catalog has since dropped should still decode, the same reason
 * `Question.StoredChoice.probabilities` stays loose. `Affection.of` is the total read.
 */
const Affections = Schema.Record({ key: Schema.String, value: Schema.Number });

/** A whole storyline, as it is written to the store. */
export const StoryState = Schema.Struct({
  sessionId: SessionId,
  position: Position.Position,
  mood: Mood.MoodId,
  turns: Schema.Array(Turn),
  ended: Schema.Boolean,
  updatedAt: Schema.Date,
  chapter: Chapter.ChapterId,
  /** The furthest `arcStage` reached since `chapter` last changed; never moves backward. */
  arcStageReached: ArcStage.ArcStageId,
  /** `turns.length` when `chapter` last changed, so the min-turns guard can read it back. */
  chapterStartedAtTurn: Schema.Int,
  /** Running 1–100 gauges, moved a turn at a time by `Decision`'s signed deltas. */
  sceneDanger: Schema.Number,
  tension: Schema.Number,
  morality: Schema.Number,
  /** A coin count, not a 1–100 gauge: it only ever floors at zero, never caps. */
  gold: Schema.Number,
  affection: Affections,
});

export type StoryState = typeof StoryState.Type;

/** Where the solo gauges start: a ceremony, not yet a fight, but already humiliating —
 *  principled by upbringing, and poor, the disgraced third son of a fading clan. */
export const initialSceneDanger = 12;
export const initialTension = 45;
export const initialMorality = 65;
export const initialGold = 20;

/** The opening state: the Xiao clan manor, nothing played yet. */
export const seed = (sessionId: SessionId, at: Date): StoryState => ({
  sessionId,
  position: Position.at(openingLocationId),
  mood: openingMoodId,
  turns: [],
  ended: false,
  updatedAt: at,
  chapter: Chapter.fallback,
  arcStageReached: ArcStage.fallback,
  chapterStartedAtTurn: 0,
  sceneDanger: initialSceneDanger,
  tension: initialTension,
  morality: initialMorality,
  gold: initialGold,
  affection: Affection.seed(),
});

/** The turn about to be played, counting from one. */
export const nextTurnIndex = (state: StoryState): number => state.turns.length + 1;

export const turnsRemaining = (state: StoryState, maxTurns: number): number =>
  Math.max(0, maxTurns - state.turns.length);

const lastTurn = (state: StoryState): Option.Option<Turn> =>
  Option.fromNullable(state.turns.at(-1));

export const lastDecision = (state: StoryState): Option.Option<Decision> =>
  Option.map(lastTurn(state), (turn) => turn.decision);

export const recentTurns = (state: StoryState, count: number): ReadonlyArray<Turn> =>
  state.turns.slice(-count);

/**
 * Append a played turn; the decision it carries becomes the story's new state.
 *
 * A chapter closes when the furthest `arcStage` reached since it opened is 合 *and* it
 * has run at least `Chapter.minTurns` — the guard against a single generous reading
 * skipping the arc the chapter was supposed to run. Closing resets the ratchet for
 * whatever opens next; on the last chapter, closing just leaves it resolved.
 */
export const appendTurn = (state: StoryState, turn: Turn, maxTurns: number): StoryState => {
  // `Chapter.resolve`/`ArcStage.resolve`: a story saved before this build's chapter
  // catalog existed carries neither field, and a corrupt read here should self-heal to
  // chapter one rather than propagate `undefined` into every turn saved after it.
  const chapter = Chapter.resolve(state.chapter);
  const chapterStartedAtTurn = Number.isInteger(state.chapterStartedAtTurn)
    ? state.chapterStartedAtTurn
    : 0;

  const turns = [...state.turns, turn];
  const turnsIntoChapter = turns.length - chapterStartedAtTurn;
  const arcStageReached = ArcStage.furthest(ArcStage.resolve(state.arcStageReached), turn.decision.arcStage);
  const closes = ArcStage.isResolution(arcStageReached) && turnsIntoChapter >= Chapter.minTurns;
  const advanced = closes ? Chapter.next(chapter) : Option.none();

  const { companion, affectionDelta } = turn.decision;
  const affection =
    companion === Companion.none
      ? state.affection
      : { ...state.affection, [companion]: Meter.apply(Affection.of(state.affection, companion), affectionDelta) };

  return {
    ...state,
    position: turn.decision.position,
    mood: turn.decision.mood,
    turns,
    ended: turns.length >= maxTurns,
    updatedAt: turn.at,
    chapter: Option.getOrElse(advanced, () => chapter),
    arcStageReached: Option.isSome(advanced) ? ArcStage.fallback : arcStageReached,
    chapterStartedAtTurn: Option.isSome(advanced) ? turns.length : chapterStartedAtTurn,
    sceneDanger: Meter.apply(state.sceneDanger, turn.decision.sceneDangerDelta),
    tension: Meter.apply(state.tension, turn.decision.tensionDelta),
    morality: Meter.apply(state.morality, turn.decision.moralityDelta),
    // Not `Meter.apply`: gold has no ceiling, only a floor at zero.
    gold: Math.max(0, Math.round(state.gold + turn.decision.goldDelta)),
    affection,
  };
};
