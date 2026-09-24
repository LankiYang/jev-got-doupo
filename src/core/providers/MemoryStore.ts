import { KeyValueStore } from "@effect/platform";
import { Layer } from "effect";
import type { StoryStore } from "@/core/StoryStore";
import { layerOver } from "@/core/providers/KeyValueStoryStore";
import { layerMemory as turnLockMemory, type TurnLock } from "@/core/TurnLock";

/** Stories in a map, encoded through the same Schema the Redis store uses. */
export const layer: Layer.Layer<StoryStore | TurnLock> = Layer.merge(
  layerOver(KeyValueStore.layerMemory),
  turnLockMemory,
);
