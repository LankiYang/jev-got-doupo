import { Clock, Effect, Option, Ref, Stream } from "effect";
import * as ArcStage from "@/core/ArcStage";
import { Budget } from "@/core/Budget";
import * as Chapter from "@/core/Chapter";
import * as Decision from "@/core/Decision";
import { type AppError, NarratorError, OutOfFiction, StoryEnded, TurnConflict } from "@/core/Errors";
import { Narrator } from "@/core/Narrator";
import { QuestionModel } from "@/core/QuestionModel";
import * as Oracle from "@/core/Oracle";
import * as Prompt from "@/core/Prompt";
import type { JevReading } from "@/core/JevReading";
import { toStored } from "@/core/Question";
import { Rules } from "@/core/Rules";
import * as Story from "@/core/Story";
import { StoryStore } from "@/core/StoryStore";
import { TurnLock } from "@/core/TurnLock";

export interface TurnResult {
  readonly decision: Decision.Decision;
  readonly text: string;
  /** Jev's raw answer for this scene, for the reading panel. */
  readonly reading: JevReading;
  /** The chapter the story stands in once this turn is saved. */
  readonly chapter: Chapter.ChapterId;
  /** The furthest `arcStage` reached within that chapter so far. */
  readonly arcStageReached: ArcStage.ArcStageId;
  /** Turns completed once this one is saved. */
  readonly turn: number;
  readonly turnsRemaining: number;
  readonly ended: boolean;
  /** The running gauges' current values, once this turn's deltas are applied. */
  readonly sceneDanger: number;
  readonly tension: number;
  readonly morality: number;
  readonly gold: number;
  readonly affection: Readonly<Record<string, number>>;
}

/**
 * One step of a streamed turn, as the client sees it.
 *
 * `chunk` is prose as it is written; `reading` is Jev's answer for the finished scene;
 * `options` is the narrator's own suggested next actions — never Jev's, Jev only ever
 * labels what already happened; `saved` closes the turn with the ids the page reacts
 * to; `reset` means the prose just streamed broke the fiction and is about to be
 * replaced, so the client should clear it.
 */
export type TurnEvent =
  | { readonly _tag: "chunk"; readonly text: string }
  | { readonly _tag: "reading"; readonly reading: JevReading }
  | { readonly _tag: "options"; readonly options: ReadonlyArray<string> }
  | { readonly _tag: "saved"; readonly result: TurnResult }
  | { readonly _tag: "reset" };

/** Flatten one SDK Choice answer into the wire shape, dropping nothing. */
const raw = (answer: {
  readonly choice: string;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
}): { choice: string; confidence: number; probabilities: Record<string, number> } => ({
  choice: String(answer.choice),
  confidence: answer.confidence,
  probabilities: { ...answer.probabilities },
});

/**
 * Splits the narrator's raw text on `Prompt.optionsMarker` into the scene and the
 * suggested-actions block that follows it. Absent (the narrator forgot the format, or
 * this is the closing scene, which never asks for one) reads as no suggestions rather
 * than failing the turn — the composer's free-text input never depended on this.
 */
const splitOptions = (raw: string): { readonly narration: string; readonly optionsBlock: string } => {
  const markerIndex = raw.indexOf(Prompt.optionsMarker);
  if (markerIndex === -1) return { narration: raw.trim(), optionsBlock: "" };
  return {
    narration: raw.slice(0, markerIndex).trim(),
    optionsBlock: raw.slice(markerIndex + Prompt.optionsMarker.length),
  };
};

/** A stray leading bullet or number the model added despite being asked not to. */
const leadingMarker = /^[\s\-*•\d.、）)]+/;

/** Exported for direct testing: three short strings, not the marker or its formatting. */
export const parseOptions = (optionsBlock: string): ReadonlyArray<string> =>
  optionsBlock
    .split("\n")
    .map((line) => line.replace(leadingMarker, "").trim())
    .filter((line) => line !== "")
    .slice(0, 3);

/** Above this, `optionsSound` counts as a pass. */
const optionsSoundThreshold = 0.5;

/**
 * Exported for direct testing: dropped rather than regenerated when Jev's
 * `optionsSound` reads low — a second narrator call to fix three short lines would
 * cost more than the suggestions are worth, and the free-text composer never depended
 * on them.
 */
export const soundOptions = (
  drafted: ReadonlyArray<string>,
  optionsSoundNoul: number,
): ReadonlyArray<string> => (optionsSoundNoul >= optionsSoundThreshold ? drafted : []);

/**
 * Filters `Prompt.optionsMarker` and everything after it out of a stream of text
 * pieces, so the reader never sees the raw marker or the suggestion lines flash by as
 * prose. Holds back the last `marker.length - 1` characters at all times, in case the
 * marker arrives split across two pieces — flushed at the end if it never appears.
 */
export const withoutOptionsMarker = <E>(raw: Stream.Stream<string, E>): Stream.Stream<string, E> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const marker = Prompt.optionsMarker;
      const holdBack = marker.length - 1;
      const held = yield* Ref.make("");
      const stopped = yield* Ref.make(false);

      const filtered = raw.pipe(
        Stream.mapEffect((piece) =>
          Effect.gen(function* () {
            if (yield* Ref.get(stopped)) return "";
            const combined = (yield* Ref.get(held)) + piece;
            const markerIndex = combined.indexOf(marker);
            if (markerIndex !== -1) {
              yield* Ref.set(stopped, true);
              return combined.slice(0, markerIndex);
            }
            const safeLength = Math.max(0, combined.length - holdBack);
            yield* Ref.set(held, combined.slice(safeLength));
            return combined.slice(0, safeLength);
          }),
        ),
        Stream.filter((text) => text !== ""),
      );

      // The marker never arrived (the model skipped it): whatever is still held back
      // is the tail of the scene, and belongs on screen rather than being dropped.
      const flush = Stream.fromEffect(
        Effect.gen(function* () {
          if (yield* Ref.get(stopped)) return "";
          return yield* Ref.get(held);
        }),
      ).pipe(Stream.filter((text) => text !== ""));

      return Stream.concat(filtered, flush);
    }),
  );

const now = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));

/** Reading never writes: a session exists on disk only once its first turn is played. */
export const openStory = Effect.fn("StoryEngine.openStory")(function* (sessionId: Story.SessionId) {
  const store = yield* StoryStore;
  const saved = yield* store.load(sessionId);
  if (Option.isSome(saved)) return saved.value;
  return Story.seed(sessionId, yield* now);
});

/**
 * The narrate-and-judge pair is retried once when Jev's `inFiction` says the prose left
 * the world, with a stricter reminder in the prompt. A second slip is accepted rather
 * than failing the turn, and the rejected attempt rides on `OutOfFiction` so the
 * recovery has the prose and the answers it needs.
 *
 * The session's `TurnLock` is taken before the story is read and held until the
 * returned stream ends, however it ends: a turn that is already running makes this
 * one a `TurnConflict` rather than a second writer.
 */
export const playTurnStream = Effect.fn("StoryEngine.playTurnStream")(
  function* (sessionId: Story.SessionId, turn: number, action: string) {
    const lock = yield* TurnLock;
    const held = yield* lock.acquire(sessionId);
    if (Option.isNone(held)) {
      // The running turn is about to leave the story one past what this client saw.
      return yield* new TurnConflict({ expected: turn + 1, received: turn });
    }
    const release = held.value;
    const stream = yield* startTurn(sessionId, turn, action).pipe(Effect.onError(() => release));
    return stream.pipe(Stream.ensuring(release));
  },
  (effect, sessionId, turn) => effect.pipe(Effect.annotateLogs({ sessionId, turn })),
);

/** Everything a turn does once it holds the session's lock. */
const startTurn = Effect.fnUntraced(
  function* (sessionId: Story.SessionId, turn: number, action: string) {
    const { maxTurns } = yield* Rules;
    const store = yield* StoryStore;
    const budget = yield* Budget;
    const narrator = yield* Narrator;

    const state = yield* openStory(sessionId);
    if (state.ended || state.turns.length >= maxTurns) {
      return yield* new StoryEnded({ turns: state.turns.length });
    }
    if (state.turns.length !== turn) {
      return yield* new TurnConflict({ expected: state.turns.length, received: turn });
    }
    yield* budget.spend;

    const turnIndex = Story.nextTurnIndex(state);
    const isFinalTurn = turnIndex === maxTurns;

    /**
     * One attempt at a scene, streamed.
     *
     * Prose is emitted the moment it arrives and accumulated on the side, because the
     * judgement that follows reads the finished text. The settled form (the answers,
     * the reading, the saved turn) is emitted at the end as two more events.
     *
     * Fails with `OutOfFiction` when the prose slipped, which is the caller's signal to
     * discard what the reader has seen and try once more.
     */
    const attempt = (
      strict: boolean,
    ): Stream.Stream<TurnEvent, AppError | OutOfFiction, QuestionModel> =>
      Stream.unwrap(
        Effect.gen(function* () {
          const collected = yield* Ref.make("");
          const messages = Prompt.build(state, action, { isFinalTurn, strictReminder: strict });

          const prose = narrator.narrateStream(messages).pipe(
            Stream.tap((chunk) => Ref.update(collected, (text) => text + chunk)),
            withoutOptionsMarker,
            Stream.map((text): TurnEvent => ({ _tag: "chunk", text })),
          );

          const settle = Effect.gen(function* () {
            const { narration, optionsBlock } = splitOptions(yield* Ref.get(collected));
            // Nothing to judge or keep: saving it would leave a blank scene in the story.
            if (narration.length === 0) {
              return yield* new NarratorError({ message: "the narrator returned empty prose" });
            }
            const drafted = parseOptions(optionsBlock);
            const judgement = yield* Oracle.judge(Oracle.stateFor(state, action, narration, drafted));
            const optionsSoundNoul = judgement.answers.optionsSound.noul;
            const options = soundOptions(drafted, optionsSoundNoul);
            if (drafted.length > 0 && options.length === 0) {
              yield* Effect.log("dropped the drafted options: ungrounded or out of character").pipe(
                Effect.annotateLogs({ optionsSoundNoul, drafted }),
              );
            }
            const answers = toStored(judgement.answers);
            // The raw answer travels with the turn so the reading panel can show what
            // Jev weighed, not just what it picked. `answers` stays the persisted,
            // catalog-tolerant form used to re-resolve the decision later.
            const reading: JevReading = {
              location: raw(judgement.answers.location),
              beat: raw(judgement.answers.beat),
              mood: raw(judgement.answers.mood),
              danger: {
                score: judgement.answers.danger.score,
                confidence: judgement.answers.danger.confidence,
                probabilities: { ...judgement.answers.danger.probabilities },
              },
              inFiction: { noul: judgement.answers.inFiction.noul },
              arcStage: {
                score: judgement.answers.arcStage.score,
                confidence: judgement.answers.arcStage.confidence,
                probabilities: { ...judgement.answers.arcStage.probabilities },
              },
              companion: raw(judgement.answers.companion),
              latencyMs: judgement.latencyMs,
              inputTokens: judgement.inputTokens,
            };
            if (answers.inFiction.noul < Decision.inFictionThreshold) {
              return yield* new OutOfFiction({
                narration,
                answers,
                reading,
                noul: answers.inFiction.noul,
              });
            }

            const decision = Decision.resolve(answers);
            const saved = Story.appendTurn(
              state,
              { action, narration, answers, decision, at: yield* now },
              maxTurns,
            );
            yield* store.save(saved);
            return {
              reading,
              options,
              result: {
                decision,
                text: narration,
                reading,
                chapter: saved.chapter,
                arcStageReached: saved.arcStageReached,
                turn: saved.turns.length,
                turnsRemaining: Story.turnsRemaining(saved, maxTurns),
                ended: saved.ended,
                sceneDanger: saved.sceneDanger,
                tension: saved.tension,
                morality: saved.morality,
                gold: saved.gold,
                affection: saved.affection,
              } satisfies TurnResult,
            };
          });

          // The reading goes out before the save settles so the panel lights up as
          // soon as Jev has spoken, rather than waiting on the store round trip.
          const tail = Stream.fromEffect(settle).pipe(
            Stream.flatMap(({ reading, options, result }) =>
              Stream.fromIterable<TurnEvent>([
                { _tag: "reading", reading },
                { _tag: "options", options },
                { _tag: "saved", result },
              ]),
            ),
          );

          return Stream.concat(prose, tail);
        }),
      );

    /**
     * Settles a slip that has already been retried once: the prose is kept and the
     * turn is saved anyway, because a third attempt would only spend another scene's
     * worth of tokens to say the same thing again.
     */
    const keepAnyway = (
      slip: OutOfFiction,
    ): Effect.Effect<TurnEvent, AppError, QuestionModel> =>
      Effect.gen(function* () {
        yield* Effect.log("narration left the fiction twice; keeping it").pipe(
          Effect.annotateLogs({ noul: slip.noul }),
        );
        const decision = Decision.resolve(slip.answers);
        const saved = Story.appendTurn(
          state,
          {
            action,
            narration: slip.narration,
            answers: slip.answers,
            decision,
            at: yield* now,
          },
          maxTurns,
        );
        yield* store.save(saved);
        return { _tag: "saved", result: {
          decision,
          text: slip.narration,
          reading: slip.reading,
          chapter: saved.chapter,
          arcStageReached: saved.arcStageReached,
          turn: saved.turns.length,
          turnsRemaining: Story.turnsRemaining(saved, maxTurns),
          ended: saved.ended,
          sceneDanger: saved.sceneDanger,
          tension: saved.tension,
          morality: saved.morality,
          gold: saved.gold,
          affection: saved.affection,
        } } satisfies TurnEvent;
      });

    // First attempt, then one rewrite if the fiction was broken. The reader has already
    // seen the rejected prose, so `reset` tells the client to clear it before the
    // replacement streams in.
    //
    // `OutOfFiction` is internal (it is deliberately absent from `AppError`), so the two
    // handlers are composed with `Stream.catchAll` and re-raised unless they match.
    const firstPass = attempt(false).pipe(
      Stream.catchAll((error): Stream.Stream<TurnEvent, AppError | OutOfFiction, QuestionModel> => {
        if (error._tag !== "OutOfFiction") return Stream.fail(error);
        return Stream.concat(
          Stream.succeed<TurnEvent>({ _tag: "reset" }),
          Stream.fromEffect(
            Effect.log("narration left the fiction; rewriting").pipe(
              Effect.annotateLogs({ noul: error.noul }),
            ),
          ).pipe(Stream.drain, Stream.concat(attempt(true))),
        );
      }),
    );

    return firstPass.pipe(
      Stream.catchAll((error): Stream.Stream<TurnEvent, AppError, QuestionModel> => {
        if (error._tag !== "OutOfFiction") return Stream.fail(error);
        return Stream.fromEffect(keepAnyway(error));
      }),
    );
  },
);

/**
 * The whole turn, joined from the stream.
 *
 * Kept for callers that want only the finished turn — the tests, and anything that has
 * no reader watching. Streaming callers use `playTurnStream` directly.
 */
export const playTurn = (
  sessionId: Story.SessionId,
  turn: number,
  action: string,
) => {
  return Effect.gen(function* () {
    const stream = yield* playTurnStream(sessionId, turn, action);
    const saved = yield* Ref.make(Option.none<TurnResult>());
    yield* Stream.runForEach(stream, (event) =>
      event._tag === "saved" ? Ref.set(saved, Option.some(event.result)) : Effect.void,
    );
    const found = yield* Ref.get(saved);
    return yield* Option.match(found, {
      onNone: () => Effect.die("playTurnStream produced no saved event"),
      onSome: (result) => Effect.succeed(result),
    });
  });
};
