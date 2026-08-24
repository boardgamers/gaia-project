/**
 * Tier-3 Lost Fleet rules oracles (FUZZER_PLAN.md §3 tier 3).
 *
 * Oracle-traceability rule: every oracle here carries a citation to its rule source
 * (RULES_CLARIFICATIONS.md §x and/or rulebook-v1.0.txt) and its assertion text repeats the rule.
 * Expected values are encoded INDEPENDENTLY from the ledger — never read back from the engine
 * helpers under test.
 *
 * These oracles primarily verify the engine's OFFERS (available commands on each committed
 * state): if the engine offers a build/explore at the wrong cost, the offer itself is the bug,
 * whether or not the fuzzer happens to play it. Chained mid-line sub-offers (ship-action builds,
 * Federation-token builds) have their own cost rules and never appear at line boundaries, so
 * they are exercised by the unit suite and the tier-1/2 oracles instead.
 */
import { AvailableBuilding } from "../../available/types";
import Engine from "../../engine";
import { Building, Command, Faction, Phase, Planet, Resource, Spaceship } from "../../enums";
import { factionPlanet } from "../../factions";
import { GaiaHex } from "../../gaia-hex";
import Reward from "../../reward";
import { Oracle, OracleContext } from "./types";

/** The 7 base terrain colors of the planet cycle (base rulebook; §B5 "the 7 base colors"). */
const TERRAIN_COLORS: readonly Planet[] = [
  Planet.Terra,
  Planet.Oxide,
  Planet.Volcanic,
  Planet.Desert,
  Planet.Swamp,
  Planet.Titanium,
  Planet.Ice,
];

/**
 * §C5: the shared 4-space exploration charge track is 0 / 2 / 2 / 3.
 */
const EXPLORATION_CHARGE_TRACK_C5: readonly number[] = [0, 2, 2, 3];

const LF_FACTIONS: readonly Faction[] = [Faction.Tinkeroids, Faction.Darkanians, Faction.Moweyds, Faction.SpaceGiants];

function rewardCount(cost: string, type: Resource): number {
  if (!cost || cost === "~") {
    return 0;
  }
  return Reward.parse(cost)
    .filter((r) => r.type === type)
    .reduce((acc, r) => acc + r.count, 0);
}

/**
 * §B2/§B4 vs §B1/§B5 (all CONFIRMED): a mine on a Gaia planet costs 2 Q.I.C. for Darkanians and
 * Space Giants, and the normal 1 Q.I.C. for Tinkeroids and Moweyds.
 */
function gaiaQicSurcharge(faction: Faction): number {
  return faction === Faction.Darkanians || faction === Faction.SpaceGiants ? 2 : 1;
}

/**
 * Independent re-statement of the LF terraform-step rules (never calls the engine's
 * terraformingStepsRequired):
 * - §E1: Protoplanet always takes exactly 3 terraforming steps, for every faction.
 * - §E2: Asteroid takes 0 steps (a Gaiaformer is consumed instead).
 * - §B2: Darkanians terraform any terrain color in a flat 1 step.
 * - §B4: Space Giants terraform any terrain color in a flat 2 steps.
 * - §B5: Tinkeroids/Moweyds pay 3 steps for their per-game cost-3 colors, 1 for all others.
 * Returns null when the ledger has no independent expectation (base factions - trusted).
 */
function expectedSteps(faction: Faction, target: Planet, cost3: Planet[] | undefined): number | null {
  if (target === Planet.Protoplanet) {
    return 3;
  }
  if (target === Planet.Asteroid) {
    return 0;
  }
  if (!TERRAIN_COLORS.includes(target)) {
    return null;
  }
  switch (faction) {
    case Faction.Darkanians:
      return 1;
    case Faction.SpaceGiants:
      return 2;
    case Faction.Tinkeroids:
    case Faction.Moweyds:
      return (cost3 ?? []).includes(target) ? 3 : 1;
    default:
      return null; // base faction: planet-cycle math, trusted
  }
}

/**
 * Build offers on the main-move menu obey the Lost Fleet planet/faction cost rules:
 * - §E1 (rulebook p.10 "Changes to the Base Game Actions"): a Protoplanet mine takes exactly 3
 *   terraforming steps and awards +6 VP on build (encoded by the engine as a `-6vp` cost reward).
 * - §E2 (p.10): an Asteroid mine pays NO ore/credit build cost (the Gaiaformer is the cost).
 * - §B2/§B4/§B5: the LF factions' flat terraform-step rules (see expectedSteps).
 * - §B2/§B4 vs §B1/§B5: the mine-on-Gaia Q.I.C. surcharge (2 for Darkanians/Space Giants, 1 for
 *   Tinkeroids/Moweyds); checked as >= in general (range Q.I.C. is additive) and as == when an
 *   owned planet is provably within base range (so the range component is provably 0).
 */
export const lfBuildOffers: Oracle = {
  name: "tier3.lf.build-offers",
  citation: "RULES_CLARIFICATIONS.md §E1/§E2 (rulebook p.10), §B1/§B2/§B4/§B5 (p.13)",
  afterLine(ctx: OracleContext): string[] {
    if (!ctx.lostFleet) {
      return [];
    }
    const engine = ctx.engine;
    if (engine.phase !== Phase.RoundMove && engine.phase !== Phase.SetupBuilding) {
      return [];
    }
    const messages: string[] = [];

    for (const command of engine.generateAvailableCommandsIfNeeded()) {
      if (command.name !== Command.Build) {
        continue;
      }
      const player = engine.player(command.player);
      if (!player?.faction) {
        continue;
      }
      for (const b of (command.data as { buildings: AvailableBuilding[] }).buildings) {
        checkBuildOffer(engine, player.faction, command.player, b, messages);
      }
    }
    return messages;
  },
};

function checkBuildOffer(
  engine: Engine,
  faction: Faction,
  player: number,
  b: AvailableBuilding,
  messages: string[]
): void {
  if (b.building !== Building.Mine && b.building !== Building.PlanetaryInstitute) {
    return;
  }
  let hex: GaiaHex;
  try {
    hex = engine.map.getS(b.coordinates);
  } catch {
    messages.push(`offered build coordinates ${b.coordinates} cannot be resolved on the map`);
    return;
  }
  if (hex.occupied()) {
    return; // Lantids guest mines etc. — different cost rules, base-game surface
  }
  const target = hex.data.planet;
  const label = `${faction} ${b.building} on ${target} at ${b.coordinates} (phase ${engine.phase})`;

  if (engine.phase === Phase.SetupBuilding) {
    // §B1-§B4 (p.13): starting buildings are free placements — no VP bonus, no cost.
    if (rewardCount(b.cost, Resource.VictoryPoint) !== 0) {
      messages.push(`${label}: setup placement must not carry a VP reward/cost, got "${b.cost}"`);
    }
    return;
  }

  // §E1: Protoplanet mine = exactly 3 steps and +6 VP, "0 if it's your start planet". Starting
  // placements already returned above in Phase.SetupBuilding, so every offer here is a later
  // Build-a-Mine action and receives +6 VP, including Moweyds and Space Giants.
  if (target === Planet.Protoplanet) {
    if ((b.steps ?? 0) !== 3) {
      messages.push(`${label}: §E1 requires exactly 3 terraforming steps, offer says ${b.steps}`);
    }
    const expectedVpBonus = -6;
    if (rewardCount(b.cost, Resource.VictoryPoint) !== expectedVpBonus) {
      messages.push(
        `${label}: §E1 requires a ${-expectedVpBonus} VP bonus on this Protoplanet mine, cost "${
          b.cost
        }" does not grant it`
      );
    }
  }

  // §E2: Asteroid mine pays no ore/credit build cost (Gaiaformer consumed instead), 0 steps.
  if (target === Planet.Asteroid) {
    if (rewardCount(b.cost, Resource.Ore) > 0 || rewardCount(b.cost, Resource.Credit) > 0) {
      messages.push(`${label}: §E2 waives the mine's ore/credit build cost on an Asteroid, got "${b.cost}"`);
    }
    if ((b.steps ?? 0) !== 0) {
      messages.push(`${label}: §E2 Asteroid colonization has no terraforming steps, offer says ${b.steps}`);
    }
  }

  // §B2/§B4/§B5 terraform-step rules for the 4 LF factions.
  const steps = expectedSteps(faction, target, engine.player(player)?.data.lostFleetCost3Planets);
  if (steps !== null && TERRAIN_COLORS.includes(target) && (b.steps ?? 0) !== steps) {
    messages.push(
      `${label}: ledger requires ${steps} terraforming step(s) for this faction/color, offer says ${b.steps}`
    );
  }

  // §B2/§B4 vs §B1/§B5 Gaia Q.I.C. surcharge (LF factions only; Gleens pays ore, base trusted).
  if (target === Planet.Gaia && LF_FACTIONS.includes(faction)) {
    const surcharge = gaiaQicSurcharge(faction);
    const qic = rewardCount(b.cost, Resource.Qic);
    if (qic < surcharge) {
      messages.push(
        `${label}: mine on Gaia must cost at least the faction's ${surcharge} Q.I.C. surcharge, offer costs ${qic}`
      );
    }
    const pl = engine.player(player);
    if (pl.data.temporaryRange === 0 && withinBaseRange(engine, pl.data.occupied, hex, pl.data.range)) {
      if (qic !== surcharge) {
        messages.push(
          `${label}: an owned planet is within base range, so the Gaia mine must cost exactly the ${surcharge} Q.I.C. surcharge, offer costs ${qic}`
        );
      }
    }
  }
}

/** True if any occupied (non-Gaiaformer-only) hex is within `range` of `hex` on the grid. */
function withinBaseRange(engine: Engine, occupied: GaiaHex[], hex: GaiaHex, range: number): boolean {
  return occupied.some((source) => engine.map.distance(source, hex) <= range);
}

/**
 * Explore offers obey the exploration rules:
 * - §C5: the 4-space charge track is 0/2/2/3,
 *   space 1 charging nothing (its occupant is by definition the first explorer, §D1).
 * - §D1: the shuttle goes to the lowest-numbered free space of that ship.
 * - §D2/§D5 (rulebook p.9, exhaustive): deploying costs 5 VP — 7 VP only for Bal T'aks.
 * - §C2/§H3: Rebellion is not in play (never offered) in 2-player games.
 */
export const lfExploreOffers: Oracle = {
  name: "tier3.lf.explore-offers",
  citation: "RULES_CLARIFICATIONS.md §C5, §D1, §D2/§D5 (rulebook p.9), §C2/§H3 (p.5-6)",
  afterLine(ctx: OracleContext): string[] {
    if (!ctx.lostFleet) {
      return [];
    }
    const engine = ctx.engine;
    const messages: string[] = [];

    for (const command of engine.generateAvailableCommandsIfNeeded()) {
      if (command.name !== Command.Explore) {
        continue;
      }
      const pl = engine.player(command.player);
      for (const offer of command.data.ships) {
        const label = `${pl.faction} explore ${offer.ship} (slot ${offer.slot})`;

        if (ctx.players === 2 && offer.ship === Spaceship.Rebellion) {
          messages.push(`${label}: §C2 removes Rebellion entirely from 2-player games`);
        }
        if (offer.slot < 1 || offer.slot > 4) {
          messages.push(`${label}: §C5 has exactly 4 shuttle spaces per ship`);
          continue;
        }
        const expectedCharge = EXPLORATION_CHARGE_TRACK_C5[offer.slot - 1];
        if (offer.charge !== expectedCharge) {
          messages.push(
            `${label}: §C5 charge track (0/2/2/3) gives ${expectedCharge} power for space ${offer.slot}, offer says ${offer.charge}`
          );
        }
        // §D1: lowest-numbered free space.
        const occupiedSlots = engine.players
          .map((p) => p.data.explorationShips[offer.ship])
          .filter((slot): slot is number => slot !== undefined);
        const lowestFree = [1, 2, 3, 4].find((slot) => !occupiedSlots.includes(slot));
        if (offer.slot !== lowestFree) {
          messages.push(`${label}: §D1 places the shuttle on the lowest free space, which is ${lowestFree}`);
        }
        if (occupiedSlots.includes(offer.slot)) {
          messages.push(`${label}: shuttle space ${offer.slot} is already occupied`);
        }
        if (pl.data.explorationShips[offer.ship] !== undefined) {
          messages.push(`${label}: §D1 forbids a second shuttle on the same ship`);
        }
        // §D2/§D5: 5 VP deploy cost, 7 VP for Bal T'aks; everything else in the cost is range Q.I.C.
        const expectedVp = pl.faction === Faction.BalTaks ? 7 : 5;
        if (rewardCount(offer.cost, Resource.VictoryPoint) !== expectedVp) {
          messages.push(
            `${label}: §D2/§D5 deploy cost is ${expectedVp} VP for ${pl.faction}, offer costs "${offer.cost}"`
          );
        }
      }
    }
    return messages;
  },
};

/**
 * Faction-selection rules:
 * - §A4 (owner-confirmed): same-color exclusivity, including the two new pairs
 *   Tinkeroids↔Darkanians (Asteroid) and Moweyds↔Space Giants (Protoplanet).
 * - §B5 (rulebook p.8 + owner 2026-06-30): Tinkeroids'/Moweyds' cost-3 set has exactly 3 terrain
 *   colors; every color-bearing opponent's home color is in it; the filler colors are never an
 *   opponent's home color. (The exact left-to-right fill order is the same algorithm as the
 *   engine's — rechecking it verbatim would be a tautology, so the oracle checks the invariants.)
 */
export const lfFactionSetup: Oracle = {
  name: "tier3.lf.faction-setup",
  citation: "RULES_CLARIFICATIONS.md §A4 (p.7 + owner), §B5 (p.8 + owner 2026-06-30)",
  afterLine(ctx: OracleContext): string[] {
    if (!ctx.lostFleet) {
      return [];
    }
    const engine = ctx.engine;
    if (engine.players.some((pl) => !pl.faction)) {
      return []; // faction selection still in progress
    }
    const messages: string[] = [];

    // §A4: pairwise-distinct home colors (factionPlanet doubles as the pairing color for the LF
    // factions: Asteroid for Tinkeroids/Darkanians, Protoplanet for Moweyds/Space Giants).
    const colors = engine.players.map((pl) => factionPlanet(pl.faction));
    if (new Set(colors).size !== colors.length) {
      messages.push(
        `§A4 same-color exclusivity violated: factions ${engine.players.map((p) => p.faction)} share a color`
      );
    }

    for (const pl of engine.players) {
      if (pl.faction !== Faction.Tinkeroids && pl.faction !== Faction.Moweyds) {
        continue;
      }
      const cost3 = pl.data.lostFleetCost3Planets ?? [];
      const label = `${pl.faction} cost-3 set [${cost3}]`;
      if (cost3.length !== 3 || new Set(cost3).size !== 3) {
        messages.push(`${label}: §B5 requires exactly 3 distinct cost-3 colors`);
      }
      if (cost3.some((c) => !TERRAIN_COLORS.includes(c))) {
        messages.push(`${label}: §B5 cost-3 colors must be base terrain colors`);
      }
      const opponentColors = engine.players
        .filter((other) => other.player !== pl.player)
        .map((other) => factionPlanet(other.faction))
        .filter((planet) => TERRAIN_COLORS.includes(planet));
      for (const color of opponentColors) {
        if (!cost3.includes(color)) {
          messages.push(`${label}: §B5 requires opponent home color ${color} to cost 3 steps`);
        }
      }
    }
    return messages;
  },
};

/**
 * Map composition: §H3 (owner-confirmed per-set table) — the spaceship tiles in play are the 3
 * non-Rebellion ships at 2p and all 4 ships at 3p/4p, each appearing exactly once on the board.
 */
export const lfMapComposition: Oracle = {
  name: "tier3.lf.map-ships",
  citation: "RULES_CLARIFICATIONS.md §H3 (p.5 sidebar + owner), §C2 (Rebellion excluded at 2p)",
  afterLine(ctx: OracleContext): string[] {
    if (!ctx.lostFleet) {
      return [];
    }
    // The board is generated once at init and never changes — checking every line is redundant
    // but cheap; simpler and safer than trying to detect "setup just finished".
    const ships = [...ctx.engine.map.grid.values()]
      .map((hex) => hex.data.spaceship)
      .filter((s): s is Spaceship => s !== undefined)
      .sort();
    const expected = (
      ctx.players === 2
        ? [Spaceship.Twilight, Spaceship.TFMars, Spaceship.Eclipse]
        : [Spaceship.Twilight, Spaceship.Rebellion, Spaceship.TFMars, Spaceship.Eclipse]
    ).sort();
    if (ships.join(",") !== expected.join(",")) {
      return [`§H3 ship tiles in play should be exactly [${expected}] for ${ctx.players}p, found [${ships}]`];
    }
    return [];
  },
};

/** First-half tier-3 set (plan §6 phase 3: planets/factions/costs/VP rows). */
export function lostFleetOraclesPhase3(): Oracle[] {
  return [lfBuildOffers, lfExploreOffers, lfFactionSetup, lfMapComposition];
}
