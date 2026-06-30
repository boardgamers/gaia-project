import Engine from "@gaia-project/engine";
import { possibleSpecialActions } from "@gaia-project/engine/src/available/actions";
import {
  ArtifactToken,
  Building,
  Command,
  Faction,
  Federation,
  Phase,
  Planet,
  Player as PlayerEnum,
  ResearchField,
  Spaceship,
  SpaceshipFederation,
  SpaceshipTechTile,
  SubPhase,
  TechTilePos,
} from "@gaia-project/engine/src/enums";
import { GaiaHex } from "@gaia-project/engine/src/gaia-hex";
import { Power } from "@gaia-project/engine/src/player-data";

export type SelfContainedScenario = {
  id: string;
  label: string;
  description: string;
  tags: string[];
  build: () => Engine;
};

function clonedEngineData(engine: Engine): any {
  return JSON.parse(JSON.stringify(engine));
}

function createLostFleetRoundMoveEngine(
  nbPlayers: number,
  factions: Faction[] = [Faction.Terrans, Faction.Lantids, Faction.HadschHallas, Faction.Ivits]
) {
  const engine = new Engine([`init ${nbPlayers} lost-fleet-scenario-${nbPlayers}`], { lostFleet: true });

  engine.players.forEach((pl, index) => {
    pl.faction = factions[index];
    pl.name = `P${index + 1}`;
    pl.loadFaction(null, engine.expansions);
    pl.data.victoryPoints = 30;
    pl.data.qics = 10;
    pl.data.credits = 20;
    pl.data.knowledge = 10;
    pl.data.ores = 10;
    pl.data.power = new Power(4, 4, 4, 0);
  });

  engine.phase = Phase.RoundMove;
  engine.round = 3;
  engine.turnOrder = engine.players.map((pl) => pl.player);
  engine.currentPlayer = PlayerEnum.Player1;

  return engine;
}

function occupyPlanetsOfDistinctTypes(engine: Engine, player: PlayerEnum, count: number): GaiaHex[] {
  const pl = engine.player(player);
  const seenTypes = new Set<Planet>();
  const hexes: GaiaHex[] = [];

  for (const hex of engine.map.grid.values()) {
    if (hexes.length >= count) {
      break;
    }
    if (!hex.hasPlanet() || hex.data.spaceship !== undefined || hex.occupied() || seenTypes.has(hex.data.planet)) {
      continue;
    }
    seenTypes.add(hex.data.planet);
    hexes.push(hex);
  }

  for (const hex of hexes) {
    hex.data.player = player;
    hex.data.building = Building.Mine;
    pl.data.occupied.push(hex);
  }

  pl.data.buildings[Building.Mine] = pl.data.occupied.length;
  return hexes;
}

function occupyConnectedPlanets(engine: Engine, player: PlayerEnum, count: number): GaiaHex[] {
  const pl = engine.player(player);
  const start = [...engine.map.grid.values()].find((hex) => hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied());

  if (!start) {
    throw new Error("No starting planet found for federation scenario");
  }

  const queue: GaiaHex[] = [start];
  const visited = new Set<GaiaHex>();
  const cluster: GaiaHex[] = [];

  while (queue.length > 0 && cluster.length < count) {
    const hex = queue.shift();
    if (!hex || visited.has(hex)) {
      continue;
    }

    visited.add(hex);

    if (hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied()) {
      cluster.push(hex);
      for (const neighbor of engine.map.grid.neighbours(hex)) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }

  for (const hex of cluster) {
    hex.data.player = player;
    hex.data.building = Building.Mine;
    pl.data.occupied.push(hex);
  }

  pl.data.buildings[Building.Mine] = pl.data.occupied.length;
  return cluster;
}

function occupyNearestPlanet(engine: Engine, player: PlayerEnum, ship: Spaceship): GaiaHex {
  const pl = engine.player(player);
  const shipTile = [...engine.map.grid.values()].find((hex) => hex.data.spaceship === ship);
  if (!shipTile) {
    throw new Error(`No ${ship} tile found on Lost Fleet map`);
  }

  const candidate = [...engine.map.grid.values()]
    .filter((hex) => hex.hasPlanet() && hex.data.spaceship === undefined && !hex.occupied())
    .sort((a, b) => engine.map.distance(a, shipTile) - engine.map.distance(b, shipTile))[0];

  if (!candidate) {
    throw new Error(`No colonizable planet found near ${ship}`);
  }

  candidate.data.player = player;
  candidate.data.building = Building.Mine;
  pl.data.occupied.push(candidate);
  pl.data.buildings[Building.Mine] = pl.data.occupied.length;

  return candidate;
}

function occupyFirstAvailablePlanet(
  engine: Engine,
  player: PlayerEnum,
  building = Building.Mine,
  predicate?: (hex: GaiaHex) => boolean
): GaiaHex {
  const pl = engine.player(player);
  const hex = [...engine.map.grid.values()].find(
    (space) =>
      space.hasPlanet() &&
      space.data.spaceship === undefined &&
      !space.occupied() &&
      (predicate ? predicate(space) : true)
  );

  if (!hex) {
    throw new Error("No available colonizable planet found");
  }

  hex.data.player = player;
  hex.data.building = building;
  pl.data.occupied.push(hex);
  pl.data.buildings[building] += 1;

  return hex;
}

function setSubPhaseCommands(engine: Engine, subPhase: SubPhase, data?: any) {
  engine.subPhase = subPhase;
  engine.availableCommands = engine.generateAvailableCommands(subPhase, data);
}

function finalizeScenario(engine: Engine): Engine {
  return Engine.fromData(clonedEngineData(engine));
}

export const selfContainedScenarios: SelfContainedScenario[] = [
  {
    id: "lost-fleet-overview",
    label: "Lost Fleet Overview",
    description: "General round-move snapshot with explored ships, seeded rewards, and mixed factions for map and panel checks.",
    tags: ["overview", "map", "panels"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(3, [Faction.Darkanians, Faction.SpaceGiants, Faction.Terrans]);

      occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 2);
      occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player2, 2);
      occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player3, 1);

      engine.players[0].name = "Darkanians";
      engine.players[1].name = "Space Giants";
      engine.players[2].name = "Terrans";
      engine.players[0].data.explorationShips[Spaceship.Twilight] = 2;
      engine.players[1].data.explorationShips[Spaceship.Eclipse] = 1;
      engine.players[2].data.explorationShips[Spaceship.TFMars] = 3;
      engine.tiles.spaceshipTechs[Spaceship.TFMars] = { tile: SpaceshipTechTile.Resource, count: 1 };
      engine.tiles.spaceshipFederations[Spaceship.Twilight] = SpaceshipFederation.Tech;
      engine.tiles.spaceshipFederations[Spaceship.Eclipse] = SpaceshipFederation.Range;
      engine.tiles.artifacts = [ArtifactToken.Credit, ArtifactToken.Power, ArtifactToken.DeepSpace];

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-explore-ready",
    label: "Explore Ready",
    description: "Player 1 can click Explore immediately to test shuttle slots, ship costs, and the exploration command flow.",
    tags: ["explore", "ships", "actions"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(2, [Faction.Terrans, Faction.Lantids]);

      occupyNearestPlanet(engine, PlayerEnum.Player1, Spaceship.Twilight);

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-twilight-range-plus-3",
    label: "Twilight +3 Range",
    description: "Twilight's knowledge action is already active; click Build a Mine to verify the extended range overlay.",
    tags: ["twilight", "range", "build"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(3);
      const player = engine.player(PlayerEnum.Player1);

      player.data.explorationShips[Spaceship.Twilight] = 1;
      occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);
      player.data.temporaryRange = 3;
      engine.spaceshipActions[Spaceship.Twilight] = { knowledge: PlayerEnum.Player1 };

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-ship-federation-claim",
    label: "Ship Federation Claim",
    description: "Player 1 can form a federation and choose between explored-ship federation rewards alongside the normal pool tokens.",
    tags: ["federation", "claim", "ships"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(3);
      const player = engine.player(PlayerEnum.Player1);
      const cluster = occupyConnectedPlanets(engine, PlayerEnum.Player1, 6);
      const claimableFederations = [
        { ship: Spaceship.Twilight, federation: SpaceshipFederation.Credit },
        { ship: Spaceship.Eclipse, federation: SpaceshipFederation.Range },
      ];
      const poolTiles = Object.keys(engine.tiles.federations)
        .filter((key) => engine.tiles.federations[key as Federation] > 0)
        .map((tile) => tile as Federation);

      cluster[0].data.building = Building.ResearchLab;
      player.data.buildings[Building.Mine] = cluster.length - 1;
      player.data.buildings[Building.ResearchLab] = 1;
      player.data.explorationShips[Spaceship.Twilight] = 1;
      player.data.explorationShips[Spaceship.Eclipse] = 1;
      engine.tiles.spaceshipFederations[Spaceship.Twilight] = SpaceshipFederation.Credit;
      engine.tiles.spaceshipFederations[Spaceship.Eclipse] = SpaceshipFederation.Range;
      engine.availableCommands = [
        {
          name: Command.FormFederation,
          player: PlayerEnum.Player1,
          data: {
            tiles: [...poolTiles, ...claimableFederations.map((entry) => entry.federation)],
            federations: [
              {
                hexes: cluster
                  .map((hex) => hex.toString())
                  .sort()
                  .join(","),
                warnings: [],
              },
            ],
            claimableFederations,
          },
        },
      ];

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-artifact-choice",
    label: "Artifact Choice",
    description: "Twilight has already paid 6 power; choose one of the remaining artifact tokens directly.",
    tags: ["artifacts", "twilight", "choices"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(3);
      const player = engine.player(PlayerEnum.Player1);

      player.data.explorationShips[Spaceship.Twilight] = 1;
      engine.tiles.artifacts = [ArtifactToken.Credit, ArtifactToken.Federation, ArtifactToken.DeepSpace];
      player.data.power = new Power(2, 2, 2, 0);
      setSubPhaseCommands(engine, SubPhase.ChooseArtifactToken);

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-space-giants-special",
    label: "Space Giants Special",
    description: "Space Giants can use their once-per-round Build a Mine special with 2 free terraforming steps.",
    tags: ["space-giants", "special-action", "terraforming"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(2, [Faction.SpaceGiants, Faction.Terrans]);

      occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);

      const [command] = possibleSpecialActions(engine, PlayerEnum.Player1);
      const action = command?.data.specialacts.find((specialact) => specialact.income === "2step");
      if (!action) {
        throw new Error("Expected Space Giants 2-step special action to be available");
      }

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-terraforming-board",
    label: "Terraforming Board",
    description: "Faction setup with resolved Tinkeroids and Moweyds 3-step colors for the Lost Fleet terraforming board.",
    tags: ["setup", "terraforming-board", "factions"],
    build: () =>
      finalizeScenario(
        new Engine(
          [
            "init 3 lost-fleet-terraforming-board-scenario",
            "p1 faction tinkeroids",
            "p2 faction bescods",
            "p3 faction moweyds",
          ],
          { lostFleet: true }
        )
      ),
  },
  {
    id: "lost-fleet-ship-tech-claim",
    label: "Ship Tech Claim",
    description: "An explored ship tech is ready to claim through the normal tech-pick flow.",
    tags: ["tech", "ships", "research"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(3);
      const player = engine.player(PlayerEnum.Player1);

      player.data.explorationShips[Spaceship.TFMars] = 1;
      player.data.research[ResearchField.GaiaProject] = 2;
      player.data.tiles.techs.push({
        tile: SpaceshipTechTile.Range,
        pos: TechTilePos.Navigation,
        enabled: true,
      });
      engine.tiles.spaceshipTechs[Spaceship.TFMars] = { tile: SpaceshipTechTile.Resource, count: 1 };
      setSubPhaseCommands(engine, SubPhase.ChooseTechTile);

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-tf-mars-instant-gaiaforming",
    label: "T F Mars Instant Gaiaforming",
    description: "T F Mars's power action is at the target-selection step so you can test transdim-to-Gaia targeting directly.",
    tags: ["tf-mars", "gaiaforming", "ships"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(3);
      const player = engine.player(PlayerEnum.Player1);

      player.data.explorationShips[Spaceship.TFMars] = 1;
      occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);
      setSubPhaseCommands(engine, SubPhase.InstantGaiaforming);

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-eclipse-asteroid-mine",
    label: "Eclipse Asteroid Mine",
    description: "Eclipse's credit action is paused on the bonus asteroid-mine placement step.",
    tags: ["eclipse", "asteroid", "build"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(3);
      const player = engine.player(PlayerEnum.Player1);

      player.data.explorationShips[Spaceship.Eclipse] = 1;
      occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);
      setSubPhaseCommands(engine, SubPhase.SpaceshipBuildMine, { ship: Spaceship.Eclipse });

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-range-fed-build-mine",
    label: "Range Federation Build",
    description: "The Range federation token's follow-up Build a Mine action is ready, with unlimited range and no mine build cost.",
    tags: ["federation", "range", "build"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(3);

      occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);
      setSubPhaseCommands(engine, SubPhase.FederationTokenBuildMine, {
        federation: SpaceshipFederation.Range,
      });

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-terraform-fed-build-mine",
    label: "Terraform Federation Build",
    description: "The Terraform federation token's discounted Build a Mine follow-up is ready for placement testing.",
    tags: ["federation", "terraform", "build"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(3);

      occupyPlanetsOfDistinctTypes(engine, PlayerEnum.Player1, 1);
      setSubPhaseCommands(engine, SubPhase.FederationTokenBuildMine, {
        federation: SpaceshipFederation.Terraform,
      });

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-rebellion-upgrade-ts",
    label: "Rebellion Upgrade TS",
    description: "Rebellion's power action is positioned on the mine-to-trading-station upgrade selection step.",
    tags: ["rebellion", "upgrade", "ships"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(3);
      const player = engine.player(PlayerEnum.Player1);

      player.data.explorationShips[Spaceship.Rebellion] = 1;
      occupyFirstAvailablePlanet(engine, PlayerEnum.Player1, Building.Mine);
      setSubPhaseCommands(engine, SubPhase.SpaceshipUpgradeBuilding, {
        from: Building.Mine,
        to: Building.TradingStation,
      });

      return finalizeScenario(engine);
    },
  },
  {
    id: "lost-fleet-moweyds-power-ring",
    label: "Moweyds Power Ring",
    description: "Moweyds can trigger their power-ring special action from the Planetary Institute and place the ring on-map.",
    tags: ["moweyds", "power-ring", "special-action"],
    build: () => {
      const engine = createLostFleetRoundMoveEngine(2, [Faction.Moweyds, Faction.Terrans]);
      const player = engine.player(PlayerEnum.Player1);

      occupyFirstAvailablePlanet(engine, PlayerEnum.Player1, Building.PlanetaryInstitute);
      player.loadEvents(player.board.buildings[Building.PlanetaryInstitute].income[0]);

      return finalizeScenario(engine);
    },
  },
];

const scenarioById = new Map(selfContainedScenarios.map((scenario) => [scenario.id, scenario]));

export function parseScenarioFromQuery(search = ""): string | null {
  const params = new URLSearchParams(search);
  return params.get("scenario");
}

export function loadScenarioEngine(id: string): Engine {
  const scenario = scenarioById.get(id);
  if (!scenario) {
    throw new Error(`Unknown self-contained scenario "${id}"`);
  }

  const engine = scenario.build();
  engine.generateAvailableCommandsIfNeeded();
  return engine;
}

export function loadScenarioEngineData(id: string): any {
  return clonedEngineData(loadScenarioEngine(id));
}

export function buildScenarioUrl(baseHref: string, id: string): string {
  const url = new URL(baseHref, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  url.search = "";
  url.searchParams.set("scenario", id);
  return url.toString();
}
