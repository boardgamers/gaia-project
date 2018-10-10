import { ResearchField } from "./enums";

export default {
  [ResearchField.Terraforming]: [
    [], ["2o"], ["d"], ["3pw", "d"], ["2o"], []
  ],
  [ResearchField.Navigation]: [
    [], ["q"], ["r"], ["q,3pw"], ["r"], ["r"]
  ],
  [ResearchField.Intelligence]: [
    [], ["q"], ["q"], ["2q,3pw"], ["2q"], ["4q"]
  ],
  [ResearchField.GaiaProject]: [
    [], [">gf"], ["3t"], ["3pw", ">gf"], [">gf"], ["4vp", "g > vp"]
  ],
  [ResearchField.Economy]: [
    [], ["+2c,pw"], ["+2c,1o,2pw"], ["+3c,1o,3pw", "3pw"], ["+4c,2o,4pw"], ["6c,3o,6pw"]
  ],
  [ResearchField.Science]: [
    [], ["+k"], ["+2k"], ["+3k", "3pw"], ["+4k"], ["9k"]
  ],
  [ResearchField.TradingBonus]: [
    ["trade >> 1k"], ["trade 1>> 2k,o"], ["trade 1>> 2k,o,3c,3pw"], ["trade 1>> 2k,2o,4c,4pw,q", "3pw"], ["trade 2>> 2k,2o,4c,4pw,q"], ["trade 3>> 2k,2o,4c,4pw,q"]
  ],
  [ResearchField.TradingVolume]: [
    [], ["ship-range"], ["ship-move"], ["ship-range", "3pw"], ["ship-move", "1> up-nav,up-int"], ["ship-range"]
  ]
};

export function lastTile(field: ResearchField) {
  return 5;
}

export function keyNeeded(field: ResearchField, dest: number): boolean {
  return dest === lastTile(field);
}
