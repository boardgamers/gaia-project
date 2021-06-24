import { Faction, factionPlanet } from "@gaia-project/engine";
import planets from "../data/planets";

export function factionColor(faction: Faction): string {
  return planets[factionPlanet(faction)].color;
}
