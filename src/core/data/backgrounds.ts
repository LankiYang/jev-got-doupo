import type { Region } from "./seed";

/** Backdrop for a whole region, used when a place in it has no picture of its own. */
export const regionBackground: Record<Region, string> = {
  乌坦城: "region-wutan-city",
  加玛帝国: "region-jia-ma-empire",
  魔兽山脉: "region-demon-beast-mountains",
  云岚宗: "region-yunlan-sect",
  大陆远方: "region-the-far-continent",
};

/** Last resort when neither a place nor its region has a backdrop. */
export const defaultBackground = "default";
