import { AvailableBuilding, AvailableCommand } from "../../available/types";
import { qicForDistance } from "../../cost";
import Engine from "../../engine";
import {
  ArtifactToken,
  Building,
  Command,
  Expansion,
  Faction,
  Federation,
  Phase,
  Planet,
  Player,
  Resource,
  Spaceship,
  SpaceshipFederation,
  SubPhase,
  TinkeringTile,
} from "../../enums";
import { qicForExplorationDistance } from "../../exploration";
import { tinkeringTileSpec } from "../../factions";
import { effectiveRange } from "../../player-data";
import Reward from "../../reward";
import { claimableSpaceshipFederations, spaceshipActionEffects, SpaceshipActionType } from "../../spaceships";
import { artifactTokenRewards } from "../../tiles/artifacts";
import { federationRewards } from "../../tiles/federations";
import { spaceshipFederationRewards } from "../../tiles/spaceship-federations";
import { projectCanonicalState } from "../canonical-state";
import { canonicalCandidateKey, stableCandidateJson } from "./canonical-key";
import {
  ATOMIC_CANDIDATE_SCHEMA,
  AtomicCandidateBase,
  AtomicDecisionCandidate,
  AtomicDecisionExpansion,
  CandidateDeduplication,
  CandidateRangeMetadata,
  CandidateResourceFlow,
  CandidateSatelliteMetadata,
  ResourceAmount,
} from "./types";

export type AtomicExpansionErrorCode =
  | "unsupported-state"
  | "unsupported-command"
  | "empty-command-data"
  | "invalid-command-data"
  | "semantic-key-collision";

export class AtomicExpansionError extends Error {
  constructor(
    readonly code: AtomicExpansionErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AtomicExpansionError";
  }
}

export interface AtomicExpansionOptions {
  /**
   * Phase-level decisions use null; RoundMove defaults to the engine's BeforeMove subphase.
   * A future committed-line builder may pass the exact chained SubPhase while reusing this atomic
   * projector, but Phase 1.2 never constructs that chain itself.
   */
  subphase?: SubPhase | null;
  /**
   * Already-selected atomic parts of the same, still-uncommitted line. The caller supplies the
   * prefix; this layer only replays it to expose the next atomic command and never plans or chooses
   * a continuation. The source `engine` itself must still be a supported committed state.
   */
  priorMoveFragments?: string[];
}

function sortedUnique(values: readonly string[] | null | undefined): string[] {
  return Array.from(new Set(values ?? [])).sort();
}

function rewardSpecs(rewards: Reward[]): string[] {
  return rewards.map((reward) => reward.toStringWithOne());
}

function resourceAmounts(amounts: Map<Resource, number>): ResourceAmount[] {
  return Array.from(amounts.entries())
    .filter(([, amount]) => amount !== 0)
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([resource, amount]) => ({ resource, amount }));
}

function resourceFlow(
  costSpecs: string[] = [],
  rewardSpecsInput: string[] = [],
  effects: string[] = []
): CandidateResourceFlow {
  const costs = new Map<Resource, number>();
  const rewards = new Map<Resource, number>();
  const deferred = [...effects];

  const add = (destination: Map<Resource, number>, resource: Resource, amount: number) => {
    destination.set(resource, (destination.get(resource) ?? 0) + amount);
  };

  const project = (spec: string, asCost: boolean) => {
    if (!spec || spec === Resource.None) {
      return;
    }
    const parsed = Reward.parse(spec);
    if (parsed.some((reward) => reward.type === Resource.None)) {
      deferred.push(spec);
      return;
    }
    for (const reward of parsed) {
      if (reward.count === 0) {
        continue;
      }
      const isCost = asCost ? reward.count > 0 : reward.count < 0;
      add(isCost ? costs : rewards, reward.type, Math.abs(reward.count));
    }
  };

  costSpecs.forEach((spec) => project(spec, true));
  rewardSpecsInput.forEach((spec) => project(spec, false));

  return {
    cost: resourceAmounts(costs),
    reward: resourceAmounts(rewards),
    effects: sortedUnique(deferred),
  };
}

function scaleRewardSpec(spec: string, multiplier: number): string {
  return Reward.parse(spec)
    .filter((reward) => reward.type !== Resource.None && reward.count !== 0)
    .map((reward) => new Reward(reward.count * multiplier, reward.type).toStringWithOne())
    .join(",");
}

function makeCandidate<C extends Command, T>(
  command: C,
  actor: Player,
  phase: Phase,
  subphase: SubPhase | null,
  target: T,
  resources: CandidateResourceFlow,
  warnings: readonly string[] | null | undefined,
  moveFragment: string
): AtomicCandidateBase<C, T> {
  return {
    schemaVersion: ATOMIC_CANDIDATE_SCHEMA,
    key: "",
    command,
    actor,
    phase,
    subphase,
    target,
    resources,
    warnings: sortedUnique(warnings),
    moveFragment,
  };
}

function rangeMetadata(
  engine: Engine,
  actor: Player,
  coordinates: string,
  kind: "build" | "explore",
  adjustments: readonly string[] = [],
  disabled = false
): CandidateRangeMetadata {
  const player = engine.player(actor);
  if (disabled || !player || player.data.occupied.length === 0) {
    return {
      distance: null,
      baseRange: player ? effectiveRange(player.data) : null,
      temporaryRange: player?.data.temporaryRange ?? 0,
      qic: 0,
      adjustments: sortedUnique(adjustments),
    };
  }

  const hex = engine.map.getS(coordinates);
  const needed =
    kind === "explore"
      ? qicForExplorationDistance(engine.map, hex, player, engine.replay)
      : qicForDistance(engine.map, hex, player, engine.replay);

  return {
    distance: needed?.distance ?? null,
    baseRange: effectiveRange(player.data),
    temporaryRange: player.data.temporaryRange,
    qic: needed?.amount ?? 0,
    adjustments: sortedUnique(adjustments),
  };
}

function buildCandidate(
  engine: Engine,
  actor: Player,
  phase: Phase,
  subphase: SubPhase | null,
  building: AvailableBuilding
) {
  const hex = engine.map.getS(building.coordinates);
  return makeCandidate(
    Command.Build,
    actor,
    phase,
    subphase,
    {
      building: building.building,
      coordinates: building.coordinates,
      planet: hex.data.planet ?? null,
      upgrade: building.upgrade ?? false,
      downgrade: building.downgrade ?? false,
      range: rangeMetadata(engine, actor, building.coordinates, "build", [], phase === Phase.SetupBuilding),
      terraform: {
        steps: building.steps ?? 0,
        temporarySteps: engine.player(actor).data.temporaryStep,
        consumesAsteroidGaiaformer: building.consumesAsteroidGaiaformer ?? true,
      },
    },
    resourceFlow([building.cost ?? Resource.None]),
    building.warnings,
    `${Command.Build} ${building.building} ${building.coordinates}`
  );
}

function federationRewardSpecs(federation: Federation | SpaceshipFederation): { rewards: string[]; effects: string[] } {
  if (Federation.values(Expansion.All).includes(federation as Federation)) {
    return { rewards: rewardSpecs(federationRewards(federation as Federation)), effects: [] };
  }

  const spaceshipFederation = federation as SpaceshipFederation;
  const spec = spaceshipFederationRewards[spaceshipFederation];
  const rewards = spec ? [spec] : [];
  if (spaceshipFederation === SpaceshipFederation.PowerTokens) {
    rewards.push(`2${Resource.GainTokenArea3}`);
  }
  const effects =
    spaceshipFederation === SpaceshipFederation.Range
      ? ["spaceship-federation-range-build-mine"]
      : spaceshipFederation === SpaceshipFederation.Terraform
        ? ["spaceship-federation-terraform-build-mine"]
        : [];
  return { rewards, effects };
}

function satelliteMetadata(engine: Engine, actor: Player, location: string): CandidateSatelliteMetadata {
  const player = engine.player(actor);
  const hexes = player.hexesForFederationLocation(location, engine.map);
  const allHexes = hexes.map((hex) => hex.toString()).sort();
  const satelliteHexes = hexes
    .filter((hex) => !hex.occupyingPlayers()?.includes(actor))
    .map((hex) => hex.toString())
    .sort();
  const newSatelliteHexes = hexes
    .filter((hex) => hex.buildingOf(actor) === undefined && !hex.belongsToFederationOf(actor))
    .map((hex) => hex.toString())
    .sort();
  const existingFederationHexes = hexes
    .filter((hex) => hex.belongsToFederationOf(actor))
    .map((hex) => hex.toString())
    .sort();
  return { allHexes, satelliteHexes, newSatelliteHexes, existingFederationHexes };
}

function artifactResources(token: ArtifactToken): CandidateResourceFlow {
  const declarative = artifactTokenRewards[token];
  if (declarative) {
    return resourceFlow([], [declarative]);
  }
  if (token === ArtifactToken.Asteroid || token === ArtifactToken.Protoplanet) {
    return resourceFlow([], [`7${Resource.VictoryPoint}`]);
  }
  return resourceFlow([], [], [`artifact-dynamic:${token}`]);
}

function spaceshipActionResourceSpecs(
  ship: Spaceship,
  action: SpaceshipActionType
): { rewards: string[]; effects: string[] } {
  const effects = spaceshipActionEffects[ship]?.[action];
  if (effects && effects.length > 0) {
    return { rewards: effects, effects: [] };
  }
  return { rewards: [], effects: [`spaceship-action-follow-up:${ship}:${action}`] };
}

function assertActor(engine: Engine, command: AvailableCommand): Player {
  const actor = command.player as Player;
  if (actor === undefined || !engine.player(actor)) {
    throw new AtomicExpansionError(
      "invalid-command-data",
      `Command ${command.name} has no initialized actor in the source state`
    );
  }
  return actor;
}

function expandCommand(
  engine: Engine,
  command: AvailableCommand,
  phase: Phase,
  subphase: SubPhase | null
): AtomicDecisionCandidate[] {
  const actor = assertActor(engine, command);

  switch (command.name) {
    case Command.Action:
      return command.data.poweracts.map((action) =>
        makeCandidate(
          Command.Action,
          actor,
          phase,
          subphase,
          { boardAction: action.name },
          resourceFlow([action.cost], action.income),
          [],
          `${Command.Action} ${action.name}`
        )
      );

    case Command.BrainStone:
      return command.data.choices.map((choice) =>
        makeCandidate(
          Command.BrainStone,
          actor,
          phase,
          subphase,
          { destination: choice.area },
          resourceFlow(),
          choice.warning ? [choice.warning] : [],
          `${Command.BrainStone} ${choice.area}`
        )
      );

    case Command.Build:
      return command.data.buildings.map((building) => buildCandidate(engine, actor, phase, subphase, building));

    case Command.BurnPower:
      return command.data.map((amount) =>
        makeCandidate(
          Command.BurnPower,
          actor,
          phase,
          subphase,
          { amount },
          resourceFlow([`${amount}${Resource.BurnToken}`]),
          [],
          `${Command.BurnPower} ${amount}`
        )
      );

    case Command.ChargePower:
      return command.data.offers.map((offer) =>
        makeCandidate(
          Command.ChargePower,
          actor,
          phase,
          subphase,
          { offer: offer.offer },
          resourceFlow([offer.cost], [offer.offer]),
          [],
          `${Command.ChargePower} ${offer.offer}`
        )
      );

    case Command.ChooseArtifactToken:
      return command.data.tokens.map((artifact) =>
        makeCandidate(
          Command.ChooseArtifactToken,
          actor,
          phase,
          subphase,
          { artifact, noEffect: command.data.noEffectTokens?.includes(artifact) ?? false },
          artifactResources(artifact),
          command.data.noEffectTokens?.includes(artifact) ? ["artifact-has-no-effect"] : [],
          `${Command.ChooseArtifactToken} ${artifact}`
        )
      );

    case Command.ChooseCoverTechTile:
      return command.data.tiles.map((tile) =>
        makeCandidate(
          Command.ChooseCoverTechTile,
          actor,
          phase,
          subphase,
          { position: tile.pos, tile: tile.tile },
          resourceFlow([], [], [`cover-tech:${tile.pos}`]),
          [],
          `${Command.ChooseCoverTechTile} ${tile.pos}`
        )
      );

    case Command.ChooseFaction:
      return command.data.map((faction) =>
        makeCandidate(
          Command.ChooseFaction,
          actor,
          phase,
          subphase,
          { faction },
          resourceFlow(),
          [],
          `${Command.ChooseFaction} ${faction}`
        )
      );

    case Command.ChooseFederationTile:
      return command.data.tiles.map((federation) => {
        const specs = federationRewardSpecs(federation);
        return makeCandidate(
          Command.ChooseFederationTile,
          actor,
          phase,
          subphase,
          { federation, rescore: command.data.rescore },
          resourceFlow([], specs.rewards, specs.effects),
          [],
          `${Command.ChooseFederationTile} ${federation}`
        );
      });

    case Command.ChooseIncome:
      return command.data.map((income) =>
        makeCandidate(
          Command.ChooseIncome,
          actor,
          phase,
          subphase,
          { income },
          resourceFlow([], [income]),
          [],
          `${Command.ChooseIncome} ${income}`
        )
      );

    case Command.ChooseRoundBooster:
      return command.data.boosters.map((booster) =>
        makeCandidate(
          Command.ChooseRoundBooster,
          actor,
          phase,
          subphase,
          { booster },
          resourceFlow([], [], [`take-booster:${booster}`]),
          [],
          `${Command.ChooseRoundBooster} ${booster}`
        )
      );

    case Command.ChooseTechTile:
      return command.data.tiles.map((tile) =>
        makeCandidate(
          Command.ChooseTechTile,
          actor,
          phase,
          subphase,
          { position: tile.pos, tile: tile.tile },
          resourceFlow([], [], [`take-tech:${tile.tile}`]),
          [],
          `${Command.ChooseTechTile} ${tile.pos}`
        )
      );

    case Command.ChooseTinkeringTile:
      return command.data.tiles.map((tile: TinkeringTile) =>
        makeCandidate(
          Command.ChooseTinkeringTile,
          actor,
          phase,
          subphase,
          { tile },
          resourceFlow([], [], [`tinkering-action:${tinkeringTileSpec(tile)}`]),
          [],
          `${Command.ChooseTinkeringTile} ${tile}`
        )
      );

    case Command.Decline:
      return [
        makeCandidate(
          Command.Decline,
          actor,
          phase,
          subphase,
          { offers: sortedUnique(command.data.offers.map((offer) => offer.offer)) },
          resourceFlow(),
          [],
          Command.Decline
        ),
      ];

    case Command.EndTurn:
      return [makeCandidate(Command.EndTurn, actor, phase, subphase, {}, resourceFlow(), [], Command.EndTurn)];

    case Command.ExamineArtifact:
      return [
        makeCandidate(
          Command.ExamineArtifact,
          actor,
          phase,
          subphase,
          { ship: Spaceship.Twilight as Spaceship.Twilight },
          resourceFlow([command.data.cost], [], ["choose-artifact-follow-up"]),
          [],
          Command.ExamineArtifact
        ),
      ];

    case Command.Explore:
      return command.data.ships.map((ship) =>
        makeCandidate(
          Command.Explore,
          actor,
          phase,
          subphase,
          {
            ship: ship.ship,
            coordinates: ship.coordinates,
            slot: ship.slot,
            charge: ship.charge,
            range: rangeMetadata(engine, actor, ship.coordinates, "explore", ship.adjustments),
          },
          resourceFlow([ship.cost], ship.charge > 0 ? [`${ship.charge}${Resource.ChargePower}`] : []),
          [],
          `${Command.Explore} ${ship.ship}`
        )
      );

    case Command.FormFederation: {
      const claimable = claimableSpaceshipFederations(
        engine.player(actor).data.explorationShips,
        engine.tiles.spaceshipFederations
      );
      const candidates: AtomicDecisionCandidate[] = [];
      for (const federation of command.data.federations) {
        const satellites = satelliteMetadata(engine, actor, federation.hexes);
        const satelliteCostResource =
          engine.player(actor).faction === Faction.Ivits ? Resource.Qic : Resource.GainToken;
        for (const tile of command.data.tiles) {
          const specs = federationRewardSpecs(tile);
          const spaceship = claimable.find((entry) => entry.federation === tile)?.ship ?? null;
          candidates.push(
            makeCandidate(
              Command.FormFederation,
              actor,
              phase,
              subphase,
              { federation: tile, spaceship, hexes: satellites.allHexes, satellites },
              resourceFlow(
                [`${satellites.newSatelliteHexes.length}${satelliteCostResource}`],
                specs.rewards,
                specs.effects
              ),
              federation.warnings,
              `${Command.FormFederation} ${federation.hexes} ${tile}`
            )
          );
        }
      }
      return candidates;
    }

    case Command.GaiaFormTransdim:
      return command.data.spaces.map((space) =>
        makeCandidate(
          Command.GaiaFormTransdim,
          actor,
          phase,
          subphase,
          { coordinates: space.coordinates, planet: Planet.Transdim as Planet.Transdim },
          resourceFlow([space.cost], [], ["instant-gaiaform"]),
          space.warnings,
          `${Command.GaiaFormTransdim} ${space.coordinates}`
        )
      );

    case Command.Pass: {
      const boosters = command.data.boosters;
      if (boosters.length === 0) {
        return [
          makeCandidate(Command.Pass, actor, phase, subphase, { booster: null }, resourceFlow(), [], Command.Pass),
        ];
      }
      return boosters.map((booster) =>
        makeCandidate(
          Command.Pass,
          actor,
          phase,
          subphase,
          { booster },
          resourceFlow([], [], [`take-booster:${booster}`]),
          [],
          `${Command.Pass} ${booster}`
        )
      );
    }

    case Command.PISwap:
      return command.data.buildings.map((building) =>
        makeCandidate(
          Command.PISwap,
          actor,
          phase,
          subphase,
          {
            coordinates: building.coordinates,
            from: Building.Mine as Building.Mine,
            to: Building.PlanetaryInstitute as Building.PlanetaryInstitute,
          },
          resourceFlow(),
          building.warnings,
          `${Command.PISwap} ${building.coordinates}`
        )
      );

    case Command.PlaceLostPlanet:
      return command.data.spaces.map((space) =>
        makeCandidate(
          Command.PlaceLostPlanet,
          actor,
          phase,
          subphase,
          {
            coordinates: space.coordinates,
            planet: Planet.Lost as Planet.Lost,
            range: rangeMetadata(engine, actor, space.coordinates, "build"),
          },
          resourceFlow([space.cost]),
          space.warnings,
          `${Command.PlaceLostPlanet} ${space.coordinates}`
        )
      );

    case Command.PlacePowerRing:
      return command.data.spaces.map((space) =>
        makeCandidate(
          Command.PlacePowerRing,
          actor,
          phase,
          subphase,
          { coordinates: space.coordinates },
          resourceFlow(),
          space.warnings,
          `${Command.PlacePowerRing} ${space.coordinates}`
        )
      );

    case Command.Special:
      return command.data.specialacts.map((action) =>
        makeCandidate(
          Command.Special,
          actor,
          phase,
          subphase,
          { income: action.income, eventSpec: action.spec },
          resourceFlow([], [action.income]),
          [],
          `${Command.Special} ${action.income}`
        )
      );

    case Command.Spend:
      return command.data.acts.reduce((candidates, action) => {
        const multipliers =
          action.range && action.range.length > 0 ? Array.from(new Set(action.range)).sort((a, b) => a - b) : [1];
        for (const multiplier of multipliers) {
          const cost = scaleRewardSpec(action.cost, multiplier);
          const income = scaleRewardSpec(action.income, multiplier);
          candidates.push(
            makeCandidate(
              Command.Spend,
              actor,
              phase,
              subphase,
              {
                cost,
                income,
                multiplier,
                allowedMultipliers: multipliers,
                hidden: action.hide ?? false,
              },
              resourceFlow([cost], [income]),
              [],
              `${Command.Spend} ${cost} for ${income}`
            )
          );
        }
        return candidates;
      }, [] as AtomicDecisionCandidate[]);

    case Command.SpaceshipAction:
      return command.data.actions.map((action) => {
        const specs = spaceshipActionResourceSpecs(action.ship, action.type);
        return makeCandidate(
          Command.SpaceshipAction,
          actor,
          phase,
          subphase,
          { ship: action.ship, action: action.type },
          resourceFlow([action.cost], specs.rewards, specs.effects),
          action.warnings,
          `${Command.SpaceshipAction} ${action.ship} ${action.type}`
        );
      });

    case Command.UpgradeResearch:
      return command.data.tracks.map((track) =>
        makeCandidate(
          Command.UpgradeResearch,
          actor,
          phase,
          subphase,
          { field: track.field, from: track.to - 1, to: track.to },
          resourceFlow([track.cost], [], [`upgrade-research:${track.field}:${track.to}`]),
          [],
          `${Command.UpgradeResearch} ${track.field}`
        )
      );

    case Command.BanFaction:
    case Command.Bid:
    case Command.Init:
    case Command.PreferenceBid:
    case Command.RotateSectors:
    case Command.Setup:
    case Command.SilentBid:
      throw new AtomicExpansionError(
        "unsupported-command",
        `Command ${command.name} is outside the standard-flow Lost Fleet Phase 1.2 boundary`
      );

    case Command.DeadEnd:
      throw new AtomicExpansionError(
        "unsupported-command",
        "Command deadEnd is an undo signal, not an executable atomic candidate"
      );

    default: {
      const neverCommand: never = command;
      throw new AtomicExpansionError(
        "unsupported-command",
        `Unrecognized AvailableCommand ${(neverCommand as AvailableCommand).name}`
      );
    }
  }
}

function comparableCandidate(candidate: AtomicDecisionCandidate): unknown {
  return {
    schemaVersion: candidate.schemaVersion,
    command: candidate.command,
    actor: candidate.actor,
    phase: candidate.phase,
    subphase: candidate.subphase,
    target: candidate.target,
    resources: candidate.resources,
    warnings: candidate.warnings,
    moveFragment: candidate.moveFragment,
  };
}

function finalizeCandidates(candidates: AtomicDecisionCandidate[]): AtomicDecisionExpansion {
  const byKey = new Map<string, AtomicDecisionCandidate>();
  const occurrences = new Map<string, number>();

  for (const candidate of candidates) {
    const key = canonicalCandidateKey(candidate);
    const keyed = { ...candidate, key } as AtomicDecisionCandidate;
    const existing = byKey.get(key);
    if (existing) {
      if (stableCandidateJson(comparableCandidate(existing)) !== stableCandidateJson(comparableCandidate(keyed))) {
        throw new AtomicExpansionError("semantic-key-collision", `Candidate key ${key} has conflicting metadata`);
      }
      occurrences.set(key, (occurrences.get(key) ?? 1) + 1);
    } else {
      byKey.set(key, keyed);
    }
  }

  const deduplications: CandidateDeduplication[] = Array.from(occurrences.entries()).map(([key, count]) => ({
    key,
    command: byKey.get(key).command,
    occurrences: count,
    reason: "identical-semantic-option",
  }));

  return {
    candidates: Array.from(byKey.values()).sort((left, right) => left.key.localeCompare(right.key)),
    deduplications: deduplications.sort((left, right) => left.key.localeCompare(right.key)),
  };
}

function defaultSubphase(engine: Engine): SubPhase | null {
  return engine.phase === Phase.RoundMove ? (engine.subPhase ?? SubPhase.BeforeMove) : null;
}

function expandDecisionEngine(
  decisionEngine: Engine,
  subphase: SubPhase | null,
  suppliedCommands?: AvailableCommand[]
): AtomicDecisionExpansion {
  const commands = suppliedCommands ?? decisionEngine.generateAvailableCommandsIfNeeded();
  const expanded: AtomicDecisionCandidate[] = [];

  for (const command of commands) {
    const candidates = expandCommand(decisionEngine, command, decisionEngine.phase, subphase);
    if (candidates.length === 0) {
      throw new AtomicExpansionError(
        "empty-command-data",
        `Command ${command.name} was offered without an executable data option`
      );
    }
    expanded.push(...candidates);
  }

  const result = finalizeCandidates(expanded);
  for (const command of commands) {
    if (command.name !== Command.Decline || command.data.offers.length <= 1) {
      continue;
    }
    const candidate = result.candidates.find(
      (entry) => entry.command === Command.Decline && entry.actor === command.player
    );
    result.deduplications.push({
      key: candidate.key,
      command: Command.Decline,
      occurrences: command.data.offers.length,
      reason: "decline-ignores-offer",
    });
  }
  result.deduplications.sort((left, right) => left.key.localeCompare(right.key));
  return result;
}

/**
 * Narrow offline hook for Phase 1.3's already-replayed conversion nodes. It deliberately does not
 * broaden Phase 1.2's public committed-source contract; callers must have produced the transient
 * engine solely by replaying typed Phase 1.2 fragments from a supported committed source.
 */
export function expandInternallyReplayedAtomicDecision(
  decisionEngine: Engine,
  subphase: SubPhase
): AtomicDecisionExpansion {
  if (decisionEngine.phase !== Phase.RoundMove) {
    throw new AtomicExpansionError(
      "unsupported-state",
      "Internal atomic expansion is restricted to Phase 1.3 RoundMove replay nodes"
    );
  }
  const commands = decisionEngine.availableCommands ?? decisionEngine.generateAvailableCommands(subphase);
  return expandDecisionEngine(decisionEngine, subphase, commands);
}

/** Typed Phase 1.2 projection of a narrow, caller-supplied internal command set. */
export function expandInternallySuppliedAtomicCommands(
  decisionEngine: Engine,
  subphase: SubPhase,
  commands: AvailableCommand[]
): AtomicDecisionExpansion {
  if (decisionEngine.phase !== Phase.RoundMove) {
    throw new AtomicExpansionError(
      "unsupported-state",
      "Internal supplied-command expansion is restricted to Phase 1.3 RoundMove replay nodes"
    );
  }
  return expandDecisionEngine(decisionEngine, subphase, commands);
}

/**
 * Expand the current legal decision without mutating the supplied engine. Phase 1.1's committed
 * state projector is deliberately invoked first, making its committed/standard-flow restrictions
 * the single support contract for Phase 1.2 as well.
 */
export function expandAtomicDecisions(engine: Engine, options: AtomicExpansionOptions = {}): AtomicDecisionExpansion {
  projectCanonicalState(engine);
  if ((engine.options.factionVariant ?? "standard") !== "standard") {
    throw new AtomicExpansionError(
      "unsupported-state",
      `Phase 1.2 supports only factionVariant=standard, got ${engine.options.factionVariant}`
    );
  }

  const decisionEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
  const priorMoveFragments = options.priorMoveFragments ?? [];
  if (priorMoveFragments.some((fragment) => !fragment || fragment.includes("."))) {
    throw new AtomicExpansionError(
      "invalid-command-data",
      "priorMoveFragments must contain non-empty individual command parts without dots"
    );
  }
  if (priorMoveFragments.length > 0) {
    if (options.subphase === undefined) {
      throw new AtomicExpansionError(
        "invalid-command-data",
        "An explicit subphase is required when expanding a chained decision"
      );
    }
    const actor = decisionEngine.player(decisionEngine.playerToMove);
    const prefix = actor?.faction ?? `p${decisionEngine.playerToMove + 1}`;
    decisionEngine.move(`${prefix} ${priorMoveFragments.join(". ")}`);
    if (decisionEngine.newTurn) {
      throw new AtomicExpansionError(
        "invalid-command-data",
        "priorMoveFragments already form a committed line; there is no chained atomic decision"
      );
    }
  }
  const commands = decisionEngine.generateAvailableCommandsIfNeeded();
  const subphase = options.subphase !== undefined ? options.subphase : defaultSubphase(decisionEngine);
  const expanded: AtomicDecisionCandidate[] = [];

  for (const command of commands) {
    const candidates = expandCommand(decisionEngine, command, decisionEngine.phase, subphase);
    if (candidates.length === 0) {
      throw new AtomicExpansionError(
        "empty-command-data",
        `Command ${command.name} was offered without an executable data option`
      );
    }
    expanded.push(...candidates);
  }

  const result = finalizeCandidates(expanded);
  for (const command of commands) {
    if (command.name !== Command.Decline || command.data.offers.length <= 1) {
      continue;
    }
    const candidate = result.candidates.find(
      (entry) => entry.command === Command.Decline && entry.actor === command.player
    );
    result.deduplications.push({
      key: candidate.key,
      command: Command.Decline,
      occurrences: command.data.offers.length,
      reason: "decline-ignores-offer",
    });
  }
  result.deduplications.sort((left, right) => left.key.localeCompare(right.key));
  return result;
}
