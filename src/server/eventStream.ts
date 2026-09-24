import { Cause, Effect, Fiber, Option, Stream } from "effect";
import type { AppError } from "@/core/Errors";
import { codeOf } from "@/server/respond";

/** Starts an effect in the app runtime; `ManagedRuntime.runFork`, or `Effect.runFork` in tests. */
export type Fork<R> = (effect: Effect.Effect<void, never, R>) => Fiber.RuntimeFiber<void, never>;

/**
 * Serves a stream of client-shaped events as server-sent events.
 *
 * The status is committed to 200 by the first byte, so a failure after it is sent
 * in-band as `{ _tag: "error", cause }`, where `cause` is the same `error` code a status
 * response would carry: the client branches on `turn_conflict` or `story_ended` the
 * same way whichever route the failure took. A defect is logged here and reaches the
 * browser only as `internal`.
 *
 * A reader that goes away cancels the body, and that interrupts the stream: whatever it
 * was doing upstream stops, and its finalizers run. Nothing is written after that.
 */
export const eventStream = <R>(
  events: Stream.Stream<unknown, AppError, R>,
  fork: Fork<R>,
): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let fiber: Fiber.RuntimeFiber<void, never> | undefined;
  let open = true;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const stop = (): void => {
        if (!open) return;
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed or errored by the reader's side; there is nothing left to end.
        }
      };

      const send = (event: unknown): void => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // The body closed without `cancel` reaching us: nobody is reading any more.
          open = false;
          if (fiber !== undefined) fiber.unsafeInterruptAsFork(fiber.id());
        }
      };

      const run = Stream.runForEach(events, (event) => Effect.sync(() => send(event))).pipe(
        Effect.catchAllCause((cause) =>
          Effect.sync(() => {
            if (Cause.isInterruptedOnly(cause)) return;
            Option.match(Cause.failureOption(cause), {
              onNone: () => {
                console.error(Cause.pretty(cause));
                send({ _tag: "error", cause: "internal" });
              },
              onSome: (error) => send({ _tag: "error", cause: codeOf(error) }),
            });
          }),
        ),
        Effect.ensuring(Effect.sync(stop)),
      );

      fiber = fork(run);
    },

    cancel() {
      open = false;
      if (fiber !== undefined) return Effect.runPromise(Fiber.interrupt(fiber)).then(() => undefined);
    },
  });
};
