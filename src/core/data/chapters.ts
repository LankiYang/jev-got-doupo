import type { ChapterSeed } from "./seed";

/**
 * Each chapter is meant to run its own 起承转合 (setup, development, turn, resolution)
 * before the next one opens. `goal` is what Jev is shown to judge `arcStage` against
 * and what the narrator is shown to write toward — a thread, not a script: how the
 * player gets there, or whether they ever fully do, stays theirs to decide.
 *
 * `locations` is loose scenery for the narrator, the way `Location.nearby` already is —
 * never a gate. Chapters advance on `arcStage` reaching 合, not on arriving anywhere.
 *
 * The arc follows the novel's own opening stretch: the fall from grace, the master who
 * wakes to teach him, the years spent chasing strange fires through the Demonic Beast
 * Mountains, and the reckoning that waits back in Wutan City once the three-year pact
 * comes due. There is no chapter after the last one — once it closes, the story keeps
 * running inside it rather than stopping, since Jev only ever reads finished scenes
 * and has no sense of an ending to reach for.
 */
export const chapters = [
  {
    id: "the-useless-one",
    title: "废柴",
    goal: "撑过又一次当众落魄的测验，直面纳兰嫣然登门退婚，咬牙立下三年之约。",
    locations: ["xiao-clan-manor", "xiao-clan-training-ground", "xiao-clan-hall", "wutan-city"],
  },
  {
    id: "master-and-apprentice",
    title: "拜师",
    goal: "在药老的指点下，真正握住斗气与炼药的门道。",
    locations: ["xiao-clan-manor", "xiao-clan-training-ground", "wutan-city-outskirts", "herb-valley"],
  },
  {
    id: "chasing-the-flame",
    title: "异火寻踪",
    goal: "带着药老的嘱托踏入魔兽山脉，寻访异火与净莲妖火的下落。",
    locations: ["jia-nan-academy", "demon-beast-mountains", "herb-valley", "wutan-city-outskirts"],
  },
  {
    id: "purple-cloud-wings",
    title: "紫云天索",
    goal: "在魔兽山脉深处与云韵联手，换来一身紫云翼和二品炼药师的名号。",
    locations: ["demon-beast-mountains", "black-horn-region", "alchemist-guild"],
  },
  {
    id: "medusa-sanctuary",
    title: "美杜莎秘境",
    goal: "取得美杜莎女王的信任，炼化青莲地心火，让佛怒火莲真正成形。",
    locations: ["black-horn-region", "demon-beast-mountains", "herb-valley"],
  },
  {
    id: "alchemist-conference",
    title: "丹会夺魁",
    goal: "在炼药师大会上凭真本事夺魁，把萧炎的名字重新烙进大陆的记忆。",
    locations: ["alchemist-guild", "wutan-city", "auction-house"],
  },
  {
    id: "gathering-storm",
    title: "风波乍起",
    goal: "三年期满登上云岚山，与纳兰嫣然做个了断，顶住云棱当场发难的杀机。",
    locations: ["yunlan-sect", "yunlan-sect-hall", "jia-ma-trade-road", "wutan-city"],
  },
  {
    id: "fall-of-yunlan",
    title: "覆灭云岚",
    goal: "率众打上云岚宗，揭穿魂殿的阴谋，救回父亲，把云岚宗从加玛帝国除名。",
    locations: ["yunlan-sect", "yunlan-sect-hall", "wutan-city", "jia-ma-trade-road"],
  },
] as const satisfies ReadonlyArray<ChapterSeed>;

export type ChapterId = (typeof chapters)[number]["id"];
