import { Expansion, Faction, factionPlanet, Planet } from "@gaia-project/engine";
import planets from "../data/planets";
// Re-exported so UI that shades a faction-colored chip (final-scoring indents, ...) can tell a
// light faction color from a dark one without re-deriving the planet.
export { factionPlanet };

export function factionPiecePlanet(faction: Faction): Planet {
  switch (faction) {
    case Faction.Tinkeroids:
    case Faction.Darkanians:
      return Planet.Asteroid;
    case Faction.Moweyds:
    case Faction.SpaceGiants:
      return Planet.Protoplanet;
    default:
      return factionPlanet(faction);
  }
}

function planetColorVarName(planet: Planet): string {
  const key = Object.keys(Planet).find((k) => Planet[k] === planet) ?? "unknown";
  return `--${key.toLowerCase()}`;
}

export function factionColor(faction: Faction | "gen"): string {
  if (faction === "gen") {
    return "#d3d3d3";
  }
  return planets[factionPiecePlanet(faction)].color;
}

export function factionColorVar(faction: Faction) {
  return planetColorVarName(factionPiecePlanet(faction));
}

export function planetColor(planet: Exclude<Planet, Planet.Empty>): string {
  return planets[planet].color;
}

export function planetFill(planet: string) {
  if (planet === Planet.Titanium || planet === Planet.Swamp) {
    return "white";
  }
  return "black";
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
      return factionPiecePlanet(faction as Faction);
  }
}

export function lightenDarkenColor(col: string, amt: number) {
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

function newPlanetColors(amt: number) {
  return Object.fromEntries(
    Faction.values(Expansion.All).map((faction) => {
      const planet = factionPiecePlanet(faction);
      const color = planet == Planet.Ice ? "#000000" : planets[planet].color;
      return [faction, amt == 0 ? color : lightenDarkenColor(color, amt)];
    })
  );
}

export const factionLogTextColors = Object.fromEntries(
  Faction.values(Expansion.All).map((faction) => {
    const planet = factionPiecePlanet(faction);
    const color = planet == Planet.Ice || planet == Planet.Swamp || planet == Planet.Titanium ? "white" : "black";
    return [faction, color];
  })
);
export const factionLogColors = newPlanetColors(0);
export const lightFactionLogColors = newPlanetColors(190);
