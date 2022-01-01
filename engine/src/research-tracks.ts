import { Event, Expansion } from "../index";
import { ResearchField } from "./enums";

const researchTracks: { [key in ResearchField]: string[][] } = {
  [ResearchField.Terraforming]: [[], ["2o"], ["d"], ["d", "3pw"], ["2o"], []],
  [ResearchField.Navigation]: [[], ["q"], ["r", "ship-range"], ["q", "3pw"], ["r", "ship-range"], ["r", "2ship-range"]],
  [ResearchField.Intelligence]: [[], ["q"], ["q"], ["2q", "3pw"], ["2q"], ["4q"]],
  [ResearchField.GaiaProject]: [[], [">gf"], ["3t"], [">gf", "3pw"], [">gf"], ["4vp", "g > vp"]],
  [ResearchField.Economy]: [[], ["+2c,pw"], ["+2c,1o,2pw"], ["+3c,1o,3pw", "3pw"], ["+4c,2o,4pw"], ["6c,3o,6pw"]],
  [ResearchField.Science]: [[], ["+k"], ["+2k"], ["+3k", "3pw"], ["+4k"], ["9k"]],
  [ResearchField.Diplomacy]: [
    [],
    ["+pw", "trade-bonus"],
    ["+2pw", "q"],
    ["+3pw", "trade-bonus", "3pw"],
    ["+4pw", "trade-bonus"],
    ["+6pw", "trade-bonus"],
  ],
};

const frontiersEco: string[][] = [
  [">trade-ship"],
  ["+2c", ">trade-ship"],
  ["+2c,1o,1pw"],
  ["+3c,1o,1pw", "3pw", ">trade-ship"],
  ["+4c,2o,2pw"],
  ["6c,3o,6pw"],
];

export function researchEvents(field: ResearchField, level: number, expansion: Expansion) {
  const spec: string[] =
    expansion === Expansion.Frontiers && field === ResearchField.Economy
      ? frontiersEco[level]
      : researchTracks[field][level];
  return spec.map((s) => new Event(s, field));
}

export function lastTile(field: ResearchField) {
  return researchTracks[field].length - 1;
}

export function keyNeeded(field: ResearchField, dest: number): boolean {
  return dest === lastTile(field);
}
