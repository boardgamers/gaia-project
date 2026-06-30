import { factionPlanet } from "./factions";
import { Faction, Planet } from "./enums";

export function terraformingStepsRequired(faction: Faction, targetPlanet: Planet, cost3Planets: Planet[] = []): number {
  const planetCycle = [
    Planet.Terra,
    Planet.Oxide,
    Planet.Volcanic,
    Planet.Desert,
    Planet.Swamp,
    Planet.Titanium,
    Planet.Ice,
  ];

  if (targetPlanet === Planet.Gaia || targetPlanet === Planet.Transdim || targetPlanet === Planet.Asteroid) {
    return 0;
  }

  if (targetPlanet === Planet.Protoplanet) {
    return 3;
  }

  // Lost Fleet: these factions have no home terrain planet, so the planet-cycle math below
  // (keyed off factionPlanet()) doesn't apply to them - their terraform cost is a flat
  // per-faction rule instead, regardless of target color.
  if (faction === Faction.Darkanians) {
    return 1;
  }
  if (faction === Faction.SpaceGiants) {
    return 2;
  }
  if (faction === Faction.Tinkeroids || faction === Faction.Moweyds) {
    return cost3Planets.includes(targetPlanet) ? 3 : 1;
  }

  let dist =
    planetCycle.findIndex((pc) => pc === targetPlanet) - planetCycle.findIndex((pc) => pc === factionPlanet(faction));
  if (dist > 3) {
    dist -= 7;
  } else if (dist < -3) {
    dist += 7;
  }

  return Math.abs(dist);
}

export const planetNames = {
  [Planet.Desert]: "desert",
  [Planet.Oxide]: "oxide",
  [Planet.Lost]: "lost",
  [Planet.Gaia]: "gaia",
  [Planet.Ice]: "ice",
  [Planet.Empty]: "empty",
  [Planet.Swamp]: "swamp",
  [Planet.Terra]: "terra",
  [Planet.Titanium]: "titanium",
  [Planet.Transdim]: "transdim",
  [Planet.Volcanic]: "volcanic",
  [Planet.Protoplanet]: "protoplanet",
  [Planet.Asteroid]: "asteroid",
};
