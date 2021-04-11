import { Faction, factions, Planet } from "@gaia-project/engine";
import { factionPlanet } from "@gaia-project/engine/src/factions";
import planets from "../data/planets";

export function factionColor(faction: Faction | "gen"): string {
  if (faction === "gen") {
    return "#d3d3d3";
  }
  return planets[factions[faction].planet].color;
}

export function planetColor(planet: Exclude<Planet, Planet.Empty>): string {
  return planets[planet].color;
}

export function planetClass(faction: string): string {
  switch (faction as any) {
    case "wild":
      return Planet.Transdim;
    case "gaia":
      return Planet.Gaia;
    case "gen":
      return "gen";
    case "dig":
      return "dig";
    case "automa":
      return "gen";
    default:
      return factionPlanet(faction as Faction);
  }
}

export function lightenDarkenColor(col, amt) {
  let usePound = false;

  if (col[0] == "#") {
    col = col.slice(1);
    usePound = true;
  }

  const num = parseInt(col, 16);

  let r = (num >> 16) + amt;

  if (r > 255) r = 255;
  else if (r < 0) r = 0;

  let b = ((num >> 8) & 0x00ff) + amt;

  if (b > 255) b = 255;
  else if (b < 0) b = 0;

  let g = (num & 0x0000ff) + amt;

  if (g > 255) g = 255;
  else if (g < 0) g = 0;

  return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);
}

export const factionLogColors = Object.fromEntries(
  Object.entries(factions).map(([f, c]) => [f, lightenDarkenColor(planets[c.planet].color, 90)])
);

export const lightFactionLogColors = Object.fromEntries(
  Object.entries(factions).map(([f, c]) => [f, lightenDarkenColor(planets[c.planet].color, 190)])
);
