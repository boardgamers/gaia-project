import { CubeCoordinates } from "hexagrid";

export enum Planet {
  Empty = "e",
  Terra = "r",
  Desert = "d",
  Swamp = "s",
  Oxide = "o",
  Volcanic = "v",
  Titanium = "t",
  Ice = "i",
  Gaia = "g",
  Transdim = "m",
  Lost = "l",
}

export enum ResearchField {
  Terraforming = "terra",
  Navigation = "nav",
  Intelligence = "int",
  GaiaProject = "gaia",
  Economy = "eco",
  Science = "sci",
}

export enum Expansion {
  All = 1,
}

export namespace ResearchField {
  export function values(expansions = 0): ResearchField[] {
    const ret = [
      ResearchField.Terraforming,
      ResearchField.Navigation,
      ResearchField.Intelligence,
      ResearchField.GaiaProject,
      ResearchField.Economy,
      ResearchField.Science,
    ];

    return ret;
  }
}

export enum Resource {
  None = "~",
  Ore = "o",
  Credit = "c",
  Knowledge = "k",
  Qic = "q",
  ChargePower = "pw",
  PayPower = "pay-pw",
  BowlToken = "bowl-t",
  BurnToken = "burn-token",
  GainToken = "t",
  GainTokenGaiaArea = "tg",
  MoveTokenToGaiaArea = "t->tg",
  VictoryPoint = "vp",
  TerraformCostDiscount = "d",
  Range = "r",
  GaiaFormer = "gf",
  SpaceStation = "space-station",
  DowngradeLab = "down-lab",
  UpgradeTerraforming = "up-terra",
  UpgradeNavigation = "up-nav",
  UpgradeIntelligence = "up-int",
  UpgradeGaiaProject = "up-gaia",
  UpgradeEconomy = "up-eco",
  UpgradeScience = "up-sci",
  UpgradeLowest = "up-lowest",
  TechTile = "tech",
  RescoreFederation = "fed",
  TemporaryStep = "step",
  TemporaryRange = "range",
  TokenArea3 = "t-a3",
  PISwap = "swap-PI",
  Turn = "turn",
}

export enum Operator {
  /** One-time income */
  Once = ">",
  /** Income at the beginning of every round */
  Income = "+",
  /** Each time condition is fulfilled, reward is gained */
  Trigger = ">>",
  /** Activate during round once */
  Activate = "=>",
  /** On round end for player */
  Pass = "|",
  /** reserved op for planetary institute and academies becoming 4pw structures */
  Special = "PA->4pw",
}

export enum Condition {
  None = "~",

  // common
  Mine = "m",
  TradingStation = "ts",
  ResearchLab = "lab",
  PlanetaryInstituteOrAcademy = "PA",
  Federation = "fed",

  // count only
  Gaia = "g",
  PlanetType = "pt",
  Sector = "s",
  Structure = "st",
  StructureFed = "stfed",
  Satellite = "sat",
  StructureValue = "stvalue",
  StructureFedValue = "stfedvalue",
  ResearchLevels = "a",
  HighestResearchLevel = "L",

  // trigger only
  MineOnGaia = "mg",
  AdvanceResearch = "a",
  TerraformStep = "step",
  GaiaFormer = "gf",
}

export namespace Condition {
  export function matchesBuilding(condition: Condition, building: Building, planet: Planet): boolean {
    if ((condition as string) === (building as string)) {
      return true;
    }
    switch (condition) {
      case Condition.MineOnGaia:
        return building === Building.Mine && planet === Planet.Gaia;
      case Condition.PlanetaryInstituteOrAcademy:
        return (
          building === Building.PlanetaryInstitute || building === Building.Academy1 || building === Building.Academy2
        );
    }
    return false;
  }
}

export enum Building {
  Mine = "m",
  TradingStation = "ts",
  ResearchLab = "lab",
  PlanetaryInstitute = "PI",
  Academy1 = "ac1",
  Academy2 = "ac2",
  GaiaFormer = "gf",
  SpaceStation = "sp",
}

export enum Faction {
  Terrans = "terrans",
  Lantids = "lantids",
  HadschHallas = "hadsch-hallas",
  Ivits = "ivits",
  Geodens = "geodens",
  BalTaks = "baltaks",
  Xenos = "xenos",
  Gleens = "gleens",
  Taklons = "taklons",
  Ambas = "ambas",
  Firaks = "firaks",
  Bescods = "bescods",
  Nevlas = "nevlas",
  Itars = "itars",
}

export enum Command {
  Action = "action",
  Bid = "bid",
  BrainStone = "brainstone",
  Build = "build",
  BurnPower = "burn",
  ChargePower = "charge",
  ChooseCoverTechTile = "cover",
  ChooseFaction = "faction",
  ChooseFederationTile = "fedtile",
  ChooseIncome = "income",
  ChooseRoundBooster = "booster",
  ChooseTechTile = "tech",
  DeadEnd = "deadEnd", // this command cannot be executed - it just signals that you have to undo
  Decline = "decline",
  EndTurn = "endturn",
  FormFederation = "federation",
  Init = "init",
  Pass = "pass",
  PickReward = "pick",
  PISwap = "swap-PI",
  PlaceLostPlanet = "lostPlanet",
  RotateSectors = "rotate",
  Special = "special",
  Spend = "spend",
  UpgradeResearch = "up",
}

export enum Player {
  Player1,
  Player2,
  Player3,
  Player4,
  Player5,
  All,
}

export enum Round {
  None = 0,
  Round1 = 1,
  Round2 = 2,
  Round3 = 3,
  Round4 = 4,
  Round5 = 5,
  Round6 = 6,
  LastRound = 6,
}

export enum RoundScoring {
  Round1 = "round1",
  Round2 = "round2",
  Round3 = "round3",
  Round4 = "round4",
  Round5 = "round5",
  Round6 = "round6",
}

export namespace RoundScoring {
  export function values(expansions = 0): RoundScoring[] {
    return (Object.values(RoundScoring) as RoundScoring[]).filter((val: RoundScoring) => {
      if (typeof val !== "string") {
        return;
      }
      if (/^round[0-9]/.test(val)) {
        return true;
      }
    }) as RoundScoring[];
  }
}

export enum Booster {
  Booster1 = "booster1",
  Booster2 = "booster2",
  Booster3 = "booster3",
  Booster4 = "booster4",
  Booster5 = "booster5",
  Booster6 = "booster6",
  Booster7 = "booster7",
  Booster8 = "booster8",
  Booster9 = "booster9",
  Booster10 = "booster10",
}

export namespace Booster {
  export function values(expansions = 0): Booster[] {
    return (Object.values(Booster) as Booster[]).filter((val: Booster) => {
      if (typeof val !== "string") {
        return;
      }
      if (/^booster[0-9]/.test(val)) {
        return true;
      }
    }) as Booster[];
  }
}

export enum TechTile {
  Tech1 = "tech1",
  Tech2 = "tech2",
  Tech3 = "tech3",
  Tech4 = "tech4",
  Tech5 = "tech5",
  Tech6 = "tech6",
  Tech7 = "tech7",
  Tech8 = "tech8",
  Tech9 = "tech9",
}

export namespace TechTile {
  export function values(expansions = 0): TechTile[] {
    return (Object.values(TechTile) as TechTile[]).filter((val: TechTile) => {
      if (typeof val !== "string") {
        return;
      }
      if (/^tech[0-9]/.test(val)) {
        return true;
      }
    }) as TechTile[];
  }
}

export enum TechPos {
  Terraforming = "tech-terra",
  Navigation = "tech-nav",
  Intelligence = "tech-int",
  GaiaProject = "tech-gaia",
  Economy = "tech-eco",
  Science = "tech-sci",
  Free1 = "tech-free1",
  Free2 = "tech-free2",
  Free3 = "tech-free3",
}

export namespace TechPos {
  export function values(expansions = 0): TechPos[] {
    const ret = [
      "tech-terra",
      "tech-nav",
      "tech-int",
      "tech-gaia",
      "tech-eco",
      "tech-sci",
      "tech-free1",
      "tech-free2",
      "tech-free3",
    ] as TechPos[];

    return ret;
  }
}

export enum TechTilePos {
  Terraforming = "terra",
  Navigation = "nav",
  Intelligence = "int",
  GaiaProject = "gaia",
  Economy = "eco",
  Science = "sci",
  Free1 = "free1",
  Free2 = "free2",
  Free3 = "free3",
}

export namespace TechTilePos {
  export function values(expansions = 0): TechTilePos[] {
    const ret = ["terra", "nav", "int", "gaia", "eco", "sci", "free1", "free2", "free3"] as TechTilePos[];

    return ret;
  }
}

export enum AdvTechTile {
  AdvTech1 = "advtech1",
  AdvTech2 = "advtech2",
  AdvTech3 = "advtech3",
  AdvTech4 = "advtech4",
  AdvTech5 = "advtech5",
  AdvTech6 = "advtech6",
  AdvTech7 = "advtech7",
  AdvTech8 = "advtech8",
  AdvTech9 = "advtech9",
  AdvTech10 = "advtech10",
  AdvTech11 = "advtech11",
  AdvTech12 = "advtech12",
  AdvTech13 = "advtech13",
  AdvTech14 = "advtech14",
  AdvTech15 = "advtech15",
}

export namespace AdvTechTile {
  export function values(expansions = 0): AdvTechTile[] {
    return (Object.values(AdvTechTile) as AdvTechTile[]).filter((val: AdvTechTile) => {
      if (typeof val !== "string") {
        return;
      }
      if (val.startsWith("advtech")) {
        return true;
      }
    }) as AdvTechTile[];
  }
}

export enum AdvTechTilePos {
  Terraforming = "adv-terra",
  Navigation = "adv-nav",
  Intelligence = "adv-int",
  GaiaProject = "adv-gaia",
  Economy = "adv-eco",
  Science = "adv-sci",
}

export namespace AdvTechTilePos {
  export function values(expansions = 0): AdvTechTilePos[] {
    const ret = ["adv-terra", "adv-nav", "adv-int", "adv-gaia", "adv-eco", "adv-sci"] as AdvTechTilePos[];

    return ret;
  }
}

export enum Federation {
  Fed1 = "fed1",
  Fed2 = "fed2",
  Fed3 = "fed3",
  Fed4 = "fed4",
  Fed5 = "fed5",
  Fed6 = "fed6",
  Gleens = "gleens",
}

export namespace Federation {
  export function values(expansions = 0) {
    return ["fed1", "fed2", "fed3", "fed4", "fed5", "fed6"] as Federation[];
  }
}

export enum BoardAction {
  Power1 = "power1",
  Power2 = "power2",
  Power3 = "power3",
  Power4 = "power4",
  Power5 = "power5",
  Power6 = "power6",
  Power7 = "power7",
  Qic1 = "qic1",
  Qic2 = "qic2",
  Qic3 = "qic3",
}

export namespace BoardAction {
  export function values(expansions = 0): BoardAction[] {
    return Object.values(BoardAction).filter((val: BoardAction) => {
      if (typeof val !== "string") {
        return;
      }
      if (/^qic[0-9]/.test(val) || /^power[0-9]/.test(val)) {
        return true;
      }
    }) as BoardAction[];
  }
}

export enum ScoringTile {
  Score1 = "score1",
  Score2 = "score2",
  Score3 = "score3",
  Score4 = "score4",
  Score5 = "score5",
  Score6 = "score6",
  Score7 = "score7",
  Score8 = "score8",
  Score9 = "score9",
  Score10 = "score10",
}

export namespace ScoringTile {
  export function values(expansions = 0): ScoringTile[] {
    return (Object.values(ScoringTile) as ScoringTile[]).filter((val: ScoringTile) => {
      if (typeof val !== "string") {
        return;
      }
      if (/^score[0-9]/.test(val)) {
        return true;
      }
    }) as ScoringTile[];
  }
}

export enum FinalTile {
  Structure = "structure",
  StructureFed = "structureFed",
  PlanetType = "planetType",
  Gaia = "gaia",
  Sector = "sector",
  Satellite = "satellite",
}

export namespace FinalTile {
  export function values(expansions = 0): FinalTile[] {
    const ret = [
      FinalTile.Structure,
      FinalTile.StructureFed,
      FinalTile.PlanetType,
      FinalTile.Gaia,
      FinalTile.Sector,
      FinalTile.Satellite,
    ];

    return ret;
  }
}

export enum PowerArea {
  Area1 = "area1",
  Area2 = "area2",
  Area3 = "area3",
  Gaia = "gaia",
}

export enum Phase {
  SetupInit = "setupInit",
  SetupBoard = "setupBoard",
  SetupFaction = "setupFaction",
  SetupAuction = "setupAuction",
  SetupBuilding = "setupBuilding",
  SetupBooster = "setupBooster",
  BeginGame = "beginGame",
  RoundStart = "roundStart",
  RoundIncome = "roundIncome",
  RoundGaia = "roundGaia",
  RoundMove = "roundMove",
  RoundLeech = "roundLeech",
  RoundFinish = "roundFinish",
  EndGame = "endGame",
}

export enum SubPhase {
  BeforeMove = "beforeMove",
  AfterMove = "afterMove",
  UpgradeResearch = "upgradeResearch",
  PlaceLostPlanet = "placeLostPlanet",
  ChooseTechTile = "chooseTechTile",
  CoverTechTile = "coverTechTile",
  ChooseFederationTile = "chooseFederationTile",
  RescoreFederationTile = "rescoreFederationTile",
  BrainStone = "brainStone",
  BuildMine = "buildMine",
  BuildMineOrGaiaFormer = "buildMineOrGaiaFormer",
  SpaceStation = "spaceStation",
  PISwap = "swap-PI",
  DowngradeLab = "down-lab",
  PickRewards = "pickRewards",
}

export type BoardActions = {
  [key in BoardAction]?: Player;
};

export enum AuctionVariant {
  /** Finish choosing all factions first, then start an auction phase */
  ChooseBid = "choose-bid",
  /** Bid on factions while not all factions are chosen */
  BidWhileChoosing = "bid-while-choosing",
}

export type FactionVariant = "standard" | "more-balanced"; // https://boardgamegeek.com/thread/2324994/article/36509533#36509533

export type FactionCustomization = {
  variant: FactionVariant;
  players: number;
};

export interface SectorInMapConfiguration {
  sector: string;
  rotation: number;
  center?: CubeCoordinates;
}

export interface MapConfiguration {
  sectors?: SectorInMapConfiguration[];
  // Are sector tiles mirrored?
  mirror?: boolean;
}

export interface EngineOptions {
  /** Allow last player to rotate sector BEFORE faction selection */
  advancedRules?: boolean;
  /** disable Federation check for available commands */
  noFedCheck?: boolean;
  /** Custom map given */
  map?: MapConfiguration;
  /** Are the federations flexible (allows you to avoid planets with buildings to form federation even if it's not the shortest route)? */
  flexibleFederations?: boolean;
  /** auction */
  auction?: AuctionVariant;
  /**  **/
  factionVariant?: FactionVariant;
  /** Layout */
  layout?: "standard" | "balanced" | "xshape";
  /* Force players to have random factions */
  randomFactions?: boolean;
}

export type EventSource =
  | Booster
  | TechPos
  | AdvTechTilePos
  | Command.ChargePower
  | Command.Spend
  | "final1"
  | "final2"
  | RoundScoring
  | ResearchField
  | BoardAction
  | Command.ChooseIncome
  | Phase.BeginGame
  | Command.Build
  | Command.ChooseFederationTile
  | Command.FormFederation
  | Command.UpgradeResearch
  | Faction
  | Command.Bid;

export enum FreeAction {
  PowerToQic,
  PowerToKnowledge,
  PowerToOre,
  PowerToCredit,
  QicToOre,
  OreToToken,
  KnowledgeToCredit,
  OreToCredit,

  //HadschHallas
  CreditToQic,
  CreditToOre,
  CreditToKnowledge,

  //Terrans
  GaiaTokenToQic,
  GaiaTokenToKnowledge,
  GaiaTokenToOre,
  GaiaTokenToCredit,

  //Itars
  GaiaTokenToTech,

  //Nevlas
  PowerToGaiaForKnowledge,
  PowerToOreAndCredit,
  PowerTo2Credit,
  PowerTo2Ore,

  //Baltaks
  GaiaFormerToQic,

  //Taklons
  PowerTo3Credit,
}


export type ResourceConversion = { cost: string; income: string };
export type ConversionTable = { [key in FreeAction]?: ResourceConversion };

export const freeActions: ConversionTable = {
  [FreeAction.PowerToQic]: { cost: "4pw", income: "1q" },
  [FreeAction.PowerToOre]: { cost: "3pw", income: "1o" },
  [FreeAction.QicToOre]: { cost: "1q", income: "1o" },
  [FreeAction.PowerToKnowledge]: { cost: "4pw", income: "1k" },
  [FreeAction.PowerToCredit]: { cost: "1pw", income: "1c" },
  [FreeAction.KnowledgeToCredit]: { cost: "1k", income: "1c" },
  [FreeAction.OreToCredit]: { cost: "1o", income: "1c" },
  [FreeAction.OreToToken]: { cost: "1o", income: "1t" },
};

export const freeActionsHadschHallas: ConversionTable = {
  [FreeAction.CreditToQic]: { cost: "4c", income: "1q" },
  [FreeAction.CreditToOre]: { cost: "3c", income: "1o" },
  [FreeAction.CreditToKnowledge]: { cost: "4c", income: "1k" },
};

export const freeActionsTerrans: ConversionTable = {
  [FreeAction.GaiaTokenToQic]: { cost: "4tg", income: "1q" },
  [FreeAction.GaiaTokenToOre]: { cost: "3tg", income: "1o" },
  [FreeAction.GaiaTokenToKnowledge]: { cost: "4tg", income: "1k" },
  [FreeAction.GaiaTokenToCredit]: { cost: "1tg", income: "1c" },
};

export const freeActionsItars: ConversionTable = { [FreeAction.GaiaTokenToTech]: { cost: "4tg", income: "tech" } };

export const freeActionsNevlas: ConversionTable = {
  [FreeAction.PowerToGaiaForKnowledge]: { cost: "1t-a3", income: "1k" },
};

export const freeActionsNevlasPI: ConversionTable = {
  [FreeAction.PowerTo2Credit]: { cost: "2pw", income: "2c" }, // this is for convenience
  [FreeAction.PowerToOreAndCredit]: { cost: "4pw", income: "1o,1c" },
  [FreeAction.PowerTo2Ore]: { cost: "6pw", income: "2o" },
};

export const freeActionsBaltaks: ConversionTable = { [FreeAction.GaiaFormerToQic]: { cost: "1gf", income: "1q" } };

// this is for convenience
export const freeActionsTaklons: ConversionTable = { [FreeAction.PowerTo3Credit]: { cost: "3pw", income: "3c" } };
