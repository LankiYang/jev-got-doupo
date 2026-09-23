import type { MoodSeed } from "./seed";

/**
 * Moods Jev chooses between. `id` doubles as the track name
 * (`/music/<id>.mp3`), so it stays English; only what Jev reads is Chinese.
 */
export const moods = [
  { id: "martial", feel: "杀戮开始前一方势力在行动：集结、列阵、开赴战场", examples: ["云岚宗弟子列阵而来", "加玛帝都禁军开拔"] },
  { id: "battle", feel: "正在发生的暴力：斗气交击、冲锋、围攻、杀戮", examples: ["萧炎与魂殿殿下贴身缠斗", "云岚宗踏平萧家演武场"] },
  { id: "tense", feel: "危险一触即发却尚未出手：对峙、潜行、威胁、追捕", examples: ["拍卖行里两方势力对峙", "魔兽山脉深处逼近的脚步声"] },
  { id: "scheming", feel: "在房间里交易权力：低语、筹码、背后藏着刀的买卖", examples: ["云岚宗长老暗中开出的条件", "拍卖行包厢里的低声交易"] },
  { id: "ominous", feel: "恐惧与不祥：诡异之物、冷汗、凶兆", examples: ["黑角域深处传来的低吼", "魂殿黑袍人悄然现身"] },
  { id: "mystical", feel: "古老的力量在倾听：残魂、功法、异火、逐渐苏醒的传承", examples: ["药老在戒指中低语", "古老功法在识海中苏醒"] },
  { id: "sorrowful", feel: "悲恸、失去、告别、落魄、追忆", examples: ["萧家没落后无人问津的祠堂", "被逐出师门的旧人"] },
  { id: "romantic", feel: "两个人之间的亲密、渴望与温柔", examples: ["与萧薰儿并肩看药园夜色", "云韵欲言又止的一瞬"] },
  { id: "calm", feel: "独处的静与安宁：安静的打坐、休憩、月色", examples: ["深夜独自在药园打坐", "演武场无人时的清晨"] },
  { id: "relaxed", feel: "与人相处时的温暖松弛：斗嘴、闲谈、情谊、玩笑", examples: ["与药老斗嘴调侃", "集市上讨价还价的闲适"] },
  { id: "bustling", feel: "忙碌的人群：集市、拍卖、街道、交易与喧闹", examples: ["拍卖会开场前的乌坦城集市", "加玛官道上的商队喧闹"] },
  { id: "curious", feel: "发现与惊奇：探索、逐渐展开的谜团", examples: ["初次在戒指中发现药老", "百草谷里辨认陌生药草"] },
  { id: "triumphant", feel: "胜利、突破、誓言得偿、颜面得偿", examples: ["三年之约上扳回颜面", "突破斗之气等级的瞬间"] },
] as const satisfies ReadonlyArray<MoodSeed>;

export type MoodId = (typeof moods)[number]["id"];
