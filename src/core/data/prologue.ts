export const openingLocationId = "xiao-clan-training-ground" as const;

export const openingMoodId = "tense" as const;

/**
 * The opening lands *before* the three-year pact, not after it — the novel's own first
 * chapter is the annual test itself, live, with the humiliation still unfolding. The
 * pact only exists once Nalan Yanran shows up to retract the engagement over it, which
 * is a scene the player lives through during chapter one rather than backstory they are
 * merely told about.
 */
export const prologue = {
  protagonist:
    "我是萧炎，加玛帝国乌坦城萧家的三少爷。四岁习斗气，十岁便凝出九段斗之气，十一岁那年更是率先凝出斗之气旋，成了萧家百年来最年轻的斗者——那时候，全城都说我是萧家百年一遇的天才。可十二岁那年，我忽然像是被人扼住了咽喉，修为一点点褪去，直到如今整整三年多，旁人都在往前走，我却一路退到了三段，连个正经的低阶斗者都算不上。\n\n我不知道自己身上到底出了什么问题，只知道手上这枚从不离身的戒指偶尔会传来一丝若有若无的低语，像是有什么东西一直在里面，等着某一天开口。",
  narrator:
    "清晨的萧家演武场上，测气石柱前已经挤满了族人。你站在队伍前列，指尖触上冰凉的石面——石柱微光一闪，随即传来测验族老平淡的声音：三段，低级。人群里响起一阵不加掩饰的骚动，交头接耳里全是熟悉的嘲讽——又是原地踏步的天才，家族的脸都被你丢光了。你面无表情地退回队尾，指甲深深掐进掌心。\n\n不远处，萧薰儿的测验引来一片惊叹：十四岁的年纪，眼看就要正式踏入斗者之列。她穿过窃窃私语的人群，走到你面前，轻声唤了一句「萧炎哥哥」，语气里没有旁人那种轻慢。\n\n广场上的议论还没散去，你打算怎么走出这一步？",
} as const;

/**
 * Curated rather than narrator-written: the opening has no prior scene for the model
 * to react to, so these give a first-time player somewhere to start instead of a blank
 * box. Same shape as the narrator's own suggestions — short, second-person, imperative.
 */
export const startingOptions = ["转身离开测验广场", "回应萧薰儿的关心", "面对众人的嘲讽"] as const;
