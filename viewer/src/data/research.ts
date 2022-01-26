import Engine, { Event, Expansion, Player, researchEvents, ResearchField, Resource } from "@gaia-project/engine";
import { GAIA_FORMER_COST } from "@gaia-project/engine/src/faction-boards/types";
import { CellStyle, staticCellStyle } from "../graphics/colors";
import { eventDescForCounters } from "./event";

export const researchData: { [key in ResearchField]: { name: string; shortcut: string } } = {
  [ResearchField.Terraforming]: { name: "Terraforming", shortcut: "t" },
  [ResearchField.Navigation]: { name: "Navigation", shortcut: "n" },
  [ResearchField.Intelligence]: { name: "Intelligence", shortcut: "i" },
  [ResearchField.GaiaProject]: { name: "Gaia Project", shortcut: "g" },
  [ResearchField.Economy]: { name: "Economy", shortcut: "e" },
  [ResearchField.Science]: { name: "Science", shortcut: "s" },
  [ResearchField.Diplomacy]: { name: "Diplomacy", shortcut: "p" },
};

type ResearchEffectCounter = {
  expansion?: Expansion;
  field: ResearchField;
  minLevel?: number;
  from: Resource;
  to?: Resource;
  currentValue: (p: Player) => number;
};

const researchEffectCounters: ResearchEffectCounter[] = [
  {
    field: ResearchField.Terraforming,
    from: Resource.TerraformCostDiscount,
    currentValue: (p) => p.data.terraformCostDiscount + 1,
  },
  {
    field: ResearchField.Navigation,
    from: Resource.Range,
    currentValue: (p) => p.data.range,
  },
  {
    expansion: Expansion.Frontiers,
    field: ResearchField.Navigation,
    from: Resource.ShipRange,
    currentValue: (p) => p.data.shipRange,
  },
  {
    expansion: Expansion.Frontiers,
    field: ResearchField.Economy,
    from: Resource.TradeShip,
    currentValue: (p) => p.data.tradeShips,
  },
  {
    field: ResearchField.GaiaProject,
    minLevel: 1,
    from: Resource.GaiaFormer,
    to: Resource.GainTokenGaiaArea,
    currentValue: (p) => GAIA_FORMER_COST - p.data.gaiaFormingDiscount(),
  },
  {
    expansion: Expansion.Frontiers,
    field: ResearchField.Diplomacy,
    from: Resource.TradeBonus,
    currentValue: (p) => p.data.tradeBonus,
  },
  {
    expansion: Expansion.Frontiers,
    field: ResearchField.Diplomacy,
    from: Resource.TradeDiscount,
    currentValue: (p) => p.data.tradeCost(),
  },
];

export function researchEventsWithCounters(engine: Engine, field: ResearchField, level: number): Event[] {
  let events = researchEvents(field, level, engine.expansions);

  const counters = researchEffectCounters.filter(
    (c) => c.field == field && (c.expansion == null || c.expansion == engine.expansions)
  );

  const p = new Player();

  const vals = {};

  [...Array(level + 1).keys()]
    .map((l) => researchEvents(field, l, engine.expansions))
    .forEach((events, l) => {
      for (const e of events) {
        p.gainRewards(e.rewards, e.source);
      }
      const m = vals[l] ?? {};
      for (const c of counters) {
        m[c.from] = c.currentValue(p);
      }
      vals[l] = m;
    });

  for (const c of counters) {
    if (c.to == null) {
      events = events.filter((e) => !e.rewards.some((r) => r.type === c.from));
    }
    const last = level > 0 ? vals[level - 1][c.from] : 0;
    const cur = vals[level][c.from];
    if (((c.minLevel == null || level >= c.minLevel) && cur !== last) || c.minLevel == level) {
      events.push(new Event(`${cur}${c.to ?? c.from}`));
    }
  }

  return events;
}

export function researchLevelDesc(engine: Engine, field: ResearchField, level: number, long: boolean): string[] {
  const events = researchEventsWithCounters(engine, field, level);
  const effects = events.map((e) => eventDescForCounters(e, engine.expansions, long));

  if (level == 5) {
    switch (field) {
      case ResearchField.Economy:
      case ResearchField.Science:
        if (long) {
          effects.push("Remember that you no longer receive the income from level 4");
        }
        break;
      case ResearchField.Terraforming:
        effects.push(
          long
            ? "Immediately gain the federation token placed here. Gaining this federation token counts as “Forming a Federation.” Remember that you must have a previously acquired federation token in order to advance to level 5 of this research area and claim the federation token there"
            : "Immediately gain the terraforming federation"
        );
        break;
      case ResearchField.Navigation:
        effects.push(
          long
            ? "Immediately place the Lost Planet token on an accessible space that does not contain a planet, satellite, or space station. The accessibility of a space follows the same rules as the  “Build a Mine” action. This counts as a “Build a Mine” action, meaning you can gain VP and your opponents can gain power. Do not place a mine on the Lost Planet token. You are considered to have colonized the planet; place one of your satellites on the Lost Planet token as a reminder. The Lost Planet counts as its own planet type, and as a planet with a mine. You cannot upgrade this mine"
            : "Immediately place the lost planet"
        );
    }
  }

  if (long && effects.length == 0) {
    effects.push("This level has no effect");
  }
  return effects.map((e) => e + ".");
}

export function researchColorVar(field: ResearchField): string {
  return `--rt-${field}`;
}

export function researchColor(field: ResearchField): CellStyle {
  return staticCellStyle(researchColorVar(field));
}
