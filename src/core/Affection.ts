import type { CompanionId } from "@/core/data/companions";

/**
 * Where each companion's trust in Xiao Yan starts, before anything is played — the
 * relationship the catalog already describes, read onto `Meter`'s 1–100 scale. A
 * mentor or father starts high, a stranger starts near the middle, a declared enemy
 * starts low; play moves every one of them from there.
 */
const baselines: Record<CompanionId, number> = {
  "yao-lao": 70,
  "xiao-zhan": 60,
  "xiao-xun-er": 55,
  "nalan-yanran": 25,
  "xiao-yixian": 45,
  "yun-yun": 45,
  "medusa-queen": 40,
  "yun-shan": 10,
  "yun-ling": 10,
};

export type AffectionState = Readonly<Record<CompanionId, number>>;

export const seed = (): AffectionState => ({ ...baselines });

/** Total read: a companion the catalog has since dropped falls back to the middle. */
export const of = (state: Readonly<Record<string, number>>, id: string): number => {
  const value = state[id];
  return typeof value === "number" && Number.isFinite(value) ? value : 50;
};
