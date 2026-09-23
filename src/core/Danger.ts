import { Schema } from "effect";

/** The danger rubric, ordered from zero upward: an entry's index is the score Jev returns. */
export const levels = [
  {
    id: "safe",
    description: "安全：萧炎的身体没有受到威胁——身处朋友之间，或独自在某个稳妥之处。",
  },
  {
    id: "uneasy",
    description:
      "不安：有威胁正在窥视或隐然存在——敌意的目光、恶劣的天气、尚未爆发的对峙。",
  },
  {
    id: "dangerous",
    description: "危险：如果场景按当前走向继续下去，很可能受到伤害。",
  },
  {
    id: "perilous",
    description: "凶险：萧炎已经在搏斗、坠落、受冻，或已被逼入死角。",
  },
  {
    id: "deadly",
    description: "致命：萧炎与死亡只有一线之隔——寡不敌众、身负重伤，或实力悬殊。",
  },
] as const;

/** The rubric as the SDK wants it: descriptions indexed by score from zero. */
export const criteria = [
  levels[0].description,
  levels[1].description,
  levels[2].description,
  levels[3].description,
  levels[4].description,
] as const;

export type DangerId = (typeof levels)[number]["id"];

const ids: ReadonlyArray<string> = levels.map((level) => level.id);

export const isDangerId = (value: unknown): value is DangerId =>
  typeof value === "string" && ids.includes(value);

export const DangerId = Schema.String.pipe(Schema.filter(isDangerId, { identifier: "DangerId" }));

/** The level a scene with no danger reading falls back to. */
export const fallback: DangerId = "safe";

/** Jev's score is an expectation rather than an index, so it is rounded and clamped. */
export const fromScore = (score: number): DangerId => {
  if (!Number.isFinite(score)) return fallback;
  const index = Math.min(levels.length - 1, Math.max(0, Math.round(score)));
  return levels[index].id;
};
