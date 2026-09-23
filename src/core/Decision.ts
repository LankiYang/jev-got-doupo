/**
 * Turns one turn's answers into the next state. Pure, and a function of the stored
 * answers alone, so a saved turn re-resolves to the decision it was saved with.
 */
import { Option, Schema } from "effect";
import * as ArcStage from "@/core/ArcStage";
import * as Beat from "@/core/Beat";
import * as Companion from "@/core/Companion";
import * as Danger from "@/core/Danger";
import * as Location from "@/core/Location";
import * as Meter from "@/core/Meter";
import * as Mood from "@/core/Mood";
import * as Position from "@/core/Position";
import type { StoredAnswers } from "@/core/Question";

/** Above this, `inFiction` counts as a yes. */
export const inFictionThreshold = 0.5;

/** What one turn's answers resolve to: the state the next turn is written from. */
export const Decision = Schema.Struct({
  position: Position.Position,
  mood: Mood.MoodId,
  beat: Beat.BeatId,
  danger: Danger.DangerId,
  inFiction: Schema.Boolean,
  arcStage: ArcStage.ArcStageId,
  companion: Companion.CompanionId,
  /** Signed point deltas for `Story`'s running gauges; `Story.appendTurn` applies them. */
  affectionDelta: Schema.Number,
  sceneDangerDelta: Schema.Number,
  tensionDelta: Schema.Number,
  moralityDelta: Schema.Number,
  goldDelta: Schema.Number,
});

export type Decision = typeof Decision.Type;

type Probabilities = Readonly<Record<string, number>>;

type StoredChoice = StoredAnswers["location"];

/** A stored `choice` is a bare string so a catalog that has moved on cannot break an old story. */
const narrowed = <A extends string>(
  answer: { readonly choice: string },
  isMember: (value: unknown) => value is A,
  fallback: A,
): A => (isMember(answer.choice) ? answer.choice : fallback);

/** Jev omits options whose probability rounds away, so an absent label is zero. */
const probabilityOf = (probabilities: Probabilities, label: string): number => {
  const value = probabilities[label];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const massOf = (probabilities: Probabilities, id: Location.LocationId): number =>
  Location.childrenOf(id).reduce(
    (total, child) => total + probabilityOf(probabilities, child),
    probabilityOf(probabilities, id),
  );

/**
 * Jev's own `choice` seeds the reduce, so it wins ties and still answers when every
 * probability rounded away.
 */
const topPlace = (answer: StoredChoice): Location.LocationId =>
  Location.all.reduce(
    (best, location) =>
      probabilityOf(answer.probabilities, location.id) >
      probabilityOf(answer.probabilities, best)
        ? location.id
        : best,
    narrowed(answer, Location.isLocationId, Location.fallback),
  );

/**
 * Whether a sub-place holds more mass than the rest of its family put together. A
 * majority rather than a threshold, so there is no constant to tune.
 */
const holdsMost = (
  probabilities: Probabilities,
  child: Location.LocationId,
  parent: Location.LocationId,
): boolean => {
  const own = probabilityOf(probabilities, child);
  return own >= massOf(probabilities, parent) - own;
};

/**
 * A sub-place lends its mass to its parent unless it holds most of the family's:
 * "through the gates of the manor" spreads over the manor, the training ground and the
 * hall and resolves to the manor, while "the training ground" at 0.9 keeps its own place.
 */
const foldTarget = (probabilities: Probabilities, top: Location.LocationId): Location.LocationId =>
  Option.match(Location.parentOf(top), {
    onNone: () => top,
    onSome: (parent) => (holdsMost(probabilities, top, parent) ? top : parent),
  });

/**
 * Reads the `probabilities` rather than the `choice`: a city and the places inside it are
 * separate options, so the label Jev picks can be one street of the city the scene is about.
 */
const placed = (answer: StoredChoice): Position.Position =>
  Position.at(foldTarget(answer.probabilities, topPlace(answer)));

/** Every read is total, so a turn saved under an older catalog falls back instead of throwing. */
export const resolve = (answers: StoredAnswers): Decision => {
  const companion = narrowed(answers.companion, Companion.isCompanionIdOrNone, Companion.fallback);
  return {
    position: placed(answers.location),
    mood: narrowed(answers.mood, Mood.isMoodId, Mood.fallback),
    beat: narrowed(answers.beat, Beat.isBeatId, Beat.fallback),
    danger: Danger.fromScore(answers.danger.score),
    inFiction: answers.inFiction.noul >= inFictionThreshold,
    arcStage: ArcStage.fromScore(answers.arcStage.score),
    companion,
    // No companion had a real presence: the direction/magnitude reading is meaningless,
    // so the delta is zero rather than whatever Jev guessed for a question that did not apply.
    affectionDelta:
      companion === Companion.none
        ? 0
        : Meter.deltaOf(answers.affectionDirection.noul, answers.affectionMagnitude.score),
    sceneDangerDelta: Meter.deltaOf(answers.sceneDangerDirection.noul, answers.sceneDangerMagnitude.score),
    tensionDelta: Meter.deltaOf(answers.tensionDirection.noul, answers.tensionMagnitude.score),
    moralityDelta: Meter.deltaOf(answers.moralityDirection.noul, answers.moralityMagnitude.score),
    // Gold is a coin count, not a 1–100 gauge (see `Story.gold`). Its amount comes from
    // a `choice` over coin-denominated buckets, not a magnitude rubric, so the signed
    // amount is the rung Jev picked rather than a level looked up in a step table.
    // `|| 0` normalizes the `-0` that negating a zero rung would otherwise produce.
    goldDelta:
      Meter.goldOf(answers.goldAmount.choice) *
        (answers.goldDirection.noul >= Meter.riseThreshold ? 1 : -1) || 0,
  };
};
