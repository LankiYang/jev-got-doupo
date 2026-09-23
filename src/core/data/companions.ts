import type { CompanionSeed } from "./seed";

/**
 * The handful of recurring named figures Jev is asked to notice, not a full cast list.
 *
 * The narrator invents minor characters constantly, and Jev has no way to recognise
 * someone who is not on this list, so it never will. That is by design: this question
 * answers "is anyone the reader already knows here", not "who is in this scene". A
 * scene built entirely around a character not on this list correctly reads as `none`.
 */
export const companions = [
  { id: "yao-lao", name: "药老", description: "封印在戒指中的一缕残魂，曾是大陆闻名的炼药宗师，萧炎最重要的师父，随时可能开口说话。" },
  { id: "xiao-zhan", name: "萧战", description: "萧炎的父亲，萧家家主，对萧炎的态度里藏着愧疚与不敢言明的期望。" },
  { id: "xiao-xun-er", name: "萧薰儿", description: "萧炎自幼相识的女子，气质清冷疏离，身世牵着一段萧炎并不完全知情的旧约。" },
  { id: "nalan-yanran", name: "纳兰嫣然", description: "萧炎名义上的未婚妻，因他修为跌落而心灰意冷，退婚与三年之约都因她而起，如今再见时态度复杂。" },
  { id: "xiao-yixian", name: "小医仙", description: "云游四方的年轻医者，精于奇毒异药，是萧炎打听异火线索时结识的旁支引路人。" },
  { id: "yun-yun", name: "云韵", description: "云岚宗宗主云山的徒弟，魔兽山脉中与萧炎结下一段说不清的情谊，处境常年夹在师门与萧炎之间。" },
  { id: "medusa-queen", name: "美杜莎女王", description: "黑角域美杜莎一族的女王，气质妖异强大，与萧炎结盟后是他最不容小觑的外援。" },
  { id: "yun-shan", name: "云山", description: "云岚宗宗主，云韵的师父，近年靠魂殿撑腰强行突破斗宗，性情也因此变得阴狠难测。" },
  { id: "yun-ling", name: "云棱", description: "云岚宗长老，态度强硬傲慢，近来对萧家旧物的觊觎已经压不住，是萧家如今最忌惮的外部压力之一。" },
] as const satisfies ReadonlyArray<CompanionSeed>;

export type CompanionId = (typeof companions)[number]["id"];
