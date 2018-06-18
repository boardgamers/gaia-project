import { ResearchField } from "./enums";
import Event from "./events";

export default {
  [ResearchField.Terraforming]: [
    [],["2o"],[],["3pw"],["2o"],[]
  ], 
  [ResearchField.Navigation]: [
    [],["q"],["r"],["q,3pw"],["r"],["r"]
  ],
  [ResearchField.Intelligence]: [
    [],["q"],["q"],["2q,3pw"],["2q"],["4q"]
  ],
  [ResearchField.GaiaProject]: [
    [],["gf"],["3t"],["3pw","gf"],["gf"],["4vp", "g > vp"]
  ],
  [ResearchField.Economy]: [
    [],["+2c,pw"],["+o,pw"],["+c,pw", "3pw"],["+o,c,pw"],["3o,6c,6pw"]
  ],
  [ResearchField.Science]: [
    [],["+k"],["+k"],["+k", "3pw"],["+k"],["9k"]
  ],
}

export function lastTile(field: ResearchField) {
  return 5;
}

export function keyNeeded(field: ResearchField, dest: number) : boolean {
  return dest === lastTile(field);
}
