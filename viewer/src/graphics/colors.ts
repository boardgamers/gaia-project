import { factionPlanet, Planet, Player } from "@gaia-project/engine";
import { ChartColor, ChartStyleDisplay } from "../logic/charts/charts";

const invertedForeground: string[] = [
  "--swamp",
  "--titanium",
  "--lost",
  "--dig",
  "--res-qic",
  "--res-vp",
  "--current-round",
  "--rt-terra",
  "--rt-nav",
  "--rt-int",
  "--rt-gaia",
  "--federation",
];

export class ColorVar {
  color: string;

  constructor(color: string) {
    if (!color.startsWith("--")) {
      throw `${color} does not start with --`;
    }
    this.color = color;
  }

  lookupForChart(style: ChartStyleDisplay, canvas: HTMLCanvasElement): string {
    if (style.type == "chart") {
      return this.lookup(canvas);
    }
    return this.color;
  }

  lookup(canvas: HTMLElement): string | null {
    return window.getComputedStyle(canvas).getPropertyValue(this.color);
  }
}

export function resolveColor(color: ChartColor, player: Player): ColorVar {
  return new ColorVar(typeof color == "string" ? color : color(player));
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

export function playerColor(pl: Player, invert: boolean): ColorVar {
  return new ColorVar(planetColorVar(factionPlanet(pl.faction), invert));
}

export type CellStyle = { color: string; backgroundColor: string };

//maybe replace with staticCellStyle
export function dynamicCellStyle(canvas: HTMLElement, backgroundColor: ColorVar): CellStyle {
  return {
    backgroundColor: backgroundColor.lookup(canvas),
    color: new ColorVar(backgroundColor.color + "-text").lookup(canvas) ?? "black",
  };
}

function withVar(v: string): string {
  return `var(${v})`;
}

export function staticCellStyle(backgroundColor: string): CellStyle {
  return {
    backgroundColor: withVar(backgroundColor),
    color: invertedForeground.includes(backgroundColor) ? "white" : "black",
  };
}
