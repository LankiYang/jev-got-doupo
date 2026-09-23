import type { BeatSeed } from "./seed";

/**
 * Scene kinds Jev chooses between.
 *
 * `id` is a stable key — it names the backdrop under `public/scenes/` — so it
 * stays English. Everything Jev actually reads (name, definition, example) is
 * Chinese, because the prose it is labelling is Chinese.
 */
export const beats = [
  { id: "battle", name: "正面会战", definition: "两方阵营在开阔地交战：地形、人数、一个撑不了太久的计划", example: "云岚宗大军踏平萧家演武场", background: "beat-battle" },
  { id: "duel", name: "小规模厮杀或决斗", definition: "小规模的个人搏斗——比试斗气，或少数人的偷袭", example: "三年之约上萧炎对纳兰洛的比试" },
  { id: "intrigue", name: "朝堂权谋", definition: "有权势的人交换情报、威胁和人情；没有动手", example: "云岚宗与萧家的暗中博弈", background: "beat-intrigue" },
  { id: "feast", name: "宴席", definition: "长桌、过多的酒、一场应酬，盛情招待之下藏着社交危险", example: "萧家家宴上的冷嘲热讽", background: "beat-feast" },
  { id: "wedding", name: "婚礼", definition: "公开的联姻仪式——这个世界里最危险的事件之一", example: "加玛帝都的联姻盛典", background: "beat-wedding" },
  { id: "trial", name: "处决或审判", definition: "正式的裁决，以及当众执行", example: "云岚宗众人当众逼萧战下跪", background: "beat-trial" },
  { id: "journey", name: "旅途", definition: "以移动本身构成的场景：道路、营地、天气、路上的交谈", example: "沿加玛官道奔赴迦南学院" },
  { id: "oath", name: "宣誓或仪式", definition: "在众人或见证者面前说出的约束之言；正确完成的仪式", example: "三年之约的当众起誓" },
  { id: "siege", name: "围城", definition: "强敌在外，守方在内，时间就是武器", example: "云岚宗大军围困萧家大宅", background: "beat-siege" },
  { id: "parley", name: "谈判或和谈", definition: "敌对双方谈条件，至少一方打算撕毁", example: "萧战与云岚宗的城下之盟", background: "beat-parley" },
  { id: "vision", name: "幻象或梦境", definition: "预知或幻象：残魂低语、异火幻象、天赋觉醒的错觉", example: "药老残魂讲述昔年往事", background: "beat-vision" },
  { id: "stealth", name: "潜行或脱逃", definition: "不被发现地行动，逃出去，被察觉即是倒计时", example: "带着戒指连夜潜出乌坦城" },
  { id: "supernatural", name: "超自然遭遇", definition: "亲身面对诡异之物：异火异宝、蛇人秘术、山脉深处不知名的存在", example: "黑角域深处的诡异异象", background: "beat-supernatural" },
  { id: "quiet", name: "温情或安静时刻", definition: "两个人，低风险，坦诚；让下一次交锋真正落地的场景", example: "药老与萧炎的一次夜谈" },
] as const satisfies ReadonlyArray<BeatSeed>;

export type BeatId = (typeof beats)[number]["id"];
