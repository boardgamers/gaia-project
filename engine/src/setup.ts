import assert from "assert";
import shuffleSeed from "shuffle-seed";
import AvailableCommand from "./available-command";
import Engine from "./engine";
import {
  AdvTechTile,
  AdvTechTilePos,
  Booster,
  Command,
  Federation,
  FinalTile,
  Player,
  ScoringTile,
  TechTile,
  TechTilePos,
} from "./enums";
import SpaceMap, { MapTile } from "./map";

export enum SetupType {
  Booster = "booster",
  TechTile = "techTile",
  AdvTechTile = "advTechTile",
  TerraformingFederation = "terraformingFederation",
  RoundScoringTile = "roundScoringTile",
  FinalScoringTile = "finalScoringTile",
  MapTile = "mapTile",
}

export type SetupPosition = number | TechTilePos | AdvTechTilePos;
export type SetupOption = Booster | TechTile | AdvTechTile | Federation | ScoringTile | FinalTile | string; //string is for MapTile name

type SetupFactoryOption = {
  position: SetupPosition;
  options: SetupOption[];
};

export type AvailableSetupOption = { type: SetupType } & SetupFactoryOption;

type SetupFactory = {
  type: SetupType;
  nextAvailable: () => SetupFactoryOption | null;
  applyOption: (option: SetupOption, position: SetupPosition) => void;
  init: () => void;
};

function techFactory(
  engine: Engine,
  type: SetupType,
  tilePos: (TechTilePos | AdvTechTilePos)[],
  techTiles: (TechTile | AdvTechTile)[],
  count: number
) {
  return {
    type,
    init: () => {
      for (const pos of tilePos) {
        engine.tiles.techs[pos] = null;
      }
    },
    nextAvailable: () => {
      const used = tilePos
        .map((p) => engine.tiles.techs[p])
        .filter((t) => t)
        .map((t) => t.tile);
      for (const pos of tilePos) {
        if (!engine.tiles.techs[pos]) {
          return {
            position: pos,
            options: techTiles.filter((t) => !used.includes(t)),
          };
        }
      }
      return null;
    },
    applyOption: (option, position) => {
      engine.tiles.techs[position] = { tile: option, count: count };
    },
  };
}

function scoringFactory<T>(engine: Engine, type: SetupType, available: T[], used: T[], targetSize: number) {
  return {
    type: type,
    init: () => {
      used.length = 0;
    },
    nextAvailable: () => {
      return used.length === targetSize
        ? null
        : {
            position: used.length + 1,
            options: available.filter((a) => !used.includes(a)),
          };
    },
    applyOption: (option) => {
      used.push(option);
    },
  };
}

function usedSectorNames(map: SpaceMap): string[] {
  return Array.from(map.grid.values())
    .map((g) => g.data.sector)
    .map((s) => s);
}

function unusedMapTiles(map: SpaceMap): MapTile[] {
  const names = usedSectorNames(map);

  return map.configuration().sectors.filter((s) => !names.includes(s.name));
}

function setMap(engine: Engine, tiles: MapTile[]) {
  engine.map.generate(tiles, () => 0, engine.options.map?.mirror ?? false);
  engine.options.map = engine.map.placement;
}

const getFactories = (engine: Engine, nbPlayers = engine.players.length): SetupFactory[] => [
  {
    type: SetupType.Booster,
    init: () => {
      for (const b of Booster.values(engine.expansions)) {
        delete engine.tiles.boosters[b];
      }
    },
    nextAvailable: () => {
      const boosters = Booster.values(engine.expansions);
      const left = boosters.filter((b) => !engine.tiles.boosters[b]);
      const used = boosters.filter((b) => engine.tiles.boosters[b]).length;
      // Choose nbPlayers+3 boosters as part of the pool
      if (used < nbPlayers + 3) {
        const b = left[0];
        return {
          position: used + 1,
          options: left,
        };
      }
      return null;
    },
    applyOption: (option) => {
      engine.tiles.boosters[option] = true;
    },
  },
  techFactory(
    engine,
    SetupType.TechTile,
    TechTilePos.values(engine.expansions),
    TechTile.values(engine.expansions),
    nbPlayers
  ),
  techFactory(
    engine,
    SetupType.AdvTechTile,
    AdvTechTilePos.values(engine.expansions),
    AdvTechTile.values(engine.expansions),
    1
  ),
  {
    type: SetupType.TerraformingFederation,
    init: () => {
      for (const federation of Federation.values(engine.expansions)) {
        engine.tiles.federations[federation] = 3;
        engine.terraformingFederation = null;
      }
    },
    nextAvailable: () => {
      return engine.terraformingFederation
        ? null
        : {
            position: 1,
            options: Federation.values(engine.expansions),
          };
    },
    applyOption: (option) => {
      engine.terraformingFederation = option as Federation;
      engine.tiles.federations[engine.terraformingFederation] -= 1;
    },
  },
  scoringFactory(
    engine,
    SetupType.RoundScoringTile,
    ScoringTile.values(engine.expansions),
    engine.tiles.scorings.round,
    6
  ),
  scoringFactory(
    engine,
    SetupType.FinalScoringTile,
    FinalTile.values(engine.expansions),
    engine.tiles.scorings.final,
    2
  ),
  {
    type: SetupType.MapTile,
    init: () => {
      setMap(engine, []);
    },
    nextAvailable: () => {
      const used = engine.map.grid.size / 19;
      const nbSectors = engine.map.configuration().nbSectors;
      return used === nbSectors
        ? null
        : {
            position: used + 1,
            options: unusedMapTiles(engine.map).map((t) => t.name),
          };
    },
    applyOption: (option) => {
      const used = usedSectorNames(engine.map);
      const tiles = engine.map.configuration().sectors.filter((s) => used.includes(s.name) || s.name === option);
      setMap(engine, tiles);
    },
  },
];

export function applyRandomBoardSetup(engine: Engine, seed: string, nbPlayers: number) {
  //map has too many quirks to keep test cases compatible
  const factories = getFactories(engine, nbPlayers).filter((f) => f.type !== SetupType.MapTile);
  for (const factory of factories) {
    factory.init();

    let options: SetupOption[];

    let next: SetupFactoryOption;
    while ((next = factory.nextAvailable()) !== null) {
      if (!options) {
        //only shuffle once for compatability with old test cases
        options = shuffleSeed.shuffle(next.options, engine.map.rng());
      }

      factory.applyOption(options.shift(), next.position);
    }
  }
}

export function initCustomSetup(engine: Engine) {
  for (const factory of getFactories(engine)) {
    factory.init();
  }
}

function nextAvailableSetupOption(engine: Engine): AvailableSetupOption | null {
  for (const factory of getFactories(engine)) {
    const o = factory.nextAvailable();
    if (o) {
      return {
        type: factory.type,
        position: o.position,
        options: o.options,
      };
    }
  }
  return null;
}

export function applySetupOption(engine: Engine, type: SetupType, position: SetupPosition, option: SetupOption) {
  for (const factory of getFactories(engine)) {
    const o = factory.nextAvailable();
    if (o) {
      assert(factory.type === type, `expected option for ${factory.type}, but got option for ${type}`);
      assert(
        o.position.toString() === position.toString(),
        `option ${option} has wrong position ${position}, expected ${o.position}`
      );
      factory.applyOption(option, position);
      return;
    }
  }
}

export function possibleSetupBoardActions(engine: Engine, player: Player): AvailableCommand[] {
  if (engine.options.customBoardSetup) {
    const setupOption = nextAvailableSetupOption(engine);

    if (setupOption) {
      return [{ name: Command.Setup, player, data: setupOption }];
    }
  }

  return [{ name: Command.RotateSectors, player }];
}
