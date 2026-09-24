import { Context, Duration, Effect, HashMap, Layer, Option, Ref } from "effect";
import type { StoryCorrupt } from "@/core/Errors";
import type { SessionId } from "@/core/Story";

/**
 * One turn at a time per session.
 *
 * The turn-number check alone only keeps *sequential* requests honest: two requests
 * that arrive together both read the same story, both pass, and the later save
 * silently drops the earlier turn. Holding this for the whole turn makes the second
 * request a `TurnConflict` before it spends anything.
 */
export interface TurnLockService {
  /** The release for this hold, or `None` when another turn already holds the session. */
  readonly acquire: (id: SessionId) => Effect.Effect<Option.Option<Effect.Effect<void>>, StoryCorrupt>;
}

export class TurnLock extends Context.Tag("story-effect/TurnLock")<TurnLock, TurnLockService>() {}

/**
 * Longer than the slowest turn a request can run: two narrator attempts and two Jev
 * readings with their retries. It only matters when a release never runs (a process
 * killed mid-turn), so the session is not stuck behind a holder that is gone.
 */
export const holdFor = Duration.minutes(3);

/** Stories in this process only, so the lock can be too. */
export const layerMemory: Layer.Layer<TurnLock> = Layer.effect(
  TurnLock,
  Effect.gen(function* () {
    const held = yield* Ref.make(HashMap.empty<SessionId, string>());

    const acquire = (id: SessionId) =>
      Effect.gen(function* () {
        const token = crypto.randomUUID();
        const granted = yield* Ref.modify(held, (current) =>
          HashMap.has(current, id)
            ? ([false, current] as const)
            : ([true, HashMap.set(current, id, token)] as const),
        );
        if (!granted) return Option.none();
        const release = Ref.update(held, (current) =>
          Option.contains(HashMap.get(current, id), token) ? HashMap.remove(current, id) : current,
        );
        return Option.some(release);
      });

    const service: TurnLockService = { acquire };
    return service;
  }),
);
