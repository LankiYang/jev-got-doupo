import { Context, type Effect, type Stream } from "effect";
import type { NarratorError } from "@/core/Errors";

export interface Message {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

/** Writes the next scene from the messages `Prompt.build` produced. */
export interface NarratorService {
  readonly narrate: (
    messages: ReadonlyArray<Message>,
  ) => Effect.Effect<string, NarratorError>;

  /**
   * The same scene, emitted as it is written rather than all at once.
   *
   * A scene takes several seconds to generate and the reader is staring at nothing for
   * all of them. Streaming lets the first sentence land in well under a second, so the
   * wait is spent reading instead of waiting — which matters more here than anywhere
   * else in the app, because nothing downstream can start until the prose is finished.
   *
   * The stream fails with `NarratorError` exactly as `narrate` does; a caller that only
   * needs the finished text can join it and ignore the chunking.
   */
  readonly narrateStream: (
    messages: ReadonlyArray<Message>,
  ) => Stream.Stream<string, NarratorError>;
}

/** The prose port: `providers/OpenRouter` live, `providers/CannedNarrator` for offline tests. */
export class Narrator extends Context.Tag("story-effect/Narrator")<Narrator, NarratorService>() {}
