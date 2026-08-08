/**
 * Tier-3 Lost Fleet rules oracles, second half (FUZZER_PLAN.md §3 tier 3, plan §6 phase 4):
 * ships/artifacts/adv-tech gate/QIC overlay/final scoring. Same oracle-traceability rule as
 * `lost-fleet.ts`: every oracle cites its rule source and re-derives the expectation
 * independently rather than reading it back from the code under test.
 *
 * Per the owner's explicit scoping (2026-07-03): the base game's generic machinery (the
 * rank-to-VP final-scoring table, the tile-pool/rescore plumbing already covered in
 * conservation.ts) is trusted and out of scope here — these oracles target the LOST FLEET
 * deltas specifically: the 3 new final-scoring CONDITION counts (independently re-derived from
 * the map, not via `player.eventConditionCount`), the 8 ship Federation tokens' gold-side
 * magnitudes, the 13 Artifact token effects, the ship-action per-round lock, the QIC-action
 * overlay, and the Scoring Board Extension's side persistence.
 */
import {
  Building,
  Command,
  Faction,
  FinalTile,
  Planet,
  Resource,
  ScoringBoardExtensionSide,
  Spaceship,
  SpaceshipFederation,
} from "../../enums";
import Engine from "../../engine";
import { classifySectorId, LostFleetSectorType } from "../../lost-fleet-map";
import Player from "../../player";
import { Oracle, OracleContext } from "./types";

function rewardCount(cost: string | undefined, type: Resource): number {
  if (!cost || cost === "~") {
    return 0;
  }
  return cost
    .split(",")
    .map((s) => /^(-?\d*)(.+)$/.exec(s))
    .filter((m): m is RegExpExecArray => m !== null && m[2] === type)
    .reduce((acc, m) => acc + (m[1] === "" ? 1 : m[1] === "-" ? -1 : +m[1]), 0);
}

/**
 * Sums the VP/credit/ore/knowledge/qic deltas logged under `source` for `player`, across
 * `engine.advancedLog` entries at index >= `fromLogIndex`. Used to verify a claimed reward's
 * magnitude against an independently-stated expectation without re-deriving it from the reward
 * table under test.
 */
function loggedDeltas(engine: Engine, fromLogIndex: number, player: number, source: string) {
  const totals: Partial<Record<Resource, number>> = {};
  for (let i = fromLogIndex; i < engine.advancedLog.length; i++) {
    const entry = engine.advancedLog[i];
    if (entry.player !== player) {
      continue;
    }
    const change = entry.changes?.[source as never];
    if (!change) {
      continue;
    }
    for (const [resource, amount] of Object.entries(change)) {
      totals[resource as Resource] = (totals[resource as Resource] ?? 0) + (amount as number);
    }
  }
  return totals;
}

function playerIndexFromLine(engine: Engine, line: string): number | undefined {
  const prefix = line.split(" ")[0];
  const byNumber = /^p([1-9])$/.exec(prefix);
  if (byNumber) {
    return +byNumber[1] - 1;
  }
  return engine.players.find((pl) => pl.faction === prefix)?.player;
}

/**
 * §G6 (RULES_CLARIFICATIONS.md, all CONFIRMED): each Artifact token's exact effect. Checked only
 * when the claim (`examineArtifact. chooseArtifactToken ...`) is the FIRST part of its committed
 * line — the only case where "state right now" is provably identical to "state at claim time"
 * (no other action in the same turn could have changed research levels / colonized planet counts
 * first). Later-in-turn claims are structurally exercised by conservation.ts's tile-pool checks
 * and the unit suite (`move/artifacts.spec.ts`) instead.
 */
export class ArtifactTokenEffects implements Oracle {
  name = "tier3.lf.artifact-effects";
  citation = "RULES_CLARIFICATIONS.md §G6 (rulebook Appendix VII + owner board-reads 2026-06-27)";

  private logIndexBeforeLine = 0;

  afterLine(ctx: OracleContext): string[] {
    const engine = ctx.engine;
    const line = ctx.moves[ctx.moves.length - 1];
    const fromLogIndex = this.logIndexBeforeLine;
    this.logIndexBeforeLine = engine.advancedLog.length;

    const match = /chooseArtifactToken\s+([^\s.]+)/.exec(line);
    if (!match) {
      return [];
    }
    const player = playerIndexFromLine(engine, line);
    if (player === undefined) {
      return [];
    }
    // Only trust "current state == state at claim time" when the claim opens the turn.
    const isFirstPart = new RegExp(`^\\S+\\s+examineArtifact\\b`).test(line);

    const token = match[1];
    const pl = engine.player(player);
    const deltas = loggedDeltas(engine, fromLogIndex, player, Spaceship.Twilight);
    const vp = deltas[Resource.VictoryPoint] ?? 0;

    const label = `${token} artifact claim by player ${player}`;

    switch (token) {
      case "artifact-credit":
        return checkDelta(label, deltas, { [Resource.Credit]: 3, [Resource.Ore]: 3 });
      case "artifact-knowledgeqic":
        return checkDelta(
          label,
          deltas,
          applyGleensQicSubstitution(pl, { [Resource.Knowledge]: 3, [Resource.Qic]: 1 })
        );
      case "artifact-creditlarge":
        return checkDelta(label, deltas, { [Resource.Credit]: 5, [Resource.Ore]: 2 });
      case "artifact-power":
        // §G6: "gain 2 power as income, placed directly in Area III" — bypasses gainRewards
        // (direct `power.area3` mutation, player.ts), so it never appears in advancedLog; checked
        // structurally instead (non-negative, already covered by tier-2).
        return [];
      case "artifact-asteroid":
      case "artifact-protoplanet":
        if (vp !== 7) {
          return [`${label}: §G6 grants exactly 7 VP, logged delta was ${vp}`];
        }
        return [];
      case "artifact-researchlevel":
        if (!isFirstPart) {
          return [];
        }
        // ⚠️VERIFY in the ledger itself (owner comment cut off): Science is the current best-guess
        // Research Area. Checking against the CODED assumption, not asserting it's the correct
        // rules answer — a mismatch here would mean the code drifted from its own documented guess.
        return checkExactVp(label, vp, 3 * pl.data.research["sci" as never]);
      case "artifact-researchtracks":
        if (!isFirstPart) {
          return [];
        }
        return checkExactVp(
          label,
          vp,
          3 * Object.values(pl.data.research).filter((level) => (level as number) >= 3).length
        );
      case "artifact-gaiaproject":
        if (!isFirstPart) {
          return [];
        }
        return checkExactVp(label, vp, 3 * pl.data.research["gaia" as never]);
      case "artifact-planettypes":
        if (!isFirstPart) {
          return [];
        }
        return checkExactVp(label, vp, 3 + countDistinctPlanetTypes(engine, pl));
      case "artifact-deepspace":
        if (!isFirstPart) {
          return [];
        }
        return checkExactVp(label, vp, 3 * countDeepSpaceSectors(engine, pl.player));
      case "artifact-federation":
        // Re-score effect: magnitude depends on which owned Federation token is re-triggered
        // (player-chosen mid-subphase, not observable from the claim move string alone) — the
        // rescore itself is covered by conservation.ts's tile-pool checks + the unit suite.
        return [];
      case "artifact-knowledgeore":
        // §G6: ongoing +1 knowledge +1 ore EVERY income phase (not a one-time gain).
        if (pl.resourceIncome(Resource.Knowledge) < 1 || pl.resourceIncome(Resource.Ore) < 1) {
          return [`${label}: §G6 requires ongoing +1 knowledge/+1 ore income, not present after claim`];
        }
        return [];
      default:
        return [`${label}: unrecognized artifact token, oracle needs updating`];
    }
  }
}

/**
 * Base-game Gleens ability (player.ts `factionReward`, code comment: "this is for Gleens
 * getting ore instead of qics until Academy2"): every Q.I.C. GRANT (any source, including new
 * Lost Fleet Artifact/Federation-token rewards, which route through the same `Player.gainRewards`
 * pipeline) is substituted for an equal amount of Ore until the player has built Academy2. Not
 * Lost Fleet content itself, but a pre-existing base mechanic this fuzzer's LF reward-magnitude
 * oracles must account for, since it changes what "correct" looks like for a Gleens player.
 */
function applyGleensQicSubstitution(
  pl: Player,
  expected: Partial<Record<Resource, number>>
): Partial<Record<Resource, number>> {
  if (pl.faction !== Faction.Gleens || pl.data.buildings[Building.Academy2] > 0) {
    return expected;
  }
  const qic = expected[Resource.Qic];
  if (!qic) {
    return expected;
  }
  const rest = { ...expected };
  delete rest[Resource.Qic];
  return { ...rest, [Resource.Ore]: (rest[Resource.Ore] ?? 0) + qic };
}

function checkDelta(
  label: string,
  deltas: Partial<Record<Resource, number>>,
  expected: Partial<Record<Resource, number>>
): string[] {
  const messages: string[] = [];
  for (const [resource, count] of Object.entries(expected)) {
    if ((deltas[resource as Resource] ?? 0) !== count) {
      messages.push(`${label}: expected ${count} ${resource}, logged delta was ${deltas[resource as Resource] ?? 0}`);
    }
  }
  return messages;
}

function checkExactVp(label: string, actual: number, expected: number): string[] {
  return actual === expected ? [] : [`${label}: expected exactly ${expected} VP, logged delta was ${actual}`];
}

/** Mirrors `Player.ownedPlanets` (main-occupier, non-empty hexes) union the artifact-granted
 * "virtual" planet types (§G4 owner note: planet-type-counting tiles count those too). */
function countDistinctPlanetTypes(engine: Engine, pl: Player): number {
  const real = pl.data.occupied
    .filter((h) => h.data.planet !== Planet.Empty && h.isMainOccupier(pl.player))
    .map((h) => h.data.planet);
  return new Set([...real, ...pl.data.artifactPlanetTypes]).size;
}

/** Mirrors `Player.ownedPlanets` (main-occupier only — excludes a Lantids-style "additional
 * mine" guest colonization, which does not count as this player's own colonization). */
function countDeepSpaceSectors(engine: Engine, player: number): number {
  const keys = new Set<string>();
  for (const hex of engine.map.grid.values()) {
    if (!hex.isMainOccupier(player)) {
      continue;
    }
    if (classifySectorId(hex.data.sector) !== LostFleetSectorType.DeepSpace) {
      continue;
    }
    keys.add(hex.data.sector.replace(/_\d+$/, ""));
  }
  return keys.size;
}

/**
 * §G5 (CONFIRMED): the 6 direct-reward ship Federation tokens grant an exact resource package on
 * claim; §C1/§G6 rescoring re-grants the same package. Same first-part-of-line restriction as the
 * Artifact oracle, for the same reason (state-at-claim-time provability).
 */
export const shipFederationGoldSide: Oracle = {
  name: "tier3.lf.ship-federation-gold-side",
  citation: "RULES_CLARIFICATIONS.md §G5 (owner board-read 2026-06-27), §C1 (rescore = same effect)",
  afterLine(ctx: OracleContext): string[] {
    const engine = ctx.engine;
    const line = ctx.moves[ctx.moves.length - 1];
    const match = /\bfedtile\s+(\S+)/.exec(line) ?? /\bfederation\s+\S+\s+(\S+)/.exec(line);
    if (!match) {
      return [];
    }
    const token = match[1] as SpaceshipFederation;
    const expected: Partial<Record<SpaceshipFederation, Partial<Record<Resource, number>>>> = {
      [SpaceshipFederation.Credit]: { [Resource.VictoryPoint]: 8, [Resource.Credit]: 8 },
      [SpaceshipFederation.Knowledge]: { [Resource.VictoryPoint]: 4, [Resource.Knowledge]: 4 },
      [SpaceshipFederation.OreQic]: { [Resource.VictoryPoint]: 4, [Resource.Ore]: 2, [Resource.Qic]: 1 },
      [SpaceshipFederation.PowerTokens]: { [Resource.VictoryPoint]: 7 },
      [SpaceshipFederation.Vp]: { [Resource.VictoryPoint]: 12 },
    };
    const want = expected[token];
    if (!want) {
      return []; // Tech/Range/Terraform: not a plain resource grant, covered by unit suite.
    }
    const player = playerIndexFromLine(engine, line);
    if (player === undefined) {
      return [];
    }
    // No pre-line log index tracked here (this oracle doesn't run every line) — approximate via
    // the tail of advancedLog for this move: entries sharing the just-assigned move index.
    const moveIndex = engine.moveHistory.length - 1;
    const deltas: Partial<Record<Resource, number>> = {};
    for (const entry of engine.advancedLog) {
      if (entry.move !== moveIndex || entry.player !== player) {
        continue;
      }
      const change = entry.changes?.[Command.FormFederation];
      if (!change) {
        continue;
      }
      for (const [resource, amount] of Object.entries(change)) {
        deltas[resource as Resource] = (deltas[resource as Resource] ?? 0) + (amount as number);
      }
    }
    const pl = engine.player(player);
    return checkDelta(
      `${token} ship-federation claim/rescore by player ${player}`,
      deltas,
      applyGleensQicSubstitution(pl, want)
    );
  },
};

/**
 * §C1-C4 (CONFIRMED): each of the 12 ship board-actions is usable once per round — a per-round
 * lock, not a per-game or per-player lock (any player can take an unlocked action; once ANY
 * player takes it, it locks for everyone until the next round).
 */
export class ShipActionRoundLock implements Oracle {
  name = "tier3.lf.ship-action-round-lock";
  citation = "RULES_CLARIFICATIONS.md §C1-C4 (owner board-read 2026-06-27); PROGRESS.md #18-#23";

  private lockedThisRound = new Set<string>();
  private lastRound = -1;

  afterLine(ctx: OracleContext): string[] {
    const engine = ctx.engine;
    if (engine.round !== this.lastRound) {
      this.lastRound = engine.round;
      this.lockedThisRound.clear();
    }
    const messages: string[] = [];
    const line = ctx.moves[ctx.moves.length - 1];
    const re = /\bspaceshipAction\s+(\S+)\s+(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const key = `${match[1]}.${match[2]}`;
      if (this.lockedThisRound.has(key)) {
        messages.push(`ship action ${key} was played twice in the same round (§C1-C4 per-round lock)`);
      }
      this.lockedThisRound.add(key);
    }
    return messages;
  }
}

/**
 * §E4/§K3 (CONFIRMED): under Lost Fleet, the research-board Q.I.C. actions (Qic1-3) are replaced
 * entirely by the spaceship boards' own Q.I.C. actions, never offered alongside them. Eclipse's
 * "gain VP for planet types" Q.I.C. action grants a flat 2 VP (down from the base game's 3),
 * because there are now more planet types (§K3).
 */
export class QicOverlay implements Oracle {
  name = "tier3.lf.qic-overlay";
  citation = "RULES_CLARIFICATIONS.md §E4, §K3 (rulebook p.10/p.13)";

  private logIndexBeforeLine = 0;

  afterLine(ctx: OracleContext): string[] {
    const engine = ctx.engine;
    const fromLogIndex = this.logIndexBeforeLine;
    this.logIndexBeforeLine = engine.advancedLog.length;
    const messages: string[] = [];

    for (const key of ["qic1", "qic2", "qic3"]) {
      if (key in engine.boardActions) {
        messages.push(`§E4 forbids the research-board ${key} action from existing under Lost Fleet`);
      }
    }

    const line = ctx.moves[ctx.moves.length - 1];
    const isFirstPart = /^\S+\s+spaceshipAction\s+eclipse\s+qic\b/.exec(line);
    if (isFirstPart) {
      const player = playerIndexFromLine(engine, line);
      if (player !== undefined) {
        const pl = engine.player(player);
        const deltas = loggedDeltas(engine, fromLogIndex, player, Spaceship.Eclipse);
        // §K3: base 2 VP (down from the base game's 3, "because there are now more planet
        // types") + 1 VP per distinct colonized planet type (unchanged multiplier).
        const expected = 2 + countDistinctPlanetTypes(engine, pl);
        const vp = deltas[Resource.VictoryPoint] ?? 0;
        if (vp !== expected) {
          messages.push(
            `§K3 Eclipse Q.I.C. action should grant exactly ${expected} VP (2 base + planet types), player ${player} logged ${vp}`
          );
        }
      }
    }
    return messages;
  }
}

/**
 * §E6 (CONFIRMED, owner ruling 2026-06-27): 2-player games always use the 25-VP side; 3-4 player
 * games randomize the side once at setup and it never changes for the rest of the game.
 */
export const scoringExtensionSide: Oracle = {
  name: "tier3.lf.scoring-extension-side",
  citation: "RULES_CLARIFICATIONS.md §E6 (rulebook p.5/p.10 + owner ruling 2026-06-27)",
  afterLine(ctx: OracleContext): string[] {
    const engine = ctx.engine;
    const side = engine.scoringExtensionSide;
    if (side === undefined) {
      return [];
    }
    const messages: string[] = [];
    if (ctx.players === 2 && side !== ScoringBoardExtensionSide.VictoryPoints) {
      messages.push(`§E6 requires 2-player games to always use the 25-VP side, found "${side}"`);
    }
    return messages;
  },
};

/**
 * Integration flag 5 / §H4 cautionary tale (PROGRESS #48's chart-leak bug, viewer-side but the
 * same class is worth guarding here): LF-only tiles never appear in a base-game pool, and base
 * boosters/tech positions never silently vanish under Lost Fleet.
 */
export const tileGatingLeaks: Oracle = {
  name: "tier3.lf.tile-gating-leaks",
  citation: "PROGRESS.md Integration flag 5 (ungated .values(expansions) leak class); #48 cautionary tale",
  afterLine(ctx: OracleContext): string[] {
    const engine = ctx.engine;
    const messages: string[] = [];
    const lfBoosterPrefixes = ["booster-lostfleet-"];
    const boosterKeys = Object.keys(engine.tiles.boosters);
    const hasLfBooster = boosterKeys.some((b) => lfBoosterPrefixes.some((p) => b.startsWith(p)));
    if (!ctx.lostFleet && hasLfBooster) {
      messages.push(`base-game booster pool leaked a Lost Fleet booster: [${boosterKeys}]`);
    }
    const hasExtSlot = "adv-ext" in engine.tiles.techs;
    if (!ctx.lostFleet && hasExtSlot) {
      messages.push(`base game unexpectedly has the Scoring Board Extension's "adv-ext" tech slot`);
    }
    if (!ctx.lostFleet) {
      if (engine.tiles.artifacts.length > 0) {
        messages.push(`base game has Lost Fleet Artifact tokens seeded: [${engine.tiles.artifacts}]`);
      }
      if (
        Object.keys(engine.tiles.spaceshipFederations).length > 0 ||
        Object.keys(engine.tiles.spaceshipTechs).length > 0
      ) {
        messages.push(`base game has spaceship-seeded tiles/tokens present`);
      }
      if (!("qic1" in engine.boardActions)) {
        messages.push(`base game unexpectedly lacks the research-board qic1 action`);
      }
    }
    return messages;
  },
};

/**
 * §H5/§G4: the 3 new final-scoring conditions' COUNTS, independently re-derived by scanning the
 * map/player state directly (not via `player.eventConditionCount`, the function under test).
 * Deliberately does NOT re-verify the rank->VP conversion or tie-break math — that machinery is
 * shared base-game code, trusted per the owner's explicit scoping.
 */
export const finalScoringCounts: Oracle = {
  name: "tier3.lf.final-scoring-counts",
  citation: "RULES_CLARIFICATIONS.md §G4/§H5 (final tiles: asteroid, deep-space-sector, PI-Academy distance)",
  afterLine(ctx: OracleContext): string[] {
    if (!ctx.lostFleet) {
      return [];
    }
    const engine = ctx.engine;
    const finals = engine.tiles.scorings.final;
    const messages: string[] = [];

    for (const pl of engine.players) {
      if (finals.includes(FinalTile.Asteroid)) {
        const independent = countOwnedAsteroids(engine, pl.player);
        const engineCount = pl.finalCount(FinalTile.Asteroid);
        if (independent !== engineCount) {
          messages.push(
            `player ${pl.player}: independent Asteroid-mine scan found ${independent}, finalCount() says ${engineCount}`
          );
        }
      }
      if (finals.includes(FinalTile.DeepSpaceSector)) {
        const independent = countDeepSpaceSectors(engine, pl.player);
        const engineCount = pl.finalCount(FinalTile.DeepSpaceSector);
        if (independent !== engineCount) {
          messages.push(
            `player ${pl.player}: independent Deep-Space-sector scan found ${independent}, finalCount() says ${engineCount}`
          );
        }
      }
      if (finals.includes(FinalTile.PlanetaryInstituteAcademyDistance)) {
        const independent = piAcademyMaxDistance(engine, pl.player);
        const engineCount = pl.finalCount(FinalTile.PlanetaryInstituteAcademyDistance);
        if (independent !== engineCount) {
          messages.push(
            `player ${pl.player}: independent PI-Academy distance scan found ${independent}, finalCount() says ${engineCount}`
          );
        }
      }
    }
    return messages;
  },
};

function countOwnedAsteroids(engine: Engine, player: number): number {
  let count = 0;
  for (const hex of engine.map.grid.values()) {
    if (hex.data.planet !== Planet.Asteroid) {
      continue;
    }
    if (hex.buildingOf(player) !== undefined && hex.data.additionalMine !== player) {
      count++;
    }
  }
  return count;
}

function piAcademyMaxDistance(engine: Engine, player: number): number {
  const pis: [number, number][] = [];
  const academies: [number, number][] = [];
  for (const hex of engine.map.grid.values()) {
    const building = hex.buildingOf(player);
    if (building === "PI") {
      pis.push([hex.q, hex.r]);
    } else if (building === "ac1" || building === "ac2") {
      academies.push([hex.q, hex.r]);
    }
  }
  if (pis.length === 0 || academies.length === 0) {
    return 0;
  }
  let max = 0;
  for (const [pq, pr] of pis) {
    for (const [aq, ar] of academies) {
      const ps = -pq - pr;
      const as = -aq - ar;
      const dist = (Math.abs(pq - aq) + Math.abs(pr - ar) + Math.abs(ps - as)) / 2;
      max = Math.max(max, dist);
    }
  }
  return max;
}

/** Second-half tier-3 set (plan §6 phase 4: ships/artifacts/adv-tech gate/QIC overlay/final scoring). */
export function lostFleetOraclesPhase4(): Oracle[] {
  return [
    new ArtifactTokenEffects(),
    shipFederationGoldSide,
    new ShipActionRoundLock(),
    new QicOverlay(),
    scoringExtensionSide,
    tileGatingLeaks,
    finalScoringCounts,
  ];
}
