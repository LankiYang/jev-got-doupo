/**
 * A running 1–100 gauge, moved by a two-step reading: `direction` says whether it rose
 * or fell, `magnitude` says by how much. Kept separate from `Danger`'s single rubric
 * read fresh each scene — a gauge instead carries forward and only ever moves relative
 * to where it already was, so it needs a sign as well as a size.
 */

/** Every gauge lives on this scale; a stored value from before a gauge existed seeds here. */
export const min = 1;
export const max = 100;

export const clamp = (value: number): number => Math.min(max, Math.max(min, Math.round(value)));

/** Above this, `direction`'s noul reads as a rise rather than a fall. */
export const riseThreshold = 0.5;

/**
 * How far a `magnitude` question's rounded rubric level moves a 1–100 gauge, in points.
 * Nonlinear on purpose: the gap between "barely" and "slightly" should read as smaller
 * than the gap between "a lot" and "drastically", the same way `Danger`'s levels are not
 * evenly spaced in how much they change the story.
 */
const stepPoints: ReadonlyArray<number> = [0, 3, 8, 15, 25];

/**
 * `gold`'s buckets, in coins — the values Jev picks between and the amounts they mean
 * are the same thing, because a coin count cannot be read off a five-level "how big was
 * the change" rubric. A 50-coin sale is not a "轻微变化"; measured against the generic
 * rubric it read as level 1 (+8), which is the bug this ladder exists to fix.
 *
 * Dense at the low end (steps of 2 up to 20, where early play actually lives), coarsening
 * as the amounts grow and the exact coin stops mattering (steps of 200 past 1000). 45
 * rungs.
 *
 * Measured against a battery of known amounts, this beats both alternatives that were
 * tried: the 15-rung ladder it replaces (total absolute error 21 vs 92 on one batch,
 * 29 vs 80 on another; 10-12 of 12 exact vs 1-2), and a 154-rung ladder, which was
 * *worse* than this one (31 vs 29) — past a point the model dithers between near
 * neighbours instead of committing. `choice` caps at 255 rungs (a 256th is an HTTP 400),
 * so the ceiling is not the constraint here; precision is.
 *
 * Costs roughly 680 more input tokens per turn than the 15-rung version, against one
 * Jev request per turn — a trade taken for the accuracy above.
 */
export const goldLadder: ReadonlyArray<number> = [
  0, 2, 4, 6, 8, 10, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100,
  120, 140, 160, 180, 200, 240, 280, 320, 360, 400, 450, 500, 560, 620, 700, 800,
  900, 1000, 1200, 1400, 1600, 1900, 2200, 2600,
];

/** The `choice` label for each rung; gold's questions are keyed by these strings. */
export const goldLadderCriteria: Record<string, string> = Object.fromEntries(
  goldLadder.map((coins) =>
    coins === 0
      ? ["0", "没有金钱往来：这一幕里没有任何金币进出，或正文根本没提到任何数目。"]
      : [String(coins), `约 ${coins} 枚金币`],
  ),
);

/** One rung of the ladder: the label Jev picked, read back as a coin amount. */
export const goldOf = (label: string): number => {
  const coins = Number(label);
  return Number.isFinite(coins) && goldLadder.includes(coins) ? coins : 0;
};

/**
 * Rubric levels shared by every gauge's magnitude question, indexed 0–4. What "a
 * change" means is supplied by each question's own instructions; this only describes
 * how big one is.
 */
export const magnitudeCriteria = [
  "几乎没有变化：这件事和它基本无关，或分量太轻，不足以真正移动它。",
  "轻微变化：有一点分量，但还不足以真正改变态度或处境。",
  "明显变化：一次真正被感受到的转折——一句真心话、一次被看见的举动。",
  "较大变化：一次实质的考验、承诺或伤害，分量足以留下印记。",
  "剧烈变化：彻底扭转局面的一刻，不会被下一场戏轻易抹平。",
] as const;

/** Turn a direction/magnitude pair into a signed point delta, ready to add and clamp. */
export const deltaOf = (riseNoul: number, magnitudeScore: number): number => {
  const level = Math.min(stepPoints.length - 1, Math.max(0, Math.round(magnitudeScore)));
  const size = stepPoints[level];
  if (size === 0) return 0;
  return riseNoul >= riseThreshold ? size : -size;
};

/** Add a delta and clamp to the gauge's 1–100 range. */
export const apply = (current: number, delta: number): number => clamp(current + delta);

/**
 * Coarse descriptive bands for a 1–100 gauge, for the narrator prompt: it gets a sense
 * of the story so far, never the raw number — the rest of `Prompt.ts` never speaks in
 * scores either.
 */
export type Band = "very-low" | "low" | "mid" | "high" | "very-high";

export const bandOf = (value: number): Band => {
  if (value < 20) return "very-low";
  if (value < 40) return "low";
  if (value < 60) return "mid";
  if (value < 80) return "high";
  return "very-high";
};
