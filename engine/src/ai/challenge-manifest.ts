import { createHash } from "crypto";
import Engine from "../engine";
import {
  AdvTechTilePos,
  Booster,
  Federation,
  FinalTile,
  Phase,
  ResearchField,
  Spaceship,
  TechTilePos,
} from "../enums";
import Event from "../events";
import { classifySectorId, lostFleetSectorKey, LostFleetSectorType } from "../lost-fleet-map";
import { researchEvents } from "../research-tracks";
import Reward from "../reward";
import {
  EXPLORATION_CHARGE_TRACK,
  shipsInPlay,
  spaceshipBoards,
} from "../spaceships";
import { artifactTokenRewards, artifactTokenSpec } from "../tiles/artifacts";
import { boosterEvents } from "../tiles/boosters";
import { federationRewards } from "../tiles/federations";
import {
  finalScoringNeutralPlayer,
  finalScorings,
  roundScoringEvents,
} from "../tiles/scoring";
import { spaceshipFederationSpec } from "../tiles/spaceship-federations";
import { spaceshipTechSpec } from "../tiles/spaceship-techs";
import { techTileEvents } from "../tiles/techs";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "./challenge";

interface RewardManifest {
  count: number;
  type: string;
}

interface EventManifest {
  spec: string;
  condition: string;
  operator: string;
  rewards: RewardManifest[];
}

function rewardManifest(reward: Reward): RewardManifest {
  return { count: reward.count, type: reward.type };
}

function eventManifest(event: Event): EventManifest {
  return {
    spec: event.spec,
    condition: event.condition,
    operator: event.operator,
    rewards: event.rewards.map(rewardManifest),
  };
}

function finalTileManifest(engine: Engine, tile: FinalTile, selected: boolean) {
  const scoring = finalScorings[tile];
  return {
    id: tile,
    selected,
    condition: scoring.condition,
    neutralPlayer: finalScoringNeutralPlayer(tile, engine.expansions),
  };
}

function stableValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableValue(value[key]);
        return result;
      }, {});
  }
  return value;
}

export function stableManifestJson(manifest: any, spacing = 2): string {
  return JSON.stringify(stableValue(manifest), null, spacing);
}

export function challengeManifestSha256(manifest: any): string {
  return createHash("sha256").update(stableManifestJson(manifest, 0)).digest("hex");
}

export function bootChallengeEngine(): Engine {
  return new Engine([...LOST_FLEET_CHALLENGE.scriptedPrefix], challengeEngineOptions());
}

function buildChallengeManifest() {
  const engine = bootChallengeEngine();
  const selectedFinalTiles = engine.tiles.scorings.final;
  const standardTechPositions = TechTilePos.values(engine.expansions);
  const advancedTechPositions = AdvTechTilePos.values(engine.expansions);
  const ships = shipsInPlay(engine.expansions, engine.players.length);

  const mapHexes = [...engine.map.grid.values()]
    .map((hex) => ({
      id: hex.toString(),
      q: hex.q,
      r: hex.r,
      s: hex.s,
      planet: hex.data.planet,
      hasPlanet: hex.hasPlanet(),
      sectorId: hex.data.sector,
      sectorKey: lostFleetSectorKey(hex) ?? null,
      sectorType: classifySectorId(hex.data.sector),
      spaceship: hex.data.spaceship ?? null,
      adjacent: engine.map.grid
        .neighbours(hex)
        .map((neighbour) => neighbour.toString())
        .sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const spaceSectorIds = [...new Set(
    mapHexes
      .filter((hex) => hex.sectorType === LostFleetSectorType.Space)
      .map((hex) => hex.sectorKey)
      .filter((sector): sector is string => sector !== null)
  )].sort();
  const deepSpaceSectorIds = [...new Set(
    mapHexes
      .filter((hex) => hex.sectorType === LostFleetSectorType.DeepSpace)
      .map((hex) => hex.sectorKey)
      .filter((sector): sector is string => sector !== null)
  )].sort();

  const manifest = {
    schemaVersion: LOST_FLEET_CHALLENGE.schemas.manifest,
    challenge: {
      id: LOST_FLEET_CHALLENGE.id,
      version: LOST_FLEET_CHALLENGE.version,
      schemas: LOST_FLEET_CHALLENGE.schemas,
      seed: LOST_FLEET_CHALLENGE.seed,
      playerCount: LOST_FLEET_CHALLENGE.playerCount,
      options: LOST_FLEET_CHALLENGE.options,
      seats: LOST_FLEET_CHALLENGE.seats,
      fixedTurnOrder: LOST_FLEET_CHALLENGE.fixedTurnOrder,
      scriptedPrefix: LOST_FLEET_CHALLENGE.scriptedPrefix,
      scriptedPrefixScope: LOST_FLEET_CHALLENGE.scriptedPrefixScope,
      strategicSetupDecisions: LOST_FLEET_CHALLENGE.strategicSetupDecisions,
    },
    engine: {
      version: engine.version,
      stateSchemaVersion: LOST_FLEET_CHALLENGE.schemas.engine,
      phaseAfterScriptedPrefix: engine.phase,
      roundAfterScriptedPrefix: engine.round,
      playerToMoveAfterScriptedPrefix: engine.playerToMove,
      seatsAfterScriptedPrefix: engine.players.map((player) => ({
        player: player.player,
        faction: player.faction,
      })),
      setupBuildingTurnOrder: [...engine.turnOrder],
      newTurn: engine.newTurn,
    },
    setup: {
      roundScoring: engine.tiles.scorings.round.map((tile, index) => ({
        round: index + 1,
        id: tile,
        effects: roundScoringEvents(tile, index + 1).map(eventManifest),
      })),
      finalScoring: {
        selected: selectedFinalTiles.map((tile, index) => ({
          position: index + 1,
          ...finalTileManifest(engine, tile, true),
        })),
        objectives: {
          space: finalTileManifest(engine, FinalTile.Sector, selectedFinalTiles.includes(FinalTile.Sector)),
          deepSpace: finalTileManifest(
            engine,
            FinalTile.DeepSpaceSector,
            selectedFinalTiles.includes(FinalTile.DeepSpaceSector)
          ),
        },
      },
      boosters: Booster.values(engine.expansions)
        .filter((booster) => engine.tiles.boosters[booster] === true)
        .map((booster) => ({
          id: booster,
          effects: boosterEvents(booster).map(eventManifest),
        })),
      technology: {
        standard: standardTechPositions.map((position) => {
          const seeded = engine.tiles.techs[position];
          return {
            position,
            id: seeded.tile,
            copies: seeded.count,
            effects: techTileEvents({ position, pos: position, tile: seeded.tile } as any).map(eventManifest),
          };
        }),
        advanced: advancedTechPositions.map((position) => {
          const seeded = engine.tiles.techs[position];
          return {
            position,
            id: seeded.tile,
            copies: seeded.count,
            effects: techTileEvents({ position, pos: position, tile: seeded.tile } as any).map(eventManifest),
          };
        }),
      },
      federations: {
        supply: Federation.values(engine.expansions).map((federation) => ({
          id: federation,
          count: engine.tiles.federations[federation],
          rewards: federationRewards(federation).map(rewardManifest),
        })),
        terraformingFederation: engine.terraformingFederation,
      },
      lostFleet: {
        economySide: {
          id: engine.lostFleetEconomySide,
          level3Effects: researchEvents(
            ResearchField.Economy,
            3,
            engine.expansions,
            engine.lostFleetEconomySide
          ).map(eventManifest),
          level4Effects: researchEvents(
            ResearchField.Economy,
            4,
            engine.expansions,
            engine.lostFleetEconomySide
          ).map(eventManifest),
        },
        scoringExtensionSide: engine.scoringExtensionSide,
        terraformingRow: [...engine.lostFleetTerraformingRow],
      },
      spaceships: ships.map((ship) => {
        const coordinate = mapHexes.find((hex) => hex.spaceship === ship)?.id ?? null;
        const tech = engine.tiles.spaceshipTechs[ship];
        const federation = engine.tiles.spaceshipFederations[ship];
        return {
          id: ship,
          coordinate,
          technology: tech
            ? { id: tech.tile, copies: tech.count, effect: spaceshipTechSpec[tech.tile] }
            : null,
          federation: federation
            ? { id: federation, effect: spaceshipFederationSpec[federation] }
            : null,
          actions: spaceshipBoards[ship].actions.map((action) => ({ ...action })),
          shuttleSlots: EXPLORATION_CHARGE_TRACK.map((charge, index) => ({ slot: index + 1, charge })),
        };
      }),
      artifacts: engine.tiles.artifacts.map((artifact, index) => ({
        slot: index + 1,
        id: artifact,
        effect: artifactTokenSpec[artifact],
        rewardSpec: artifactTokenRewards[artifact] ?? null,
      })),
    },
    map: {
      placements: engine.map.placement.sectors.map((sector) => ({
        sector: sector.sector,
        rotation: sector.rotation,
        center: { q: sector.center.q, r: sector.center.r, s: sector.center.s },
      })),
      mirror: engine.map.placement.mirror ?? false,
      hexes: mapHexes,
      objectives: {
        space: {
          sectorType: LostFleetSectorType.Space,
          sectorIds: spaceSectorIds,
        },
        deepSpace: {
          sectorType: LostFleetSectorType.DeepSpace,
          sectorIds: deepSpaceSectorIds,
        },
      },
    },
  };

  assertValidChallengeManifest(manifest);
  return manifest;
}

export type ChallengeManifest = ReturnType<typeof buildChallengeManifest>;

export function generateChallengeManifest(): ChallengeManifest {
  return buildChallengeManifest();
}

export function validateChallengeManifest(manifest: any): string[] {
  const errors: string[] = [];
  const expectedSeats = LOST_FLEET_CHALLENGE.seats;

  if (manifest.schemaVersion !== LOST_FLEET_CHALLENGE.schemas.manifest) {
    errors.push(`manifest schema must be ${LOST_FLEET_CHALLENGE.schemas.manifest}`);
  }
  if (manifest.engine.phaseAfterScriptedPrefix !== Phase.SetupBuilding) {
    errors.push(`scripted prefix must stop at ${Phase.SetupBuilding}`);
  }
  if (manifest.engine.newTurn !== true) {
    errors.push("scripted prefix must end at a committed turn boundary");
  }
  if (
    manifest.engine.seatsAfterScriptedPrefix.length !== expectedSeats.length ||
    manifest.engine.seatsAfterScriptedPrefix.some(
      (seat, index) => seat.player !== expectedSeats[index].player || seat.faction !== expectedSeats[index].faction
    )
  ) {
    errors.push("real engine seats after the scripted prefix must match the fixed challenge assignment");
  }
  if (manifest.challenge.seats.length !== expectedSeats.length) {
    errors.push("challenge must contain exactly two seats");
  } else {
    expectedSeats.forEach((seat, index) => {
      if (manifest.challenge.seats[index].faction !== seat.faction) {
        errors.push(`seat ${index} must use faction ${seat.faction}`);
      }
    });
  }
  if (manifest.challenge.strategicSetupDecisions.join(",") !== "starting-buildings,round-boosters") {
    errors.push("starting buildings and round boosters must remain strategic decisions");
  }
  if (manifest.setup.roundScoring.length !== 6) {
    errors.push("manifest must contain six round scoring tiles");
  }
  if (manifest.setup.finalScoring.selected.length !== 2) {
    errors.push("manifest must contain two selected final scoring tiles");
  }
  if (manifest.setup.finalScoring.objectives.space === undefined || manifest.setup.finalScoring.objectives.deepSpace === undefined) {
    errors.push("Space and Deep Space final objectives must be separate fields");
  }
  if (manifest.setup.boosters.length !== LOST_FLEET_CHALLENGE.playerCount + 3) {
    errors.push("booster pool must contain player count plus three boosters");
  }
  if (manifest.setup.artifacts.length !== LOST_FLEET_CHALLENGE.playerCount) {
    errors.push("Twilight must contain one artifact slot per player");
  }

  const ids = manifest.map.hexes.map((hex) => hex.id);
  if (new Set(ids).size !== ids.length) {
    errors.push("canonical map hex IDs must be unique");
  }
  const byId = new Map<string, any>(manifest.map.hexes.map((hex) => [hex.id, hex]));
  for (const hex of manifest.map.hexes) {
    for (const adjacent of hex.adjacent) {
      const neighbour: any = byId.get(adjacent);
      if (!neighbour) {
        errors.push(`${hex.id} references missing adjacent hex ${adjacent}`);
      } else if (!neighbour.adjacent.includes(hex.id)) {
        errors.push(`map adjacency is not symmetric for ${hex.id} and ${adjacent}`);
      }
    }
  }
  if (manifest.map.objectives.space === undefined || manifest.map.objectives.deepSpace === undefined) {
    errors.push("Space and Deep Space map objectives must be separate fields");
  }
  for (const ship of manifest.setup.spaceships) {
    if (!ship.coordinate || byId.get(ship.coordinate)?.spaceship !== ship.id) {
      errors.push(`spaceship ${ship.id} must have its exact map coordinate`);
    }
    if (ship.actions.length !== 3 || ship.shuttleSlots.length !== 4) {
      errors.push(`spaceship ${ship.id} must contain three actions and four shuttle slots`);
    }
  }

  return errors;
}

export function assertValidChallengeManifest(manifest: any): void {
  const errors = validateChallengeManifest(manifest);
  if (errors.length > 0) {
    throw new Error(`Invalid challenge manifest:\n- ${errors.join("\n- ")}`);
  }
}
