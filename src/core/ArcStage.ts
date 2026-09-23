import { Schema } from "effect";

/**
 * Where a scene sits in its chapter's 起承转合 (setup, development, turn, resolution).
 *
 * Ordered, like `Danger`: Jev returns an expectation over the rubric, not a bare label,
 * because a scene is rarely purely one stage. Judged against `story.chapter_goal` and
 * `story.recent`, never against the scene alone — calibration against real scenes
 * showed a resolution misread as a setup when nothing established what it was resolving.
 */
export const levels = [
  {
    id: "setup",
    description: "起：铺开处境——建立地点、气氛与眼下的问题，压力还没有真正落在萧炎身上。",
  },
  {
    id: "development",
    description:
      "承：处境展开——萧炎开始行动或应对，细节、人物、牵连在累积，但还没有到摊牌的时刻。",
  },
  {
    id: "turn",
    description: "转：转折——压力兑现成一个抉择、冲突或揭示，事情不能再照旧下去了。",
  },
  {
    id: "resolution",
    description:
      "合：收束——本章的目标（`story.chapter_goal`）这条线索有了结果，即使新的悬念已经在远处生出。",
  },
] as const;

/** The rubric as the SDK wants it: descriptions indexed by score from zero. */
export const criteria = [
  levels[0].description,
  levels[1].description,
  levels[2].description,
  levels[3].description,
] as const;

export type ArcStageId = (typeof levels)[number]["id"];

const ids: ReadonlyArray<string> = levels.map((level) => level.id);

export const isArcStageId = (value: unknown): value is ArcStageId =>
  typeof value === "string" && ids.includes(value);

export const ArcStageId = Schema.String.pipe(
  Schema.filter(isArcStageId, { identifier: "ArcStageId" }),
);

/** Where a chapter with no reading yet — the turn it opens on — starts. */
export const fallback: ArcStageId = "setup";

/** A stored id is a total read: one from before this build's rubric existed falls back
 *  rather than throwing, the same way `Chapter.resolve` does. */
export const resolve = (id: unknown): ArcStageId => (isArcStageId(id) ? id : fallback);

/** Jev's score is an expectation rather than an index, so it is rounded and clamped. */
export const fromScore = (score: number): ArcStageId => {
  if (!Number.isFinite(score)) return fallback;
  const index = Math.min(levels.length - 1, Math.max(0, Math.round(score)));
  return levels[index].id;
};

const order: Record<ArcStageId, number> = Object.fromEntries(
  levels.map((level, index) => [level.id, index]),
) as Record<ArcStageId, number>;

/** For the ratchet in `Story.appendTurn`: a chapter's stage only ever moves forward. */
export const furthest = (a: ArcStageId, b: ArcStageId): ArcStageId =>
  order[a] >= order[b] ? a : b;

export const isResolution = (id: ArcStageId): boolean => id === "resolution";
