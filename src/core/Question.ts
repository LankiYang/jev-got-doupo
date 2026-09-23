import type { ChoiceResponse, NoulResponse, ScoreResponse } from "@typesafe-ai/sdk";
import { Schema } from "effect";

export { choice, noul, score } from "@typesafe-ai/sdk";

/**
 * `probabilities` is deliberately string-keyed: Jev omits options that round away, so a
 * literal-keyed record would fail to decode the files this schema exists to read back.
 */
export const StoredChoice = Schema.Struct({
  choice: Schema.String,
  confidence: Schema.Number,
  probabilities: Schema.Record({ key: Schema.String, value: Schema.Number }),
});

/** A stored score answer; `probabilities` is keyed by the rubric index as a string. */
export const StoredScore = Schema.Struct({
  score: Schema.Number,
  confidence: Schema.Number,
  probabilities: Schema.Record({ key: Schema.String, value: Schema.Number }),
});

/** A stored yes/no answer; `noul` is the probability of yes. */
export const StoredNoul = Schema.Struct({
  noul: Schema.Number,
});

/**
 * Jev's answers as they are written to disk. The keys mirror `Oracle.questions`; the
 * values are looser than the SDK's literal types so that saved turns stay readable when
 * the catalogs move on.
 */
export const StoredAnswers = Schema.Struct({
  location: StoredChoice,
  beat: StoredChoice,
  mood: StoredChoice,
  danger: StoredScore,
  inFiction: StoredNoul,
  arcStage: StoredScore,
  companion: StoredChoice,
  affectionDirection: StoredNoul,
  affectionMagnitude: StoredScore,
  sceneDangerDirection: StoredNoul,
  sceneDangerMagnitude: StoredScore,
  tensionDirection: StoredNoul,
  tensionMagnitude: StoredScore,
  moralityDirection: StoredNoul,
  moralityMagnitude: StoredScore,
  goldDirection: StoredNoul,
  /** A `choice` over `Meter.goldLadder`'s coin rungs, not a magnitude score. */
  goldAmount: StoredChoice,
});

export type StoredAnswers = typeof StoredAnswers.Type;

/** The structural shape `toStored` accepts, so `Oracle.Answers` keeps its literal unions. */
export interface AnswersLike {
  readonly location: ChoiceResponse;
  readonly beat: ChoiceResponse;
  readonly mood: ChoiceResponse;
  readonly danger: ScoreResponse;
  readonly inFiction: NoulResponse;
  readonly arcStage: ScoreResponse;
  readonly companion: ChoiceResponse;
  readonly affectionDirection: NoulResponse;
  readonly affectionMagnitude: ScoreResponse;
  readonly sceneDangerDirection: NoulResponse;
  readonly sceneDangerMagnitude: ScoreResponse;
  readonly tensionDirection: NoulResponse;
  readonly tensionMagnitude: ScoreResponse;
  readonly moralityDirection: NoulResponse;
  readonly moralityMagnitude: ScoreResponse;
  readonly goldDirection: NoulResponse;
  readonly goldAmount: ChoiceResponse;
}

const storedChoice = (answer: ChoiceResponse): typeof StoredChoice.Type => ({
  choice: answer.choice,
  confidence: answer.confidence,
  probabilities: { ...answer.probabilities },
});

const storedScore = (answer: ScoreResponse): typeof StoredScore.Type => ({
  score: answer.score,
  confidence: answer.confidence,
  probabilities: { ...answer.probabilities },
});

/** Widen one request's typed answers into the shape that is persisted and replayed. */
export const toStored = (answers: AnswersLike): StoredAnswers => ({
  location: storedChoice(answers.location),
  beat: storedChoice(answers.beat),
  mood: storedChoice(answers.mood),
  danger: storedScore(answers.danger),
  inFiction: { noul: answers.inFiction.noul },
  arcStage: storedScore(answers.arcStage),
  companion: storedChoice(answers.companion),
  affectionDirection: { noul: answers.affectionDirection.noul },
  affectionMagnitude: storedScore(answers.affectionMagnitude),
  sceneDangerDirection: { noul: answers.sceneDangerDirection.noul },
  sceneDangerMagnitude: storedScore(answers.sceneDangerMagnitude),
  tensionDirection: { noul: answers.tensionDirection.noul },
  tensionMagnitude: storedScore(answers.tensionMagnitude),
  moralityDirection: { noul: answers.moralityDirection.noul },
  moralityMagnitude: storedScore(answers.moralityMagnitude),
  goldDirection: { noul: answers.goldDirection.noul },
  goldAmount: storedChoice(answers.goldAmount),
});
