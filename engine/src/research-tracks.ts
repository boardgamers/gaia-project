import { ResearchField } from "./enums";

export default {
  [ResearchField.Terraforming]: [[], ["2o"], ["d"], ["d", "3pw"], ["2o"], []],
  [ResearchField.Navigation]: [[], ["q"], ["r", "ship-range"], ["q", "3pw"], ["r", "ship-range"], ["r", "2ship-range"]],
  [ResearchField.Intelligence]: [[], ["q"], ["q"], ["2q", "3pw"], ["2q"], ["4q"]],
  [ResearchField.GaiaProject]: [[], [">gf"], ["3t"], [">gf", "3pw"], [">gf"], ["4vp", "g > vp"]],
  [ResearchField.Economy]: [[], ["+2c,pw"], ["+2c,1o,2pw"], ["+3c,1o,3pw", "3pw"], ["+4c,2o,4pw"], ["6c,3o,6pw"]],
  [ResearchField.Science]: [[], ["+k"], ["+2k"], ["+3k", "3pw"], ["+4k"], ["9k"]],
  // [ResearchField.TradingBonus]: [
  //   ["trade >> 2k"],
  //   ["trade 1>> 2k,3c"],
  //   ["trade 1>> 2k,3c", "tech"],
  //   ["trade 1>> 2k,1o,3c", "3pw"],
  //   ["trade 1>> 2k,1o,3c,q", "tech"],
  //   ["trade 2>> 2k,1o,3c,q"],
  // ],
  // [ResearchField.TradingVolume]: [
  //   ["+ship"],
  //   ["+ship", "ship-range"],
  //   ["+2ship", "ship-move"],
  //   ["+2ship", "ship-range", "3pw"],
  //   ["+3ship", "ship-move", "1> up-nav,up-int"],
  //   ["+4ship", "ship-move", "ship-range"],
  // ],
};

export function lastTile(field: ResearchField) {
  return 5;
}

export function keyNeeded(field: ResearchField, dest: number): boolean {
  return dest === lastTile(field);
}
