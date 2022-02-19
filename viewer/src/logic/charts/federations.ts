import Engine, {
  Building,
  Command,
  Expansion,
  Federation,
  federationCost,
  GaiaHex,
  parseFederationLocation,
  Player,
  Resource,
  TechTile,
} from "@gaia-project/engine";
import SpaceMap from "@gaia-project/engine/src/map";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";
import { sum } from "lodash";
import { federationData } from "../../data/federations";
import { CommandObject } from "../recent";
import { BuildingCounter } from "./buildings";
import { ChartSource } from "./charts";
import { ChartSummary, ExtractLog, SimpleSourceFactory } from "./simple-charts";

function isSpecialOperator(data: Engine, cmd: CommandObject) {
  return data.tiles.techs[cmd.args[0]].tile == TechTile.Tech3;
}

export class BuildingPowerValueCounter {
  hasPlanetaryInstitute = false;
  hasSpecialOperator = false;
  readonly buildings;
  private readonly federation: boolean;

  constructor(federation: boolean) {
    this.buildings = new BuildingCounter();
    this.federation = federation;
  }

  playerCommand(cmd: CommandObject, data: Engine) {
    this.buildings.playerCommand(cmd, data);

    if (cmd.command == Command.Build) {
      const building = cmd.args[0] as Building;
      const hex = data.map.getS(cmd.args[1]);
      if (building == Building.PlanetaryInstitute) {
        this.hasPlanetaryInstitute = true;
      }
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

export const federationDiscount = (
  getBonus: (arg: GetFederationBonusArg) => number,
  scorer = (value: number) => value
): ExtractLog<ChartSource<any>> =>
  ExtractLog.wrapper((p, s) => {
    const counter = new BuildingPowerValueCounter(true);
    let federationCount = 0;
    let spaceStations = 0;

    return ExtractLog.filterPlayer((a) => {
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

        const bonus = getBonus({ cost, powerValue, counter, hexes, player, spaceStations });
        return scorer(Math.max(0, bonus + cost - powerValue));
      }

      return 0;
    });
  });

export function federationsSourceFactory(expansions: Expansion): SimpleSourceFactory<ChartSource<Federation>> {
  return {
    name: "Federations",
    summary: ChartSummary.total,
    playerSummaryLineChartTitle: "Federations of all players",
    extractLog: ExtractLog.filterPlayer((e) => {
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
          if (federationRewards(type).join(",") === want) {
            return 1;
          }
        }
      }
      return 0;
    }),
    sources: Federation.values(expansions)
      .map((f) => ({
        type: f,
        label: federationRewards(f).join(","),
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
}
