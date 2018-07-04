import { BoardAction } from './enums'
// QIC to extend range is already included in the distance calculation

const freeActions =  [
  { cost: "4pw", income: "1q" },
  { cost: "3pw", income: "1o" },
  { cost: "1q", income: "1o" },
  { cost: "4pw", income: "1k" },
  { cost: "1pw", income: "1c" },
  { cost: "1k", income: "1c" },
  { cost: "1o", income: "1c" },
  { cost: "1o", income: "1t" }
];

//TODO rescore on act9
const boardActions =  {
  [BoardAction.BoardAction1]: { cost: "7pw", income: "3k" },
  [BoardAction.BoardAction2]: { cost: "5pw", income: "2d" },
  [BoardAction.BoardAction3]: { cost: "4pw", income: "2o" },
  [BoardAction.BoardAction4]: { cost: "4pw", income: "7c" },
  [BoardAction.BoardAction5]: { cost: "4pw", income: "2k" },
  [BoardAction.BoardAction6]: { cost: "3pw", income: "1d" },
  [BoardAction.BoardAction7]: { cost: "3pw", income: "2t" },
  [BoardAction.BoardAction8]: { cost: "4q", income: "a" },
  [BoardAction.BoardAction9]: { cost: "3q", income: "" },
  [BoardAction.BoardAction10]: { cost: "2q", income: "3pv, pt > pw" }
};



export { freeActions, boardActions };
