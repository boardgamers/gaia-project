import { Faction, factions } from "@gaia-project/engine";
import planets from "../data/planets";

export function factionColor(faction: Faction): number {
  return planets[factions[faction].planet].color;
}
