import { BoardAction } from "./enums";
// QIC to extend range is already included in the distance calculation

export const freeActions = [
  { cost: "4pw", income: "1q" },
  { cost: "3pw", income: "1o" },
  { cost: "1q", income: "1o" },
  { cost: "4pw", income: "1k" },
  { cost: "1pw", income: "1c" },
  { cost: "1k", income: "1c" },
  { cost: "1o", income: "1c" },
  { cost: "1o", income: "1t" },
];

export const freeActionsHadschHallas = [
  { cost: "4c", income: "1q" },
  { cost: "3c", income: "1o" },
  { cost: "4c", income: "1k" },
];

export const freeActionsTerrans = [
  { cost: "4tg", income: "1q" },
  { cost: "3tg", income: "1o" },
  { cost: "4tg", income: "1k" },
  { cost: "1tg", income: "1c" },
];

export const freeActionsItars = [{ cost: "4tg", income: "tech" }];

export const freeActionsNevlas = [{ cost: "1t-a3", income: "1k" }];

export const freeActionsNevlasPI = [
  { cost: "4pw", income: "1o,1c" },
  { cost: "6pw", income: "2o" },
];

export const freeActionsBaltaks = [{ cost: "1gf", income: "1q" }];

export const boardActions = {
  [BoardAction.Power1]: { name: "3 knowledge", cost: "7pw", income: ["3k"], color: "--recent" },
  [BoardAction.Power2]: { name: "2 steps", cost: "5pw", income: ["2step"], color: "--current-round" },
  [BoardAction.Power3]: { name: "2 ore", cost: "4pw", income: ["2o"], color: "--res-ore" },
  [BoardAction.Power4]: { name: "7 credits", cost: "4pw", income: ["7c"], color: "--res-credit" },
  [BoardAction.Power5]: { name: "2 knowledge", cost: "4pw", income: ["2k"], color: "--res-knowledge" },
  [BoardAction.Power6]: { name: "1 step", cost: "3pw", income: ["1step"], color: "--dig" },
  [BoardAction.Power7]: { name: "2 tokens", cost: "3pw", income: ["2t"], color: "--res-power" },
  [BoardAction.Qic1]: { name: "Tech tile", cost: "4q", income: ["tech"], color: "--tech-tile" },
  [BoardAction.Qic2]: { name: "Re-score federation", cost: "3q", income: [">fed"], color: "--federation" },
  [BoardAction.Qic3]: { name: "VP for planet types", cost: "2q", income: ["3vp", "pt > vp"], color: "--res-vp" },
};
