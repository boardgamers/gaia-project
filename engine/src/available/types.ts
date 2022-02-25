import {
  AdvTechTile,
  AdvTechTilePos,
  BoardAction,
  Booster,
  Building,
  Command,
  Faction,
  Federation,
  ResearchField,
  Resource,
  SubPhase,
  TechTile,
  TechTilePos,
} from "../enums";
import { BuildWarning } from "../player";
import { BrainstoneDest } from "../player-data";
import Reward from "../reward";
import { AvailableSetupOption } from "../setup";

export const ISOLATED_DISTANCE = 3;
export const UPGRADE_RESEARCH_COST = new Reward(4, Resource.Knowledge);

export enum BrainstoneWarning {
  brainstoneChargesWasted = "brainstone-charges-wasted",
}

export type BrainstoneActionData = {
  choices: { area: BrainstoneDest; warning?: BrainstoneWarning }[];
};
export type AvailableFreeAction = {
  cost: string;
  income: string;
  range?: number[];
  hide?: boolean;
};
export type AvailableFreeActionData = {
  acts: AvailableFreeAction[];
};
export type AvailableBoardAction = {
  name: BoardAction;
  cost: string;
  income: string[];
};
export type AvailableBoardActionData = {
  poweracts: AvailableBoardAction[];
};

export class Offer {
  constructor(readonly offer: string, readonly cost: string) {}
}

type BaseCommandData<Command extends string> = { [key in Command]?: any };
type AvailableCommands<
  Command extends string,
  AvailableCommandData extends BaseCommandData<Command>,
  PlayerId = number
> = {
  [command in Command]: _AvailableCommand<Command, AvailableCommandData, command, PlayerId>;
};
type __AvailableCommand<
  Command extends string,
  AvailableCommandData extends BaseCommandData<Command>,
  PlayerId = number
> = AvailableCommands<Command, AvailableCommandData, PlayerId>[Command];
type _CommandHelper<
  Command extends string,
  CommandData extends BaseCommandData<Command>,
  move extends Command
> = move extends keyof CommandData ? CommandData[move] : never;
type _AvailableCommand<
  Command extends string,
  AvailableCommandData extends BaseCommandData<Command>,
  command extends Command,
  PlayerId = number
> = _CommandHelper<Command, AvailableCommandData, command> extends never
  ? { name: command; player: PlayerId }
  : { name: command; player: PlayerId; data: _CommandHelper<Command, AvailableCommandData, command> };
type _MoveNameWithData<Command extends string, AvailableCommandData extends BaseCommandData<Command>> = {
  [command in Command]: _CommandHelper<Command, AvailableCommandData, command> extends never ? never : command;
};
export type PossibleBid = { faction: Faction; bid: number[] };
export type TechTileWithPos = { tile: TechTile; pos: TechTilePos };
export type AdvTechTileWithPos = { tile: AdvTechTile; pos: AdvTechTilePos };
export type ChooseTechTile = TechTileWithPos | AdvTechTileWithPos;
export type AvailableBuildCommandData = { buildings: AvailableBuilding[] };
export type AvailableFederation = { hexes: string; warnings: BuildWarning[] };

export enum ShipAction {
  Nothing = "nothing",
  BuildColony = "buildColony",
  Trade = "trade",
}

export type TradingLocation = (AvailableHex | AvailableBuilding) & { tradeCost: string; rewards: string };
export type ShipActionLocation = TradingLocation | AvailableBuilding;
export type AvailableShipAction = { type: ShipAction; locations: ShipActionLocation[] };
export type AvailableShipTarget = { location: AvailableHex; actions: AvailableShipAction[] };
export type AvailableMoveShipData = { ship: Building; source: string; targets: AvailableShipTarget[] };

interface CommandData {
  [Command.Action]: AvailableBoardActionData;
  [Command.Bid]: { bids: PossibleBid[] };
  [Command.BrainStone]: BrainstoneActionData;
  [Command.Build]: AvailableBuildCommandData;
  [Command.BurnPower]: number[];
  [Command.ChargePower]: { offers: Offer[] };
  [Command.ChooseCoverTechTile]: { tiles: TechTileWithPos[] };
  [Command.ChooseFaction]: Faction[];
  [Command.ChooseFederationTile]: { tiles: Federation[]; rescore: boolean };
  [Command.ChooseIncome]: string[];
  [Command.ChooseRoundBooster]: { boosters: Booster[] };
  [Command.ChooseTechTile]: { tiles: ChooseTechTile[] };
  [Command.DeadEnd]: SubPhase; // for debugging
  [Command.Decline]: { offers: Offer[] };
  [Command.EndTurn]: never;
  [Command.FormFederation]: { tiles: Federation[]; federations: AvailableFederation[] };
  [Command.Init]: never;
  [Command.Pass]: { boosters: Booster[] };
  [Command.PISwap]: AvailableBuildCommandData;
  [Command.PlaceLostPlanet]: { spaces: AvailableHex[] };
  [Command.MoveShip]: AvailableMoveShipData[];
  [Command.RotateSectors]: never;
  [Command.Setup]: AvailableSetupOption;
  [Command.Special]: { specialacts: { income: string; spec: string }[] };
  [Command.Spend]: AvailableFreeActionData;
  [Command.UpgradeResearch]: AvailableResearchData;
}

export type AvailableCommand<C extends Command = Command> = __AvailableCommand<C, CommandData>;
export type AvailableHex = {
  cost?: string;
  warnings?: BuildWarning[];
  coordinates: string;
};
export type AvailableBuilding = AvailableHex & {
  building: Building;
  upgrade?: boolean;
  downgrade?: boolean;
  steps?: number;
};
export type AvailableResearchTrack = { cost: string; field: ResearchField; to: number };
export type AvailableResearchData = { tracks: AvailableResearchTrack[] };
