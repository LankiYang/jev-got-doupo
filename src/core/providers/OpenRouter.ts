import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform";
import {
  Config,
  type ConfigError,
  Duration,
  Effect,
  Either,
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

/**
 * How long one scene may take before the turn is abandoned; for a streamed scene, how
 * long it may go without a new piece.
 */
const deadline = Duration.seconds(45);

/** Just enough of OpenRouter's response to lift the prose out of it. Excess keys decode fine. */
const Completion = Schema.Struct({
  choices: Schema.NonEmptyArray(
    Schema.Struct({
      message: Schema.Struct({ content: Schema.String }),
    }),
  ),
});

const toNarratorError = (cause: unknown): NarratorError =>
  cause instanceof NarratorError ? cause : new NarratorError({ message: describeCause(cause) });

/**
 * One server-sent event from a streaming completion.
 *
 * Only `content` is read for prose: the role arrives on the first chunk, the finish
 * reason on the last, and usage is not sent unless asked for. A chunk carrying no text
 * (a keep-alive, or the terminal `[DONE]`) is dropped, because that is the whole job.
 *
 * An upstream failure after the response has begun cannot change the status any more,
 * so OpenRouter reports it in-band: a top-level `error`, and `finish_reason: "error"`.
 * Either one fails the scene rather than passing off whatever arrived as all of it.
 */
const Chunk = Schema.Struct({
  error: Schema.optional(Schema.Struct({ message: Schema.optional(Schema.String) })),
  choices: Schema.optionalWith(
    Schema.Array(
      Schema.Struct({
        delta: Schema.optionalWith(
          Schema.Struct({ content: Schema.optional(Schema.NullOr(Schema.String)) }),
          { default: () => ({}) },
        ),
        finish_reason: Schema.optional(Schema.NullOr(Schema.String)),
      }),
    ),
    { default: () => [] },
  ),
});

/** The prose one SSE line carries, if any; a failure when the line reports one. */
const readLine = (line: string): Either.Either<Option.Option<string>, NarratorError> => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return Either.right(Option.none());
  const payload = trimmed.slice("data:".length).trim();
  if (payload.length === 0 || payload === "[DONE]") return Either.right(Option.none());
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    // A truncated or non-JSON line is not worth failing a scene over.
    return Either.right(Option.none());
  }
  const decoded = Schema.decodeUnknownOption(Chunk)(parsed);
  if (Option.isNone(decoded)) return Either.right(Option.none());
  const chunk = decoded.value;
  const choice = chunk.choices[0];
  if (chunk.error !== undefined || choice?.finish_reason === "error") {
    const reason = chunk.error?.message ?? "the narrator stream reported an error";
    return Either.left(new NarratorError({ message: reason }));
  }
  const text = choice?.delta.content;
  return Either.right(text ? Option.some(text) : Option.none());
};

/**
 * The prose inside a streaming completion's body.
 *
 * `quietFor` is how long the narrator may go without a new piece. A stall *fails* the
 * scene: `Stream.timeout` would end it successfully instead, and the half-written text
 * would be judged and saved as though it were the whole scene.
 */
export const sceneText = <E>(
  bytes: Stream.Stream<Uint8Array, E>,
  quietFor: Duration.DurationInput = deadline,
): Stream.Stream<string, NarratorError> =>
  bytes.pipe(
    Stream.decodeText(),
    Stream.splitLines,
    Stream.mapEffect(readLine),
    Stream.filterMap((text) => text),
    Stream.timeoutFail(
      () =>
        new NarratorError({
          message: `the narrator went quiet for ${Duration.format(Duration.decode(quietFor))}`,
        }),
      quietFor,
    ),
    Stream.mapError(toNarratorError),
  );

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

    return sceneText(bytes);
  };

  const service: NarratorService = {
    narrate: (messages) =>
      narrate(messages).pipe(Effect.timeout(deadline), Effect.catchAll(toNarratorError)),
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
