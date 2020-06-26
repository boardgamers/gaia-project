import { Faction, factions, Planet } from "@gaia-project/engine";
import planets from "../data/planets";

export function factionColor (faction: Faction): string {
  return planets[factions[faction].planet].color;
}

export function planetColor (planet: Planet): string {
  return planets[planet].color;
}