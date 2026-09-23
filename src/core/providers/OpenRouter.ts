import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform";
import {
  Config,
  type ConfigError,
  Duration,
  Effect,
  Layer,
  Option,
  type Redacted,
  Schedule,
  Schema,
  Stream,
} from "effect";
import { describeCause, NarratorError } from "@/core/Errors";
import { type Message, Narrator, type NarratorService } from "@/core/Narrator";

export interface Options {
  readonly apiKey: Redacted.Redacted<string>;
  readonly model: string;
}

const endpoint = "https://openrouter.ai/api/v1/chat/completions";

/** How long one scene may take before the turn is abandoned. */
const deadline = Duration.seconds(45);

/** Just enough of OpenRouter's response to lift the prose out of it. Excess keys decode fine. */
const Completion = Schema.Struct({
  choices: Schema.NonEmptyArray(
    Schema.Struct({
      message: Schema.Struct({ content: Schema.String }),
    }),
  ),
});

/**
 * One server-sent event from a streaming completion.
 *
 * Only `content` is read: the role arrives on the first chunk, the finish reason on the
 * last, and usage is not sent unless asked for. A chunk carrying no text (a keep-alive,
 * or the terminal `[DONE]`) decodes to `None` rather than failing, because dropping
 * those is the whole job.
 */
const Chunk = Schema.Struct({
  choices: Schema.Array(
    Schema.Struct({
      delta: Schema.Struct({
        content: Schema.optional(Schema.String),
      }),
    }),
  ),
});

const toNarratorError = (cause: unknown): NarratorError =>
  cause instanceof NarratorError ? cause : new NarratorError({ message: describeCause(cause) });

const body = (model: string, messages: ReadonlyArray<Message>, stream: boolean) => ({
  model,
  messages,
  max_tokens: 500,
  temperature: 0.9,
  reasoning: { effort: "none" },
  stream,
});

/**
 * The live `Narrator`. Status filtering and transient retries are configured once on the
 * client, and everything that can go wrong downstream folds into one `NarratorError`.
 */
export const make = Effect.fn("OpenRouter.make")(function* (options: Options) {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.filterStatusOk,
    HttpClient.retryTransient({ times: 2, schedule: Schedule.exponential("300 millis") }),
  );

  const request = (messages: ReadonlyArray<Message>, stream: boolean) =>
    HttpClientRequest.post(endpoint).pipe(
      HttpClientRequest.bearerToken(options.apiKey),
      HttpClientRequest.bodyJson(body(options.model, messages, stream)),
    );

  const narrate = Effect.fn("Narrator.narrate")(function* (messages: ReadonlyArray<Message>) {
    const response = yield* client.execute(yield* request(messages, false));
    const completion = yield* HttpClientResponse.schemaBodyJson(Completion)(response);
    const prose = completion.choices[0].message.content.trim();
    if (prose.length === 0) {
      return yield* new NarratorError({ message: "the narrator returned empty prose" });
    }
    return prose;
  });

  const narrateStream = (messages: ReadonlyArray<Message>): Stream.Stream<string, NarratorError> => {
    const bytes: Stream.Stream<Uint8Array, unknown> = Stream.unwrap(
      // `HttpClientResponse.stream` takes the *effect*, not the response: it needs to
      // own the request's lifetime in order to cancel the body when the stream ends.
      request(messages, true).pipe(
        Effect.flatMap((req) => client.execute(req)),
        Effect.map((response) => HttpClientResponse.stream(Effect.succeed(response))),
      ),
    );

    return bytes.pipe(
      Stream.decodeText(),
      Stream.splitLines,
      // `filterMap` wants an Option, not a bare value: `undefined` and `null` are
      // legitimate decoded values here, so an Option is the only unambiguous signal.
      Stream.filterMap((line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return Option.none();
        const payload = trimmed.slice("data:".length).trim();
        if (payload.length === 0 || payload === "[DONE]") return Option.none();
        try {
          const parsed: unknown = JSON.parse(payload);
          const decoded = Schema.decodeUnknownOption(Chunk)(parsed);
          if (decoded._tag === "None") return Option.none();
          const text = decoded.value.choices[0]?.delta.content;
          return text ? Option.some(text) : Option.none();
        } catch {
          // A truncated or non-JSON line is not worth failing a scene over.
          return Option.none();
        }
      }),
      Stream.timeout(deadline),
      Stream.mapError(toNarratorError),
    );
  };

  const service: NarratorService = {
    narrate: (messages) =>
      narrate(messages).pipe(Effect.timeout(deadline), Effect.catchAll(toNarratorError)),
    // A stalled scene fails the whole stream, not just the idle stretch: `Stream.timeout`
    // applies to the entire run, so a narrator that stops mid-sentence is abandoned.
    narrateStream,
  };
  return service;
});

export const layer = (options: Options): Layer.Layer<Narrator, never, HttpClient.HttpClient> =>
  Layer.effect(Narrator, make(options));

export const layerConfig = (
  options: Config.Config.Wrap<Options>,
): Layer.Layer<Narrator, ConfigError.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(Narrator, Effect.flatMap(Config.unwrap(options), make));
