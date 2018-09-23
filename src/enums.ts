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
  Lost = "l"
}

export enum ResearchField {
  Terraforming = "terra",
  Navigation = "nav",
  Intelligence = "int",
  GaiaProject = "gaia",
  Economy = "eco",
  Science = "sci"
}

export enum Resource {
  None = "~",
  Ore = "o",
  Credit = "c",
  Knowledge = "k",
  Qic = "q",
  ChargePower = "pw",
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
  PISwap = "swap-PI"
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
  Special = "PA->4pw"
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

  // trigger only
  MineOnGaia = "mg",
  AdvanceResearch = "a",
  TerraformStep = "step",
  GaiaFormer = "gf"
}

export namespace Condition {
  export function matchesBuilding(condition: Condition, building: Building, planet: Planet): boolean {
    if (condition as string === building as string) {
      return true;
    }
    switch (condition) {
      case Condition.MineOnGaia: return building === Building.Mine && planet === Planet.Gaia;
      case Condition.PlanetaryInstituteOrAcademy: return building === Building.PlanetaryInstitute || building === Building.Academy1 || building === Building.Academy2;
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
  SpaceStation = "sp"
}

export enum Faction {
  Terrans = "terrans",
  Lantids = "lantids",
  Xenos = "xenos",
  Gleens = "gleens",
  Taklons = "taklons",
  Ambas = "ambas",
  HadschHallas = "hadsch-hallas",
  Ivits = "ivits",
  Geodens = "geodens",
  BalTaks = "baltaks",
  Firaks = "firaks",
  Bescods = "bescods",
  Nevlas = "nevlas",
  Itars = "itars"
}

export enum Command {
  Init = "init",
  RotateSectors = "rotate",
  ChooseFaction = "faction",
  ChooseRoundBooster = "booster",
  ChooseTechTile = "tech",
  ChooseCoverTechTile = "cover",
  ChooseFederationTile = "fedtile",
  ChooseIncome = "income",
  Build = "build",
  Pass = "pass",
  UpgradeResearch = "up",
  ChargePower = "charge",
  Decline = "decline",
  BurnPower = "burn",
  Spend = "spend",
  BrainStone = "brainstone",
  Action = "action",
  Special = "special",
  PlaceLostPlanet  = "lostPlanet",
  FormFederation = "federation",
  EndTurn = "endturn",
  PISwap = "swap-PI"
}

export enum Player {
  Player1,
  Player2,
  Player3,
  Player4,
  Player5
}

export enum Round {
  None= 0,
  Round1= 1,
  Round2= 2,
  Round3= 3,
  Round4= 4,
  Round5= 5,
  Round6= 6,
  LastRound = 6
}

export enum Booster {
  Booster1= "booster1",
  Booster2= "booster2",
  Booster3= "booster3",
  Booster4= "booster4",
  Booster5= "booster5",
  Booster6= "booster6",
  Booster7= "booster7",
  Booster8= "booster8",
  Booster9= "booster9",
  Booster10= "booster10"
}

export enum TechTile {
  Tech1= "tech1",
  Tech2= "tech2",
  Tech3= "tech3",
  Tech4= "tech4",
  Tech5= "tech5",
  Tech6= "tech6",
  Tech7= "tech7",
  Tech8= "tech8",
  Tech9= "tech9"
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
  Free3 = "free3"
}

export enum AdvTechTile {
  AdvTech1= "advtech1",
  AdvTech2= "advtech2",
  AdvTech3= "advtech3",
  AdvTech4= "advtech4",
  AdvTech5= "advtech5",
  AdvTech6= "advtech6",
  AdvTech7= "advtech7",
  AdvTech8= "advtech8",
  AdvTech9= "advtech9",
  AdvTech10= "advtech10",
  AdvTech11= "advtech11",
  AdvTech12= "advtech12",
  AdvTech13= "advtech13",
  AdvTech14= "advtech14",
  AdvTech15= "advtech15"
}

export enum AdvTechTilePos {
  Terraforming = "adv-terra",
  Navigation = "adv-nav",
  Intelligence = "adv-int",
  GaiaProject = "adv-gaia",
  Economy = "adv-eco",
  Science = "adv-sci"
}

export enum Federation {
  Federation1 = "fed1",
  Federation2 = "fed2",
  Federation3 = "fed3",
  Federation4 = "fed4",
  Federation5 = "fed5",
  Federation6 = "fed6",
  FederationGleens = "gleens"
}

export enum BoardAction {
  Power1= "power1",
  Power2= "power2",
  Power3= "power3",
  Power4= "power4",
  Power5= "power5",
  Power6= "power6",
  Power7= "power7",
  Qic1 = "qic1",
  Qic2 = "qic2",
  Qic3 = "qic3",
}

export enum ScoringTile {
  Score1= "score1",
  Score2= "score2",
  Score3= "score3",
  Score4= "score4",
  Score5= "score5",
  Score6= "score6",
  Score7= "score7",
  Score8= "score8",
  Score9= "score9",
  Score10= "score10"
}

export enum FinalTile {
  Structure= "structure",
  StructureFed= "structureFed",
  PlanetType= "planetType",
  Gaia= "gaia",
  Sector= "sector",
  Satellite= "satellite"
}

export enum BrainstoneArea {
  Area1 = "area1",
  Area2 = "area2",
  Area3 = "area3",
  Gaia = "gaia"
}

export enum Phase {
  SetupInit = "setupInit",
  SetupBoard = "setupBoard",
  SetupFaction = "setupFaction",
  SetupBuilding = "setupBuilding",
  SetupBooster = "setupBooster",
  BeginGame = "beginGame",
  RoundStart = "roundStart",
  RoundIncome = "roundIncome",
  RoundGaia = "roundGaia",
  RoundMove = "roundMove",
  RoundLeech = "roundLeech",
  RoundFinish = "roundFinish",
  EndGame = "endGame"
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
  DowngradeLab = "down-lab"
}