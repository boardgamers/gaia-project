import Engine, { Planet } from "@gaia-project/engine";

type PlanetDisplay = {
  radius: number;
  color: string;
  borderColor: string;
  /** Sphere-shading stops for PlanetGradients.vue's `planet-gradient-<type>`: a lit top-left
   *  highlight and a deepened bottom-right, with `color` as the mid stop. */
  gradient?: { light: string; dark: string };
};

const planets = {
  [Planet.Swamp]: {
    radius: 0.65,
    color: "#704100",
    borderColor: "#874d12",
    gradient: { light: "#c98a3b", dark: "#3d2200" },
  },
  [Planet.Desert]: {
    radius: 0.65,
    color: "#F2FF00",
    borderColor: "#c1a925",
    gradient: { light: "#fcffb8", dark: "#a8a812" },
  },
  [Planet.Terra]: {
    radius: 0.65,
    color: "#2080f0",
    borderColor: "#3399ff",
    gradient: { light: "#a8d8ff", dark: "#0c4a9c" },
  },
  [Planet.Volcanic]: {
    radius: 0.65,
    color: "#FF9500",
    borderColor: "#ff0000",
    gradient: { light: "#ffd08a", dark: "#c24e00" },
  },
  [Planet.Oxide]: {
    radius: 0.65,
    color: "#FF160A",
    borderColor: "#ff8566",
    gradient: { light: "#ff8f80", dark: "#a80e04" },
  },
  [Planet.Titanium]: {
    radius: 0.65,
    color: "#808080",
    borderColor: "#d1d1e0",
    gradient: { light: "#d8d8e2", dark: "#4a4a52" },
  },
  [Planet.Ice]: {
    radius: 0.65,
    color: "#F8FFF5",
    borderColor: "#00c2c2",
    gradient: { light: "#ffffff", dark: "#a9cdc2" },
  },
  [Planet.Gaia]: {
    radius: 0.65,
    color: "#00aa00",
    borderColor: "#004d1a",
    gradient: { light: "#77dd6a", dark: "#005c14" },
  },
  [Planet.Transdim]: {
    radius: 0.5,
    color: "#a64dff",
    borderColor: "#a64dff",
    gradient: { light: "#d7b3ff", dark: "#5f1fb8" },
  },
  [Planet.Lost]: {
    radius: 0.5,
    color: "#004570",
    borderColor: "#d1d1e0",
    gradient: { light: "#4d9ac2", dark: "#001e33" },
  },
  // Lost Fleet
  [Planet.Asteroid]: {
    radius: 0.5,
    color: "#ff66b3",
    borderColor: "#cc3d8a",
    gradient: { light: "#ffc0dd", dark: "#c22e80" },
  },
  [Planet.Protoplanet]: {
    radius: 0.5,
    color: "#30d5c8",
    borderColor: "#1a9e94",
    gradient: { light: "#a8f0e8", dark: "#14857a" },
  },
} as Record<Exclude<Planet, Planet.Empty>, PlanetDisplay>;

export default planets;

export type PlanetGradient = { id: string; light: string; base: string; dark: string; midOffset: number };

/** Sphere-shading gradient stops per planet type, shared by every place that renders a planet as
 * a sphere: the map's defs (Filters.vue) and the research board's own defs (ResearchBoard.vue,
 * which needs its own copy because a url(#…) reference doesn't reliably cross from one SVG
 * document fragment into another). A planet with no explicit `gradient` palette falls back to a
 * white highlight stretched into a longer falloff over its base color, so it still reads as a
 * sphere rather than a white dot on a flat disc. */
export function planetGradients(): PlanetGradient[] {
  return (Object.keys(planets) as Planet[]).map((planet) => {
    const def = planets[planet];
    return {
      id: planet,
      light: def.gradient?.light ?? "#ffffff",
      base: def.color,
      dark: def.gradient?.dark ?? def.color,
      midOffset: def.gradient ? 0.45 : 0.62,
    };
  });
}

/** The gradient stop for a single planet (same data as `planetGradients()`, one entry). */
export function planetGradient(planet: Planet): PlanetGradient {
  return planetGradients().find((g) => g.id === planet);
}

export const planetNames = {
  [Planet.Swamp]: "Swamp",
  [Planet.Desert]: "Desert",
  [Planet.Terra]: "Terra",
  [Planet.Volcanic]: "Volcanic",
  [Planet.Oxide]: "Oxide",
  [Planet.Titanium]: "Titanium",
  [Planet.Ice]: "Ice",
  [Planet.Gaia]: "Gaia",
  [Planet.Transdim]: "Transdim",
  [Planet.Lost]: "Lost planet",
  [Planet.Asteroid]: "Asteroid",
  [Planet.Protoplanet]: "Protoplanet",
};

export function remainingPlanets(planet: Planet, engine: Engine): number {
  return Array.from(engine.map.grid.values()).filter((hex) => !hex.occupied() && hex.data.planet === planet).length;
}
