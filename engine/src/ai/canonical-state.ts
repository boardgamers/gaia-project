import { createHash } from "crypto";
import Engine, { EngineOptions } from "../engine";
import {
  AdvTechTilePos,
  BoardAction,
  Booster,
  Building,
  Expansion,
  Federation,
  Operator,
  Phase,
  Planet,
  Player as PlayerEnum,
  ResearchField,
  Spaceship,
  TechTilePos,
} from "../enums";
import { shipsInPlay, SpaceshipActionType } from "../spaceships";

export const CANONICAL_STATE_SCHEMA_VERSION = "gaia-ai-canonical-state/v1";

const SUPPORTED_SPACESHIP_ACTION_TYPES: readonly SpaceshipActionType[] = ["credit", "knowledge", "power", "qic"];
const EVENT_OPERATORS: readonly Operator[] = [
  Operator.Once,
  Operator.Income,
  Operator.Trigger,
  Operator.Activate,
  Operator.Pass,
  Operator.FourPowerBuildings,
];
const ALL_RESEARCH_FIELDS: readonly ResearchField[] = [
  ResearchField.Terraforming,
  ResearchField.Navigation,
  ResearchField.Intelligence,
  ResearchField.GaiaProject,
  ResearchField.Economy,
  ResearchField.Science,
  ResearchField.Diplomacy,
];

type CanonicalPoint = {
  q: number;
  r: number;
  s: number;
};

type CanonicalOptions = {
  advancedRules: boolean;
  customBoardSetup: boolean;
  noFedCheck: boolean;
  flexibleFederations: boolean;
  frontiers: boolean;
  lostFleet: boolean;
  factionVariant: string;
  factionVariantVersion: number;
};

type CanonicalMapPlacementSector = {
  sector: string;
  rotation: number;
  center: CanonicalPoint | null;
};

type CanonicalMapHex = {
  id: string;
  q: number;
  r: number;
  s: number;
  planet: Planet;
  sector: string;
  building: Building | null;
  player: PlayerEnum | null;
  federations: PlayerEnum[];
  tradeTokens: PlayerEnum[];
  customPosts: PlayerEnum[];
  additionalMine: PlayerEnum | null;
  powerRing: PlayerEnum | null;
  spaceship: Spaceship | null;
  sectorCenter: CanonicalPoint | null;
};

type CanonicalEvent = {
  spec: string;
  source: string | null;
};

type CanonicalPlayer = {
  player: PlayerEnum;
  faction: string | null;
  dropped: boolean;
  variant: { board: unknown; version: number } | null;
  expansions: number;
  nbPlayers: number | null;
  lostFleetEconomySide: string | null;
  data: {
    victoryPoints: number;
    bid: number;
    credits: number;
    ores: number;
    qics: number;
    knowledge: number;
    power: {
      area1: number;
      area2: number;
      area3: number;
      gaia: number;
    };
    brainstone: string | null;
    buildings: Array<{ building: string; count: number }>;
    destroyedShips: Array<{ building: string; count: number }>;
    deployedShips: Array<{ building: string; count: number }>;
    satellites: number;
    research: Array<{ field: string; level: number }>;
    range: number;
    shipRange: number;
    gaiaformers: number;
    gaiaformersInGaia: number;
    gaiaformersUsedForAsteroid: number;
    gaiaformersUsedForOther: number;
    terraformCostDiscount: number;
    tradeBonus: number;
    tradeDiscount: number;
    tradeShips: number;
    leechPossible: number;
    tokenModifier: number;
    lostPlanet: number;
    federationCount: number;
    powerRingsPlaced: number;
    currentTinkeringTile: string | null;
    usedTinkeringTiles: string[];
    lostFleetCost3Planets: string[];
    artifactPlanetTypes: string[];
    artifacts: string[];
    ships: Array<{ type: string; player: PlayerEnum; location: string; moved: boolean }>;
    explorationShips: Array<{ ship: string; slot: number }>;
    tiles: {
      booster: string | null;
      techs: Array<{ tile: string; pos: string; enabled: boolean }>;
      federations: Array<{ tile: string; green: boolean }>;
    };
    spaceshipFederations: Array<{ tile: string; green: boolean }>;
  };
  events: Array<{ operator: string; events: CanonicalEvent[] }>;
  federationCache: {
    availableSatellites: number;
    custom: boolean;
    federations: Array<{
      hexes: string[];
      satellites: number;
      newSatellites: number;
      planets: number;
      powerValue: number;
    }>;
  } | null;
};

export type CanonicalState = {
  schemaVersion: typeof CANONICAL_STATE_SCHEMA_VERSION;
  playerCount: number;
  options: CanonicalOptions;
  phase: Phase;
  round: number;
  actors: {
    currentPlayer: PlayerEnum | null;
    tempCurrentPlayer: PlayerEnum | null;
    turnOrder: PlayerEnum[];
    passedPlayers: PlayerEnum[];
    tempTurnOrder: PlayerEnum[];
    leechSources: Array<{ player: PlayerEnum; coordinates: string }>;
    lastLeechSource: { player: PlayerEnum; coordinates: string } | null;
  };
  setup: {
    factionSelectionOrder: string[];
    terraformingFederation: string | null;
    scoringExtensionSide: string | null;
    lostFleetTerraformingRow: string[];
    lostFleetEconomySide: string | null;
    boardActions: Array<{ action: string; owner: PlayerEnum | null }>;
    spaceshipActions: Array<{
      ship: string;
      actions: Array<{ type: SpaceshipActionType; owner: PlayerEnum | null }>;
    }>;
  };
  tiles: {
    boosters: string[];
    techs: Array<{ position: string; tile: string | null; count: number | null }>;
    roundScoring: string[];
    finalScoring: string[];
    federations: Array<{ tile: string; count: number | null }>;
    spaceshipTechs: Array<{ ship: string; tile: string | null; count: number | null }>;
    spaceshipFederations: Array<{ ship: string; tile: string | null }>;
    artifacts: string[];
  };
  map: {
    nbPlayers: number | null;
    layout: string | null;
    lostFleet: boolean;
    placement: {
      mirror: boolean;
      sectors: CanonicalMapPlacementSector[];
    } | null;
    hexes: CanonicalMapHex[];
  };
  players: CanonicalPlayer[];
};

export class CanonicalStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalStateError";
  }
}

export function projectCanonicalState(engine: Engine): CanonicalState {
  assertCanonicalStateSupported(engine);

  return {
    schemaVersion: CANONICAL_STATE_SCHEMA_VERSION,
    playerCount: engine.players.length,
    options: projectOptions(engine.options),
    phase: engine.phase,
    round: engine.round,
    actors: {
      currentPlayer: normalizeNullableNumber(engine.currentPlayer),
      tempCurrentPlayer: normalizeNullableNumber(engine.tempCurrentPlayer),
      turnOrder: [...engine.turnOrder],
      passedPlayers: [...(engine.passedPlayers ?? [])],
      tempTurnOrder: [...engine.tempTurnOrder],
      leechSources: engine.leechSources.map((source) => ({
        player: source.player,
        coordinates: source.coordinates,
      })),
      lastLeechSource: engine.lastLeechSource
        ? {
            player: engine.lastLeechSource.player,
            coordinates: engine.lastLeechSource.coordinates,
          }
        : null,
    },
    setup: {
      factionSelectionOrder: [...engine.setup],
      terraformingFederation: engine.terraformingFederation ?? null,
      scoringExtensionSide: engine.scoringExtensionSide ?? null,
      lostFleetTerraformingRow: [...(engine.lostFleetTerraformingRow ?? [])],
      lostFleetEconomySide: engine.lostFleetEconomySide ?? null,
      boardActions: BoardAction.values(engine.expansions).map((action) => ({
        action,
        owner: normalizeNullableNumber(engine.boardActions[action]),
      })),
      spaceshipActions: shipsInPlay(engine.expansions, engine.players.length).map((ship) => ({
        ship,
        actions: SUPPORTED_SPACESHIP_ACTION_TYPES.map((type) => ({
          type,
          owner: normalizeNullableNumber(engine.spaceshipActions[ship]?.[type]),
        })),
      })),
    },
    tiles: {
      boosters: Booster.values(engine.expansions).filter((booster) => !!engine.tiles.boosters[booster]),
      techs: [...TechTilePos.values(engine.expansions), ...AdvTechTilePos.values(engine.expansions)].map(
        (position) => ({
          position,
          tile: engine.tiles.techs[position]?.tile ?? null,
          count: engine.tiles.techs[position]?.count ?? null,
        })
      ),
      roundScoring: [...engine.tiles.scorings.round],
      finalScoring: [...engine.tiles.scorings.final],
      federations: Federation.values(engine.expansions).map((tile) => ({
        tile,
        count: engine.tiles.federations[tile] ?? null,
      })),
      spaceshipTechs: shipsInPlay(engine.expansions, engine.players.length).map((ship) => ({
        ship,
        tile: engine.tiles.spaceshipTechs[ship]?.tile ?? null,
        count: engine.tiles.spaceshipTechs[ship]?.count ?? null,
      })),
      spaceshipFederations: shipsInPlay(engine.expansions, engine.players.length).map((ship) => ({
        ship,
        tile: engine.tiles.spaceshipFederations[ship] ?? null,
      })),
      artifacts: [...engine.tiles.artifacts].sort(),
    },
    map: {
      nbPlayers: engine.map.nbPlayers ?? null,
      layout: engine.map.layout ?? engine.options.layout ?? "standard",
      lostFleet: !!engine.map.lostFleet,
      placement: engine.map.placement
        ? {
            mirror: !!engine.map.placement.mirror,
            sectors: engine.map.placement.sectors.map((sector) => ({
              sector: sector.sector,
              rotation: sector.rotation,
              center: sector.center ? projectPoint(sector.center) : null,
            })),
          }
        : null,
      hexes: Array.from(engine.map.grid.values())
        .sort(compareHexes)
        .map((hex) => ({
          id: hex.toString(),
          q: hex.q,
          r: hex.r,
          s: hex.s,
          planet: hex.data.planet,
          sector: hex.data.sector,
          building: hex.data.building ?? null,
          player: normalizeNullableNumber(hex.data.player),
          federations: sortNumbers(hex.data.federations ?? []),
          tradeTokens: sortNumbers(hex.data.tradeTokens ?? []),
          customPosts: sortNumbers(hex.data.customPosts ?? []),
          additionalMine: normalizeNullableNumber(hex.data.additionalMine),
          powerRing: normalizeNullableNumber(hex.data.powerRing),
          spaceship: hex.data.spaceship ?? null,
          sectorCenter: hex.data.sectorCenter ? projectPoint(hex.data.sectorCenter) : null,
        })),
    },
    players: engine.players.map((player) => ({
      player: player.player,
      faction: player.faction ?? null,
      dropped: !!player.dropped,
      variant: player.variant
        ? {
            board: player.variant.board ? JSON.parse(JSON.stringify(player.variant.board)) : null,
            version: player.variant.version ?? 0,
          }
        : null,
      expansions: player.expansions,
      nbPlayers: player.nbPlayers ?? null,
      lostFleetEconomySide: player.lostFleetEconomySide ?? null,
      data: {
        victoryPoints: player.data.victoryPoints,
        bid: player.data.bid,
        credits: player.data.credits,
        ores: player.data.ores,
        qics: player.data.qics,
        knowledge: player.data.knowledge,
        power: {
          area1: player.data.power.area1,
          area2: player.data.power.area2,
          area3: player.data.power.area3,
          gaia: player.data.power.gaia,
        },
        brainstone: player.data.brainstone ?? null,
        buildings: projectBuildingCounts(player.data.buildings),
        destroyedShips: projectShipBuildingCounts(player.data.destroyedShips),
        deployedShips: projectShipBuildingCounts(player.data.deployedShips),
        satellites: player.data.satellites,
        research: ALL_RESEARCH_FIELDS.map((field) => ({
          field,
          level: player.data.research[field] ?? 0,
        })),
        range: player.data.range,
        shipRange: player.data.shipRange,
        gaiaformers: player.data.gaiaformers,
        gaiaformersInGaia: player.data.gaiaformersInGaia,
        gaiaformersUsedForAsteroid: player.data.gaiaformersUsedForAsteroid,
        gaiaformersUsedForOther: player.data.gaiaformersUsedForOther,
        terraformCostDiscount: player.data.terraformCostDiscount,
        tradeBonus: player.data.tradeBonus,
        tradeDiscount: player.data.tradeDiscount,
        tradeShips: player.data.tradeShips,
        leechPossible: player.data.leechPossible ?? 0,
        tokenModifier: player.data.tokenModifier,
        lostPlanet: player.data.lostPlanet,
        federationCount: player.data.federationCount,
        powerRingsPlaced: player.data.powerRingsPlaced,
        currentTinkeringTile: player.data.currentTinkeringTile ?? null,
        usedTinkeringTiles: [...player.data.usedTinkeringTiles].sort(),
        lostFleetCost3Planets: [...player.data.lostFleetCost3Planets].sort(),
        artifactPlanetTypes: [...player.data.artifactPlanetTypes].sort(),
        artifacts: [...player.data.artifacts].sort(),
        ships: [...player.data.ships]
          .map((ship) => ({
            type: ship.type,
            player: ship.player,
            location: ship.location,
            moved: ship.moved,
          }))
          .sort(compareShips),
        explorationShips: Object.keys(player.data.explorationShips)
          .sort()
          .map((ship) => ({
            ship,
            slot: player.data.explorationShips[ship as Spaceship],
          })),
        tiles: {
          booster: player.data.tiles.booster ?? null,
          techs: player.data.tiles.techs.map((tech) => ({
            tile: tech.tile,
            pos: tech.pos,
            enabled: tech.enabled,
          })),
          federations: player.data.tiles.federations.map((federation) => ({
            tile: federation.tile,
            green: federation.green,
          })),
        },
        spaceshipFederations: player.data.spaceshipFederations.map((federation) => ({
          tile: federation.tile,
          green: federation.green,
        })),
      },
      events: EVENT_OPERATORS.map((operator) => ({
        operator,
        events: player.events[operator].map((event) => ({
          spec: event.toString(),
          source: event.source ?? null,
        })),
      })),
      federationCache: player.federationCache
        ? {
            availableSatellites: player.federationCache.availableSatellites,
            // Player.toJSON() drops the boolean `custom` flag, so a hydrated cache carries
            // `undefined` here while the engine consumes it as falsy (available/federations.ts,
            // `possibleFeds.length > 0 || p.federationCache.custom`). Projecting the same truthy
            // coercion keeps the hash byte-identical for every live boolean value and makes
            // hydrated mid-game caches hashable instead of a projection crash. A live `custom:
            // true` cache still hashes differently from its hydrated `false` counterpart on
            // purpose: that pair genuinely behaves differently in the current engine (the
            // base-003 federation-cache staleness class).
            custom: !!player.federationCache.custom,
            federations: player.federationCache.federations.map((federation) => ({
              hexes: federation.hexes.map((hex) => hex.toString()),
              satellites: federation.satellites,
              newSatellites: federation.newSatellites,
              planets: federation.planets,
              powerValue: federation.powerValue,
            })),
          }
        : null,
    })),
  };
}

export function canonicalStateJson(engine: Engine): string {
  return canonicalJson(projectCanonicalState(engine));
}

export function canonicalStateBytes(engine: Engine): Buffer {
  return Buffer.from(canonicalStateJson(engine), "utf8");
}

export function canonicalStateHash(engine: Engine): string {
  const json = canonicalStateJson(engine);
  return createHash("sha256")
    .update(CANONICAL_STATE_SCHEMA_VERSION, "utf8")
    .update("\0", "utf8")
    .update(json, "utf8")
    .digest("hex");
}

export function canonicalJson(value: CanonicalState): string {
  return stableJson(value);
}

function assertCanonicalStateSupported(engine: Engine) {
  if (engine.replay) {
    throw new CanonicalStateError("canonical state requires a live committed engine, not replay mode");
  }
  if (engine.phase === Phase.SetupInit || !engine.map || engine.players.length === 0) {
    throw new CanonicalStateError("canonical state requires an initialized committed game state");
  }
  if (!engine.newTurn) {
    throw new CanonicalStateError("canonical state requires engine.newTurn === true");
  }
  if (engine.turnMoves.length > 0 || engine.pendingMove !== "") {
    throw new CanonicalStateError("canonical state rejects incomplete turn scaffolding");
  }
  if (engine.options.auction) {
    throw new CanonicalStateError(`unsupported faction-picking option: auction=${engine.options.auction}`);
  }
  if (engine.options.randomFactions) {
    throw new CanonicalStateError("unsupported faction-picking option: randomFactions");
  }
  if (engine.options.banPhase) {
    throw new CanonicalStateError("unsupported faction-picking option: banPhase");
  }
  if (
    [Phase.SetupFactionBan, Phase.SetupAuction, Phase.SetupSilentBid, Phase.SetupPreferenceBid].includes(engine.phase)
  ) {
    throw new CanonicalStateError(`unsupported faction-picking phase: ${engine.phase}`);
  }
  if ((engine.randomFactions?.length ?? 0) > 0) {
    throw new CanonicalStateError("unsupported faction-picking state: engine.randomFactions is populated");
  }
  if ((engine.bannedFactions?.length ?? 0) > 0) {
    throw new CanonicalStateError("unsupported faction-picking state: bannedFactions is populated");
  }
  if ((engine.silentAuctionBids?.length ?? 0) > 0 || (engine.silentAuctionLog?.length ?? 0) > 0) {
    throw new CanonicalStateError("unsupported faction-picking state: silent auction state is populated");
  }
  if (!engine.map.placement) {
    throw new CanonicalStateError("canonical state requires map.placement to be present");
  }
  if (
    engine.options.lostFleet &&
    (!engine.lostFleetTerraformingRow || !engine.scoringExtensionSide || !engine.lostFleetEconomySide)
  ) {
    throw new CanonicalStateError("canonical Lost Fleet state requires persisted setup randomization fields");
  }

  for (const player of engine.players) {
    if (player.data.temporaryRange !== 0 || player.data.temporaryStep !== 0) {
      throw new CanonicalStateError("canonical state rejects unresolved temporary move modifiers");
    }
    if ((player.data as any).turns !== 0) {
      throw new CanonicalStateError("canonical state rejects unresolved multi-turn move state");
    }
    if ((player.data as any).brainstoneDest !== undefined) {
      throw new CanonicalStateError("canonical state rejects unresolved brainstone choice state");
    }
    if ((player.data as any).toPick !== undefined) {
      throw new CanonicalStateError("canonical state rejects unresolved reward-pick state");
    }
  }
}

function projectOptions(options: EngineOptions): CanonicalOptions {
  return {
    advancedRules: !!options.advancedRules,
    customBoardSetup: !!options.customBoardSetup,
    noFedCheck: !!options.noFedCheck,
    flexibleFederations: !!options.flexibleFederations,
    frontiers: !!options.frontiers,
    lostFleet: !!options.lostFleet,
    factionVariant: options.factionVariant ?? "standard",
    factionVariantVersion: options.factionVariantVersion ?? 0,
  };
}

function projectBuildingCounts(counts: Record<string, number>): Array<{ building: string; count: number }> {
  return Building.values(Expansion.All)
    .slice()
    .sort()
    .map((building) => ({
      building,
      count: counts?.[building] ?? 0,
    }));
}

function projectShipBuildingCounts(counts: Record<string, number>): Array<{ building: string; count: number }> {
  return Building.ships()
    .slice()
    .sort()
    .map((building) => ({
      building,
      count: counts?.[building] ?? 0,
    }));
}

function projectPoint(point: { q: number; r: number; s: number }): CanonicalPoint {
  return { q: point.q, r: point.r, s: point.s };
}

function normalizeNullableNumber(value: number | undefined | null): number | null {
  return value === undefined || value === null ? null : value;
}

function sortNumbers(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function compareHexes(left: { q: number; r: number; s: number }, right: { q: number; r: number; s: number }): number {
  return left.q - right.q || left.r - right.r || left.s - right.s;
}

function compareShips(
  left: { type: string; location: string; moved: boolean; player: number },
  right: { type: string; location: string; moved: boolean; player: number }
): number {
  return (
    left.type.localeCompare(right.type) ||
    left.location.localeCompare(right.location) ||
    Number(left.moved) - Number(right.moved) ||
    left.player - right.player
  );
}

function stableJson(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalStateError(`non-finite number in canonical state: ${value}`);
    }
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();

    for (const key of keys) {
      if (record[key] === undefined) {
        throw new CanonicalStateError(`undefined canonical field: ${key}`);
      }
    }

    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }

  throw new CanonicalStateError(`unsupported canonical value type: ${typeof value}`);
}
