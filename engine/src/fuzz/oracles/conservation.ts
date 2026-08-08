/**
 * Tier-2 conservation / accounting oracles (FUZZER_PLAN.md §3 tier 2, base + LF).
 *
 * Scope note (deliberate, recorded per plan §5): generic power-token conservation is NOT
 * reconciled against the advancedLog — the log only records `gain-`/`pay-` resource events
 * (engine.ts `addPlayer`), so legitimate sinks like a direct `burn` command never appear in it;
 * a log-based token reconciler would therefore flag trusted base-game behavior (exactly the
 * "noise on the control corpus = the oracle is wrong" case the plan §3 warns about). Token
 * safety is covered by the non-negativity oracle here plus exact-effect Lost Fleet checks in
 * tier 3 (e.g. the PowerTokens Federation token's +2 tokens into Area III, §G5).
 */
import { AnyTechTilePos, Booster, Federation, Player as PlayerEnum, Resource, Spaceship } from "../../enums";
import Engine from "../../engine";
import { Oracle, OracleContext } from "./types";

/** Base rulebook: every player starts the game with 10 VP. */
const STARTING_VICTORY_POINTS = 10;

/** Base game setup: 3 copies of each Federation token type are seeded into the pool (setup.ts). */
const FEDERATION_POOL_COPIES = 3;

export const nonNegativeResources: Oracle = {
  name: "tier2.conservation.non-negative",
  citation:
    "FUZZER_PLAN.md §3 tier-2: no resource is ever negative (ore, credits, knowledge, Q.I.C., VP, power in any bowl)",
  afterLine(ctx: OracleContext): string[] {
    const messages: string[] = [];
    for (const pl of ctx.engine.players) {
      const d = pl.data;
      const amounts: Array<[string, number]> = [
        ["victoryPoints", d.victoryPoints],
        ["ore", d.ores],
        ["credits", d.credits],
        ["knowledge", d.knowledge],
        ["qics", d.qics],
        ["power.area1", d.power.area1],
        ["power.area2", d.power.area2],
        ["power.area3", d.power.area3],
        ["power.gaia", d.power.gaia],
      ];
      for (const [name, amount] of amounts) {
        if (amount < 0) {
          messages.push(`player ${pl.player} (${pl.faction}) has negative ${name}: ${amount}`);
        }
      }
    }
    return messages;
  },
};

/**
 * VP reconciliation: each player's VP equals 10 (start) + the sum of their advancedLog VP deltas.
 * Catches "state changed without a logged cause" — the class of bug that silently breaks the
 * viewer's charts and score trust (plan §3 tier 2; the log substrate is engine.ts `advancedLog`).
 */
export const vpReconciliation: Oracle = {
  name: "tier2.conservation.vp-log",
  citation:
    "FUZZER_PLAN.md §3 tier-2 VP reconciliation; base rulebook (each player starts with 10 VP); engine.ts advancedLog",
  afterLine(ctx: OracleContext): string[] {
    const messages: string[] = [];
    const loggedVp = new Map<PlayerEnum, number>();
    for (const entry of ctx.engine.advancedLog) {
      if (entry.player === undefined || !entry.changes) {
        continue;
      }
      for (const change of Object.values(entry.changes)) {
        const vp = change?.[Resource.VictoryPoint];
        if (vp) {
          loggedVp.set(entry.player, (loggedVp.get(entry.player) ?? 0) + vp);
        }
      }
    }
    for (const pl of ctx.engine.players) {
      const expected = STARTING_VICTORY_POINTS + (loggedVp.get(pl.player) ?? 0);
      if (pl.data.victoryPoints !== expected) {
        messages.push(
          `player ${pl.player} (${pl.faction}) has ${pl.data.victoryPoints} VP but the advancedLog accounts for ${expected} (VP changed without a logged cause, or a logged cause without the change)`
        );
      }
    }
    return messages;
  },
};

/**
 * Tile-pool conservation: boosters, tech/adv-tech tiles (incl. ship-seeded Standard Techs),
 * Federation tokens (pool + ship-seeded), and LF Artifact tokens — nothing duplicated or leaked
 * between pool, players, and ships (plan §3 tier 2; Integration flag 5's leak class).
 */
export class TilePoolConservation implements Oracle {
  name = "tier2.conservation.tile-pools";
  citation =
    "FUZZER_PLAN.md §3 tier-2 tile-pool conservation; setup.ts seeding (3 copies per Federation token, 1 Advanced Tech per slot, boosters = players + 3); §C4 (ship-seeded tiles/tokens); §G6 (artifact tokens = player count)";

  private boosterKeys: string[] = [];
  private techInitial: Map<string, number> = new Map();
  private shipTechInitial: Map<string, number> = new Map();
  private artifactInitial: string[] = [];
  private federationTotal = 0;

  startGame(ctx: OracleContext): void {
    const engine = ctx.engine;
    this.boosterKeys = Object.keys(engine.tiles.boosters).sort();
    this.techInitial = new Map(
      Object.entries(engine.tiles.techs).map(([pos, entry]) => [pos, entry.count] as [string, number])
    );
    this.shipTechInitial = new Map(
      Object.entries(engine.tiles.spaceshipTechs).map(([ship, entry]) => [ship, entry.count] as [string, number])
    );
    this.artifactInitial = [...engine.tiles.artifacts];
    this.federationTotal = Object.values(engine.tiles.federations).reduce((a, b) => a + b, 0);
  }

  afterLine(ctx: OracleContext): string[] {
    const messages: string[] = [];
    const engine = ctx.engine;

    this.checkBoosters(engine, ctx, messages);
    this.checkTechTiles(engine, messages);
    this.checkFederations(engine, messages);
    this.checkArtifacts(engine, ctx, messages);

    return messages;
  }

  private checkBoosters(engine: Engine, ctx: OracleContext, messages: string[]): void {
    const keys = Object.keys(engine.tiles.boosters).sort();
    if (keys.join(",") !== this.boosterKeys.join(",")) {
      messages.push(`booster pool keys changed mid-game: setup [${this.boosterKeys}] vs now [${keys}]`);
    }
    if (this.boosterKeys.length !== ctx.players + 3) {
      messages.push(`booster pool has ${this.boosterKeys.length} boosters, expected players + 3 = ${ctx.players + 3}`);
    }
    const held = engine.players
      .map((pl) => pl.data.tiles.booster)
      .filter((b): b is Booster => b !== null && b !== undefined);
    if (new Set(held).size !== held.length) {
      messages.push(`two players hold the same booster: [${held}]`);
    }
    for (const booster of held) {
      if (engine.tiles.boosters[booster] !== false) {
        messages.push(`booster ${booster} is held by a player but the pool does not mark it as taken`);
      }
    }
    const taken = this.boosterKeys.filter((b) => engine.tiles.boosters[b as Booster] === false);
    if (taken.length !== held.length) {
      messages.push(`${taken.length} boosters marked taken in the pool but ${held.length} held by players`);
    }
  }

  private checkTechTiles(engine: Engine, messages: string[]): void {
    // Research-board (and Scoring-Extension) tech tile positions.
    for (const [pos, initial] of this.techInitial) {
      const poolCount = engine.tiles.techs[pos as AnyTechTilePos]?.count ?? 0;
      if (poolCount < 0 || poolCount > initial) {
        messages.push(`tech pool at ${pos} has count ${poolCount}, outside [0, ${initial}]`);
      }
      const heldCount = engine.players.reduce(
        (acc, pl) => acc + pl.data.tiles.techs.filter((t) => (t.pos as string) === pos).length,
        0
      );
      if (poolCount + heldCount !== initial) {
        messages.push(`tech tiles at ${pos} leak: pool ${poolCount} + player-held ${heldCount} != seeded ${initial}`);
      }
    }
    // Ship-seeded Standard Tech tiles (§C4: 1 per ship on Rebellion/T F Mars/Eclipse).
    for (const [ship, initial] of this.shipTechInitial) {
      const poolCount = engine.tiles.spaceshipTechs[ship as Spaceship]?.count ?? 0;
      const heldCount = engine.players.reduce(
        (acc, pl) => acc + pl.data.tiles.techs.filter((t) => (t.pos as string) === ship).length,
        0
      );
      if (poolCount + heldCount !== initial) {
        messages.push(
          `ship-seeded Standard Tech on ${ship} leaks: on-ship ${poolCount} + player-held ${heldCount} != seeded ${initial}`
        );
      }
    }
  }

  private checkFederations(engine: Engine, messages: string[]): void {
    for (const [fed, count] of Object.entries(engine.tiles.federations)) {
      if (count < 0 || count > FEDERATION_POOL_COPIES) {
        messages.push(`federation pool for ${fed} has count ${count}, outside [0, ${FEDERATION_POOL_COPIES}]`);
      }
    }
    const poolNow = Object.values(engine.tiles.federations).reduce((a, b) => a + b, 0);
    // Gleens' PI-granted token (Federation.Gleens) never comes from the pool — excluded.
    const playerHeld = engine.players.reduce(
      (acc, pl) => acc + pl.data.tiles.federations.filter((f) => f.tile !== Federation.Gleens).length,
      0
    );
    const onTerraformingTrack = engine.terraformingFederation ? 1 : 0;
    if (poolNow + playerHeld + onTerraformingTrack !== this.federationTotal + 1) {
      // +1: setup draws the terraforming-track token OUT of the pool (setup.ts applyOption does
      // `federations[x] -= 1`) AFTER the 3-per-type seeding this oracle captured; capture happens
      // post-setup, so `federationTotal` already excludes it and the track token is additional.
      messages.push(
        `federation tokens leak: pool ${poolNow} + players ${playerHeld} + terraforming-track ${onTerraformingTrack} != ${
          this.federationTotal + 1
        }`
      );
    }
    // Ship-seeded Federation tokens (§C4): setup deals distinct types, one per ship; a claimed
    // token moves to exactly one player and never duplicates.
    const claimed = engine.players.flatMap((pl) => pl.data.spaceshipFederations.map((f) => f.tile));
    if (new Set(claimed).size !== claimed.length) {
      messages.push(`a ship Federation token was claimed twice: [${claimed}]`);
    }
    const onShips = Object.values(engine.tiles.spaceshipFederations).filter((t) => t !== undefined);
    for (const token of onShips) {
      if (claimed.includes(token)) {
        messages.push(`ship Federation token ${token} is both still seeded on a ship and claimed by a player`);
      }
    }
  }

  private checkArtifacts(engine: Engine, ctx: OracleContext, messages: string[]): void {
    const remaining = engine.tiles.artifacts;
    for (const token of remaining) {
      if (!this.artifactInitial.includes(token)) {
        messages.push(`artifact token ${token} appeared in the pool but was never seeded (§G6 seeding = player count)`);
      }
    }
    if (new Set(remaining).size !== remaining.length) {
      messages.push(`duplicate artifact token in the pool: [${remaining}]`);
    }
    const claimedMoves = ctx.moves.filter((m) => m.includes("chooseArtifactToken")).length;
    if (remaining.length + claimedMoves !== this.artifactInitial.length) {
      messages.push(
        `artifact tokens leak: ${remaining.length} remaining + ${claimedMoves} claimed != ${this.artifactInitial.length} seeded`
      );
    }
  }
}

export function conservationOracles(): Oracle[] {
  return [nonNegativeResources, vpReconciliation, new TilePoolConservation()];
}
