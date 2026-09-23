import { FetchHttpClient } from "@effect/platform";
import { Config, Layer } from "effect";
import * as Budget from "@/core/Budget";
import * as MemoryStore from "@/core/providers/MemoryStore";
import * as OpenRouter from "@/core/providers/OpenRouter";
import * as RedisStore from "@/core/providers/RedisStore";
import * as TypeSafe from "@/core/providers/TypeSafe";
import * as Rules from "@/core/Rules";
import * as RateLimiter from "@/server/RateLimiter";

/** Per-attempt timeout for a Jev request, in milliseconds. */
const typeSafeTimeout = Config.integer("TYPESAFE_TIMEOUT_MS").pipe(Config.withDefault(10_000));

/**
 * The whole application, assembled once. `Layer.orDie` makes the runtime's error channel
 * `never`: a missing key or an unusable Redis URL is a boot failure, which
 * `src/instrumentation.ts` turns into a start-up crash.
 */
export const AppLive = Layer.mergeAll(
  TypeSafe.layerConfig({
    apiKey: Config.redacted("TYPESAFE_API_KEY"),
    model: Config.string("TYPESAFE_MODEL").pipe(Config.withDefault("jev-latest")),
    timeoutMillis: typeSafeTimeout,
  }),
  OpenRouter.layerConfig({
    apiKey: Config.redacted("OPENROUTER_API_KEY"),
    model: Config.string("OPENROUTER_MODEL").pipe(Config.withDefault("openai/gpt-5.6-luna")),
  }),
  // Redis is the intended store, but a local run should not require Docker.
  // Setting MEMORY_STORE=1 swaps in the in-process store, which is built from
  // the same Schema so nothing above this line changes. Stories then live only
  // as long as the process, which is fine for a single-machine demo.
  ...(process.env.MEMORY_STORE === "1" ? [MemoryStore.layer] : [RedisStore.layerConfig]),
  Budget.layerConfig({
    maxTurnsPerDay: Config.integer("MAX_TURNS_PER_DAY").pipe(Config.withDefault(500)),
  }),
  Rules.layerConfig({
    // Effectively unbounded: nobody will play 100,000 turns, so this exists to keep
    // `ended`/`turnsRemaining` well-defined rather than to stop anyone.
    maxTurns: Config.integer("MAX_TURNS").pipe(Config.withDefault(100_000)),
  }),
  RateLimiter.layerConfig,
).pipe(Layer.provide(FetchHttpClient.layer), Layer.orDie);

/** Everything a Route Handler may ask for. */
export type AppServices = Layer.Layer.Success<typeof AppLive>;
