import { BoardAction } from "@gaia-project/engine";

export const boardActionNames = {
  [BoardAction.Power1]: { name: "3 knowledge", color: "--recent" },
  [BoardAction.Power2]: { name: "2 steps", color: "--current-round" },
  [BoardAction.Power3]: { name: "2 ore", color: "--res-ore" },
  [BoardAction.Power4]: { name: "7 credits", color: "--res-credit" },
  [BoardAction.Power5]: { name: "2 knowledge", color: "--res-knowledge" },
  [BoardAction.Power6]: { name: "1 step", color: "--dig" },
  [BoardAction.Power7]: { name: "2 tokens", color: "--res-power" },
  [BoardAction.Qic1]: { name: "Tech tile", color: "--tech-tile" },
  [BoardAction.Qic2]: { name: "Re-score federation", color: "--federation" },
  [BoardAction.Qic3]: { name: "VP for planet types", color: "--res-vp" },
};
