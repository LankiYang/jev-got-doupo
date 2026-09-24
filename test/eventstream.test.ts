import { Effect, Stream } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoryEnded } from "@/core/Errors";
import { eventStream } from "@/server/eventStream";

const decoder = new TextDecoder();

const readAll = async (body: ReadableStream<Uint8Array>): Promise<ReadonlyArray<unknown>> => {
  const reader = body.getReader();
  let text = "";
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    text += decoder.decode(read.value, { stream: true });
  }
  return text
    .split("\n\n")
    .filter((frame) => frame.startsWith("data: "))
    .map((frame) => JSON.parse(frame.slice("data: ".length)));
};

let unhandled: Array<unknown> = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);

beforeEach(() => {
  unhandled = [];
  process.on("unhandledRejection", onUnhandled);
});

afterEach(() => {
  process.off("unhandledRejection", onUnhandled);
});

describe("eventStream", () => {
  it("frames every event and closes when the stream ends", async () => {
    const events = await readAll(
      eventStream(Stream.make({ _tag: "chunk", text: "你" }, { _tag: "reset" }), Effect.runFork),
    );

    expect(events).toEqual([{ _tag: "chunk", text: "你" }, { _tag: "reset" }]);
  });

  it("reports a failure past the first byte by its error code", async () => {
    const failing = Stream.concat(
      Stream.make({ _tag: "chunk", text: "你" }),
      Stream.fail(new StoryEnded({ turns: 15 })),
    );
    const events = await readAll(eventStream(failing, Effect.runFork));

    expect(events).toEqual([{ _tag: "chunk", text: "你" }, { _tag: "error", cause: "story_ended" }]);
  });

  it("stops the work and runs its finalizers when the reader goes away", async () => {
    let finalized = false;
    const endless = Stream.concat(Stream.make({ _tag: "chunk", text: "你" }), Stream.never).pipe(
      Stream.ensuring(
        Effect.sync(() => {
          finalized = true;
        }),
      ),
    );
    const reader = eventStream(endless, Effect.runFork).getReader();

    await reader.read();
    await reader.cancel("closed the tab");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(finalized).toBe(true);
    expect(unhandled).toEqual([]);
  });
});
