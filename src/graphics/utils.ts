import { Faction, factions, Planet } from "@gaia-project/engine";
import planets from "../data/planets";

export function factionColor (faction: Faction | "gen"): string {
  if (faction === "gen") {
    return "#d3d3d3";
  }
  return planets[factions[faction].planet].color;
}

export function planetColor (planet: Planet): string {
  return planets[planet].color;
}

export function planetClass (faction: string): string {
  switch (faction as any) {
    case "wild": return Planet.Transdim;
    case "gaia": return Planet.Gaia;
    case "gen": return "gen";
    case "dig": return "dig";
    case "automa": return "gen";
    default: return factions.planet(faction as Faction);
  }
}
