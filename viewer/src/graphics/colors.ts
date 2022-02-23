import {factionPlanet, Planet, Player} from "@gaia-project/engine";
import {ChartColor, ChartStyleDisplay} from "../logic/charts/charts";

const invertedForeground: string[] = [
  "--volcanic",
  "--terra",
  "--oxide",
  "--swamp",
  "--titanium",
  "--lost",
  "--dig",
  "--res-qic",
  "--res-vp",
  "--current-round",
  "--rt-terra",
  "--rt-nav",
  "--rt-dip",
  "--rt-int",
  "--rt-gaia",
  "--rt-dip",
  "--federation",
];

export function resolveColor(color: ChartColor, player: Player): string {
  return typeof color == "string" ? color : color(player);
}

export function planetColorVar(planet: Planet, invert: boolean): string {
  if (invert && planet == Planet.Ice) {
    return "--current-round";
  } else if (planet == Planet.Empty) {
    //for lantids guest mine
    return "--recent";
  } else {
    return (
      "--" +
      Object.keys(Planet)
        .find((k) => Planet[k] == planet)
        .toLowerCase()
    );
  }
}

export function playerColor(pl: Player, invert: boolean): string {
  return planetColorVar(factionPlanet(pl.faction), invert);
}

export type CellStyle = { color: string; backgroundColor: string };

function withVar(v: string): string {
  if (v.startsWith("--")) {
    return `var(${v})`;
  }
  return v;
}

export function foregroundColor(backgroundColor: string) {
  return invertedForeground.includes(backgroundColor) ? "white" : "black";
}

export function staticCellStyle(backgroundColor: string): CellStyle {
  return {
    backgroundColor: withVar(backgroundColor),
    color: foregroundColor(backgroundColor),
  };
}
