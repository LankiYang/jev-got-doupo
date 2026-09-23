import { Schema } from "effect";

/**
 * What one Jev evaluation returned, kept whole.
 *
 * The catalogs already store the chosen ids (beat, mood, location) because those are
 * what drive the page. This keeps the rest of the answer — the confidence and the
 * full distribution over the options Jev did *not* pick — so the reading panel beside
 * the story can show how the judgement was reached rather than only its conclusion.
 *
 * Deliberately not in `@/server/schemas`: `Errors.ts` carries one of these, and the
 * schemas module imports `Errors`, so defining it there would close a cycle.
 */
export const LabelledChoice = Schema.Struct({
  /** The chosen catalog id. */
  choice: Schema.String,
  /** 0–1, derived by Jev from the distribution below. */
  confidence: Schema.Number,
  /** Every option it weighed, keyed by id, summing to 1. */
  probabilities: Schema.Record({ key: Schema.String, value: Schema.Number }),
});

export type LabelledChoice = typeof LabelledChoice.Type;

/** A score answer: the probability-weighted value plus its rubric-indexed distribution. */
export const LabelledScore = Schema.Struct({
  score: Schema.Number,
  confidence: Schema.Number,
  probabilities: Schema.Record({ key: Schema.String, value: Schema.Number }),
});

export type LabelledScore = typeof LabelledScore.Type;

/** A yes/no answer. `noul` is P(yes); it carries no separate confidence. */
export const LabelledNoul = Schema.Struct({
  noul: Schema.Number,
});

export type LabelledNoul = typeof LabelledNoul.Type;

/** Everything Jev returned for one scene, as the panel renders it. */
export const JevReading = Schema.Struct({
  location: LabelledChoice,
  beat: LabelledChoice,
  mood: LabelledChoice,
  danger: LabelledScore,
  inFiction: LabelledNoul,
  /** Where the scene sits in its chapter's 起承转合. */
  arcStage: LabelledScore,
  /** Which recurring companion, if any, had a real presence in the scene. */
  companion: LabelledChoice,
  /** Wall-clock milliseconds the request took, measured server-side. */
  latencyMs: Schema.Number,
  /** Input tokens billed for this evaluation. */
  inputTokens: Schema.Int,
});

export type JevReading = typeof JevReading.Type;
