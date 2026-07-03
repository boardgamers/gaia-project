import { Event, Expansion } from "../index";
import { hasExpansion, isResourceUsed, LostFleetEconomySide, ResearchField } from "./enums";

const researchTracks: { [key in ResearchField]: string[][] } = {
  [ResearchField.Terraforming]: [[], ["2o"], ["d"], ["d", "3pw"], ["2o"], []],
  [ResearchField.Navigation]: [[], ["q"], ["r", "ship-range"], ["q", "3pw"], ["r", "ship-range"], ["r", "2ship-range"]],
  [ResearchField.Intelligence]: [[], ["q"], ["q"], ["2q", "3pw"], ["2q"], ["4q"]],
  [ResearchField.GaiaProject]: [[], [">gf"], ["3t"], [">gf", "3pw"], [">gf"], ["4vp", "g > vp"]],
  [ResearchField.Economy]: [[], ["+2c,pw"], ["+2c,1o,2pw"], ["+3c,1o,3pw", "3pw"], ["+4c,2o,4pw"], ["6c,3o,6pw"]],
  [ResearchField.Science]: [[], ["+k"], ["+2k"], ["+3k", "3pw"], ["+4k"], ["9k"]],
  [ResearchField.Diplomacy]: [
    [],
    ["+pw", "tradeDiscount"],
    ["+2pw", "tradeBonus"],
    ["+3pw", "tradeDiscount", "3pw"],
    ["+4pw", "tradeBonus"],
    ["+6pw", "tradeBonus", "tradeDiscount"],
  ],
};

const frontiersEco: string[][] = [
  ["tradeShip"],
  ["+2c", "tradeShip"],
  ["+2c,1o,1pw"],
  ["+3c,1o,1pw", "3pw", "tradeShip"],
  ["+4c,2o,2pw"],
  ["6c,3o,6pw"],
];

// Lost Fleet §F1: a single overlay tile (one of 2 possible sides, chosen at random at setup) covers
// only the base game's level 3/4 Economy income boxes - levels 0/1/2/5 are untouched, so those
// entries are copied straight from the base `researchTracks[Economy]` above.
const lostFleetEcoPw: string[][] = [
  researchTracks[ResearchField.Economy][0],
  researchTracks[ResearchField.Economy][1],
  researchTracks[ResearchField.Economy][2],
  ["+2c,1o,3pw", "3pw"],
  ["+2c,2o,2pw"],
  researchTracks[ResearchField.Economy][5],
];

const lostFleetEcoVp: string[][] = [
  researchTracks[ResearchField.Economy][0],
  researchTracks[ResearchField.Economy][1],
  researchTracks[ResearchField.Economy][2],
  ["+3c,1o,1vp", "3pw"],
  ["+4c,2o,1vp"],
  researchTracks[ResearchField.Economy][5],
];

export function researchEvents(
  field: ResearchField,
  level: number,
  expansion: Expansion,
  lostFleetEconomySide?: LostFleetEconomySide
) {
  const spec: string[] =
    field === ResearchField.Economy && hasExpansion(expansion, Expansion.Frontiers)
      ? frontiersEco[level]
      : field === ResearchField.Economy && hasExpansion(expansion, Expansion.LostFleet)
      ? (lostFleetEconomySide === LostFleetEconomySide.VictoryPoints ? lostFleetEcoVp : lostFleetEcoPw)[level]
      : researchTracks[field][level];
  return spec.map((s) => new Event(s, field)).filter((e) => e.rewards.every((r) => isResourceUsed(r.type, expansion)));
}

export function lastTile(field: ResearchField): number {
  return researchTracks[field].length - 1;
}

export function keyNeeded(field: ResearchField, dest: number): boolean {
  return dest === lastTile(field);
}
