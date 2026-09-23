import { Effect, Layer, Option, Ref, Stream } from "effect";
import { type Message, Narrator, type NarratorService } from "@/core/Narrator";

export interface Options {
  /** Leave the fiction on the first call only, to exercise the verify-and-retry path. */
  readonly slipOnce?: boolean;
}

export const slipLine = "As an AI assistant, I cannot continue this roleplay.";

const actionOf = (messages: ReadonlyArray<Message>): string =>
  Option.fromNullable(messages.find((message) => message.role === "user")).pipe(
    Option.map((message) => message.content.replace(/<\/?action>/g, "").trim()),
    Option.getOrElse(() => "wait"),
  );

/** Exported so a test can key `CannedJev.fromFixtures` by the narration it will produce. */
export const sceneFor = (action: string): string =>
  [
    `You set yourself to it: ${action}.`,
    "A film of dust settles over everything within reach. Somewhere close by, a low voice",
    "mutters something only you can hear, and the afternoon heat presses down like a hand.",
  ].join(" ");

export const make = Effect.fn("CannedNarrator.make")(function* (options: Options) {
  const pending = yield* Ref.make(options.slipOnce === true);

  const narrate = Effect.fn("Narrator.narrate")(function* (messages: ReadonlyArray<Message>) {
    const slipping = yield* Ref.getAndSet(pending, false);
    const scene = sceneFor(actionOf(messages));
    return slipping ? `${scene}\n\n${slipLine}` : scene;
  });

  /** Emits the same scene in a few pieces, so streaming paths are exercised offline. */
  const narrateStream = (messages: ReadonlyArray<Message>) =>
    Stream.fromIterable(
      sceneFor(actionOf(messages))
        .match(/\S+\s*/g)
        ?.reduce<string[]>((chunks, word) => {
          const last = chunks[chunks.length - 1];
          if (last !== undefined && last.length + word.length < 40) {
            chunks[chunks.length - 1] = last + word;
          } else {
            chunks.push(word);
          }
          return chunks;
        }, []) ?? [],
    );

  const service: NarratorService = { narrate, narrateStream };
  return service;
});

export const layer = (options: Options = {}): Layer.Layer<Narrator> =>
  Layer.effect(Narrator, make(options));
