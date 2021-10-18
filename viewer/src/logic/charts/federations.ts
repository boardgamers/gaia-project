import Engine, {
  Building,
  Command,
  Federation,
  federationCost,
  federations,
  GaiaHex,
  parseFederationLocation,
  Player,
  Resource,
  TechTile,
} from "@gaia-project/engine";
import SpaceMap from "@gaia-project/engine/src/map";
import { sum } from "lodash";
import { federationData } from "../../data/federations";
import { CommandObject } from "../recent";
import { getMapHex } from "../utils";
import { ChartSource } from "./charts";
import { ExtractLog, SimpleSourceFactory } from "./simple-charts";

function isSpecialOperator(data: Engine, cmd: CommandObject) {
  return data.tiles.techs[cmd.args[0]].tile == TechTile.Tech3;
}

export class BuildingPowerValueCounter {
  hasPlanetaryInstitute = false;
  initialPlanetaryInstituteLocation?: GaiaHex;
  planetaryInstituteLocation?: GaiaHex;
  hasSpecialOperator = false;
  buildings: Map<GaiaHex, Building> = new Map<GaiaHex, Building>();
  private readonly federation: boolean;

  constructor(federation: boolean) {
    this.federation = federation;
  }

  playerCommand(cmd: CommandObject, data: Engine) {
    if (cmd.command == Command.Build) {
      const building = cmd.args[0] as Building;
      const hex = getMapHex(data.map, cmd.args[1]);
      this.buildings.set(hex, building);
      if (building == Building.PlanetaryInstitute) {
        this.hasPlanetaryInstitute = true;
        this.initialPlanetaryInstituteLocation = hex;
        this.planetaryInstituteLocation = hex;
      }
    }
    if (cmd.command == Command.PISwap) {
      const hex = getMapHex(data.map, cmd.args[0]);
      this.buildings.set(this.planetaryInstituteLocation, Building.Mine);
      this.buildings.set(hex, Building.PlanetaryInstitute);
      this.planetaryInstituteLocation = hex;
    }
    if (cmd.command == Command.ChooseTechTile && isSpecialOperator(data, cmd)) {
      this.hasSpecialOperator = true;
    }
    if (cmd.command == Command.ChooseCoverTechTile && isSpecialOperator(data, cmd)) {
      this.hasSpecialOperator = false;
    }
  }

  buildingValue(hex: GaiaHex, map: SpaceMap, player: Player): number {
    return player.buildingValue(map.grid.get(hex), {
      building: this.buildings.get(hex),
      hasPlanetaryInstitute: this.hasPlanetaryInstitute,
      hasSpecialOperator: this.hasSpecialOperator,
      federation: this.federation,
    });
  }
}

export type GetFederationBonusArg = {
  cost: number;
  powerValue: number;
  counter: BuildingPowerValueCounter;
  hexes: GaiaHex[];
  player: Player;
  spaceStations: number;
};

export const federationDiscount = (getBonus: (arg: GetFederationBonusArg) => number): ExtractLog<ChartSource<any>> =>
  ExtractLog.new((p, s) => {
    const counter = new BuildingPowerValueCounter(true);
    let federationCount = 0;
    let spaceStations = 0;

    return (a) => {
      counter.playerCommand(a.cmd, a.data);

      if (a.cmd.command === Command.Special && a.cmd.args[0] == Resource.SpaceStation) {
        spaceStations++;
      }
      if (a.cmd.command === Command.FormFederation) {
        const player = a.data.player(a.log.player);
        const cost = federationCost(player.faction, counter.hasPlanetaryInstitute, federationCount);
        const map = a.data.map;
        const hexes = parseFederationLocation(a.cmd.args[0], map);
        const powerValue = sum(hexes.map((h) => counter.buildingValue(h, map, player)));
        federationCount++;

        return Math.max(0, getBonus({ cost, powerValue, counter, hexes, player, spaceStations }) + cost - powerValue);
      }

      return 0;
    };
  });

export const federationsSourceFactory: SimpleSourceFactory<ChartSource<Federation>> = {
  name: "Federations",
  showWeightedTotal: false,
  playerSummaryLineChartTitle: "Federations of all players",
  extractLog: ExtractLog.stateless((e) => {
    const type = e.source.type;
    if (e.cmd.command == Command.FormFederation) {
      return (e.cmd.args[1] as Federation) == type ? 1 : 0;
    }
    if (e.allCommands[0] === e.cmd && !e.allCommands.find((c) => c.command == Command.FormFederation)) {
      //only take the federation from changes once, i.e. when seeing the first command
      const c = e.log.changes?.[Command.FormFederation];
      if (c != null) {
        const want = Object.entries(c)
          .map(([r, a]) => (a > 1 ? a : "") + r)
          .join(",");
        if (Object.entries(federations).find(([, res]) => res == want)[0] == type) {
          return 1;
        }
      }
    }
    return 0;
  }),
  sources: Federation.values()
    .map((f) => ({
      type: f,
      label: federations[f],
      color: federationData[f].color,
      weight: 1,
    }))
    .concat({
      type: Federation.Gleens,
      label: "Gleens",
      color: "--desert",
      weight: 1,
    }),
};
