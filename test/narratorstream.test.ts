import { Effect, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { sceneText } from "@/core/providers/OpenRouter";

const encoder = new TextEncoder();

/** A completion body as OpenRouter streams it, one SSE line per piece. */
const body = (...lines: ReadonlyArray<string>) =>
  Stream.fromIterable(lines.map((line) => encoder.encode(`${line}\n\n`)));

const delta = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`;

const run = <E>(bytes: Stream.Stream<Uint8Array, E>) =>
  Effect.runPromise(Effect.either(Stream.runCollect(sceneText(bytes, "1 second"))));

describe("OpenRouter.sceneText", () => {
  it("lifts the prose out of the stream and drops keep-alives and [DONE]", async () => {
    const outcome = await run(
      body(
        ": OPENROUTER PROCESSING",
        delta("你握紧"),
        `data: ${JSON.stringify({ choices: [{ delta: {} }] })}`,
        delta("拳头。"),
        "data: [DONE]",
      ),
    );

    expect(outcome._tag).toBe("Right");
    if (outcome._tag === "Right") expect([...outcome.right].join("")).toBe("你握紧拳头。");
  });

  it("fails the scene on an error reported after the stream began", async () => {
    const outcome = await run(
      body(
        delta("你握紧"),
        `data: ${JSON.stringify({
          error: { code: "server_error", message: "Provider disconnected unexpectedly" },
          choices: [{ delta: { content: "" }, finish_reason: "error" }],
        })}`,
      ),
    );

    expect(outcome._tag).toBe("Left");
    if (outcome._tag === "Left") expect(outcome.left.message).toContain("Provider disconnected");
  });

  it("fails a scene that goes quiet rather than keeping the half that arrived", async () => {
    const stalled = Stream.concat(body(delta("你握紧")), Stream.never);
    const outcome = await Effect.runPromise(
      Effect.either(Stream.runCollect(sceneText(stalled, "50 millis"))),
    );

    expect(outcome._tag).toBe("Left");
    if (outcome._tag === "Left") expect(outcome.left._tag).toBe("NarratorError");
  });
});
