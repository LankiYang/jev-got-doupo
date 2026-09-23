/** Seed shapes for the catalogs; `Location.ts`, `Beat.ts` and `Mood.ts` derive their Schemas from them. */

export const regions = [
  "乌坦城",
  "加玛帝国",
  "魔兽山脉",
  "云岚宗",
  "大陆远方",
] as const;

export type Region = (typeof regions)[number];

export interface LocationSeed {
  /** Stable kebab-case id; the literal union of these is `LocationId`. */
  readonly id: string;
  readonly name: string;
  readonly region: Region;
  /** Filename stem of this location's backdrop under `public/scenes/`. */
  readonly background: string;
  /** One line, at most 15 words: what Jev sees as the option description. */
  readonly summary: string;
  /** Lore paragraph for the narrator prompt. */
  readonly description: string;
  /** Aliases a player or the prose might use ("the capital"); empty for most. */
  readonly also_called: readonly string[];
  /** Ids of plausible next places; context for the narrator, never a constraint. */
  readonly adjacent: readonly string[];
  /** Parent location id for city sub-places (the training ground sits within the manor). */
  readonly within?: string;
}

export interface BeatSeed {
  readonly id: string;
  readonly name: string;
  /** What Jev sees as the option description. */
  readonly definition: string;
  readonly example: string;
  /** Backdrop stem under `public/scenes/`, for the beats that are the scene rather than a thing inside one. */
  readonly background?: string;
}

export interface MoodSeed {
  /** Also the track name: `/music/<id>.mp3`. */
  readonly id: string;
  /** Same-shaped criteria for Jev: what the mood feels like in the prose. */
  readonly feel: string;
  /** Two or three canonical moments from the story. */
  readonly examples: readonly string[];
}

export interface ChapterSeed {
  readonly id: string;
  readonly title: string;
  /** One line: what this chapter's arc is about, shown to the reader and to Jev alike. */
  readonly goal: string;
  /** Loose scenery for the narrator, never a gate — chapters advance on `arcStage`. */
  readonly locations: readonly string[];
}

export interface CompanionSeed {
  readonly id: string;
  readonly name: string;
  /** What Jev sees as the option description. */
  readonly description: string;
}
