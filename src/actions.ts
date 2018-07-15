import { BoardAction } from './enums';
// QIC to extend range is already included in the distance calculation

export const freeActions =  [
  { cost: "4pw", income: "1q" },
  { cost: "3pw", income: "1o" },
  { cost: "1q", income: "1o" },
  { cost: "4pw", income: "1k" },
  { cost: "1pw", income: "1c" },
  { cost: "1k", income: "1c" },
  { cost: "1o", income: "1c" },
  { cost: "1o", income: "1t" }
];

export const freeActionsHadschHallas = [
  { cost: "4c", income: "1q" },
  { cost: "3c", income: "1o" },
  { cost: "4c", income: "1k" }
];

export const freeActionsTerrans = [
  { cost: "4tg", income: "1q" },
  { cost: "3tg", income: "1o" },
  { cost: "4tg", income: "1k" },
  { cost: "1tg", income: "1c" }
];

export const boardActions =  {
  [BoardAction.Power1]: { cost: "7pw", income: ["3k"] },
  [BoardAction.Power2]: { cost: "5pw", income: ["2step"] },
  [BoardAction.Power3]: { cost: "4pw", income: ["2o"] },
  [BoardAction.Power4]: { cost: "4pw", income: ["7c"] },
  [BoardAction.Power5]: { cost: "4pw", income: ["2k"] },
  [BoardAction.Power6]: { cost: "3pw", income: ["step"] },
  [BoardAction.Power7]: { cost: "3pw", income: ["2t"] },
  [BoardAction.Qic1]: { cost: "4q", income: ["tech"] },
  [BoardAction.Qic2]: { cost: "3q", income: ["fed"] },
  [BoardAction.Qic3]: { cost: "2q", income: ["3vp", "pt > vp"]}
};
