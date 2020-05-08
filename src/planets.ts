import { Planet } from "./enums";

export function terraformingStepsRequired(factionPlanet: Planet, targetPlanet: Planet): number {
  const planetCycle = [ Planet.Terra, Planet.Oxide, Planet.Volcanic, Planet.Desert, Planet.Swamp, Planet.Titanium, Planet.Ice];

  if ( targetPlanet === Planet.Gaia || targetPlanet === Planet.Transdim) {
    return 0;
  }

  let dist = planetCycle.findIndex(pc => pc === targetPlanet) - planetCycle.findIndex(pc => pc === factionPlanet);
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
  [Planet.Volcanic]: "volcanic"
};
