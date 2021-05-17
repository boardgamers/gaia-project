import { Faction, factions } from "@gaia-project/engine";
import planets from "../data/planets";

export function factionColor(faction: Faction): string {
  return planets[factions[faction].planet].color;
}
