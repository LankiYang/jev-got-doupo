import { Effect, Stream } from "effect";
import { InvalidRequest } from "@/core/Errors";
import * as StoryEngine from "@/core/StoryEngine";
import { eventStream } from "@/server/eventStream";
import { callerOf, RateLimiter } from "@/server/RateLimiter";
import { runtime as appRuntime } from "@/server/runtime";
import { respond } from "@/server/respond";
import { decodeSessionId, decodeTurnRequest } from "@/server/schemas";
import * as views from "@/server/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readJson = (request: Request) =>
  Effect.tryPromise({
    try: (): Promise<unknown> => request.json(),
    catch: () => new InvalidRequest({ message: "the request body must be JSON" }),
  });

/**
 * One server-sent event, shaped for the wire.
 *
 * `saved` carries `StoryEngine.TurnResult` — catalog ids, `decision` nested — which is
 * an internal shape the client has never been able to read. `views.turn` is the same
 * resolver the pre-streaming response used: real names, a resolved backdrop, `chapter`
 * as a printable title and goal instead of a bare id. Every other event is already
 * client-shaped and passes through untouched.
 */
const toWire = (event: StoryEngine.TurnEvent) =>
  event._tag === "saved" ? { _tag: "saved" as const, result: views.turn(event.result) } : event;

/**
 * Streams a turn as it is written.
 *
 * A scene takes several seconds to generate and the reader used to stare at nothing for
 * all of them. Emitting prose as it arrives puts the first sentence on screen in well
 * under a second; Jev's reading follows once the scene is whole, and the `saved` event
 * closes the turn with the ids the page reacts to.
 *
 * Failures past the first byte are reported inside the stream (see `eventStream`). A
 * failure before it is still a normal JSON error response.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  // `yield*` on the turn itself: the session, the turn number and the budget all
  // resolve inside this program, before a single byte is written, so the response can
  // still be a plain error when they fail.
  const program = Effect.gen(function* () {
    const sessionId = yield* decodeSessionId(id);
    const limiter = yield* RateLimiter;
    yield* limiter.check(callerOf(request.headers));
    const { action, turn } = yield* decodeTurnRequest(yield* readJson(request));
    return yield* StoryEngine.playTurnStream(sessionId, turn, action);
  });

  const exit = await appRuntime.runPromiseExit(program);

  if (exit._tag === "Failure") {
    return respond(exit);
  }

  const body = eventStream(Stream.map(exit.value, toWire), (effect) => appRuntime.runFork(effect));

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Stops a proxy from buffering the stream back into one lump.
      "x-accel-buffering": "no",
    },
  });
}
