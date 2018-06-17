import { ResearchField } from "./enums";
import Event from "./events";

export default {
  [ResearchField.Terraforming]: [
    [],["2o"],[],[],["2o"],[]
  ], 
  [ResearchField.Navigation]: [
    [],["q"],["r"],["q"],["r"],[]
  ],
  [ResearchField.Intelligence]: [
    [],["q"],["q"],["2q"],["2q"],["4q"]
  ],
  [ResearchField.GaiaProject]: [
    [],[],[],[],[],["4vp", "g > vp"]
  ],
  [ResearchField.Economy]: [
    [],["+2c,pw"],["+o,pw"],["+c,pw"],["+o,c,pw"],["+o,2c,2pw"]
  ],
  [ResearchField.Science]: [
    [],["+k"],["+k"],["+k"],["+k"],["9k"]
  ],
}

export function lastTile(field: ResearchField) {
  return 5;
}

export function keyNeeded(field: ResearchField, dest: number) : boolean {
  return dest === lastTile(field);
}
