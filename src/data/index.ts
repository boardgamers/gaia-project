import {Player, AdvTechTile, TechTile, TechTilePos, ScoringTile, FinalTile, AvailableCommand, GaiaHex, AdvTechTilePos, Booster, Federation, Phase} from "@gaia-project/engine";

export interface AugmentedPlayer extends Player {
  progress: {[key in FinalTile]: number};
}

export interface ButtonData {
  label?: string;
  command: string;
  tooltip?: string;
  modal?: string;
  hexes?: HighlightHexData;
  hover?: boolean;
  researchTiles?: string[];
  techs?: Array<TechTilePos | AdvTechTilePos>;
  boosters?: Booster[];
  selectHexes?: boolean;
  actions?: string[];
  federations?: Federation[];

  buttons?: ButtonData[];
  hide?: boolean;
}

export type MapData = GaiaHex[];

export interface Data {
  map: MapData,
  availableCommands: AvailableCommand[];
  players: AugmentedPlayer[];
  round: number;
  phase: Phase;
  tiles: {
    techs: {
      [key in TechTilePos | AdvTechTilePos]: {
        tile: TechTile,
        count: number
      }
    },
    boosters: {
      [key in Booster]?: boolean
    },
    scorings: {
      round: [ScoringTile, ScoringTile, ScoringTile, ScoringTile, ScoringTile, ScoringTile],
      final: [FinalTile, FinalTile]
    }
  }

  // Should the next move be placed on a whole new line?
  newTurn: boolean;
}

export type HighlightHexData = Map<GaiaHex, {cost?: string}>;

export interface GameContext {
  highlighted: {
    hexes: HighlightHexData,
    researchTiles: Set<string>,
    techs: Set<TechTilePos | AdvTechTilePos>,
    boosters: Set<Booster>,
    actions: Set<string>,
    federations: Set<Federation>
  };

  coordsMap: Map<string, GaiaHex>;
  activeButton: ButtonData;
  hexSelection: boolean;
}
