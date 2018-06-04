import { Faction } from "@gaia-project/engine";
import planets from "../data/planets";
import factions from "@gaia-project/engine/src/factions";

export function factionColor(faction: Faction): number {
  return planets[factions[faction].planet].color;
}
