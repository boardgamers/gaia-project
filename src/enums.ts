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
  Science = "sci",
  TradingBonus = "trade",
  TradingVolume = "ship",
}

export enum Expansion {
  Spaceships = 1,
  All = 1
}

export namespace ResearchField {
  export function values(expansions: number = 0): ResearchField[] {
    const ret = [ResearchField.Terraforming, ResearchField.Navigation, ResearchField.Intelligence, ResearchField.GaiaProject, ResearchField.Economy, ResearchField.Science];

    if (expansions & Expansion.Spaceships) {
      ret.push(ResearchField.TradingBonus, ResearchField.TradingVolume);
    }

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
  GainToken = "t",
  GainTokenGaiaArea = "tg",
  MoveTokenToGaiaArea = "t->tg",
  VictoryPoint = "vp",
  TerraformCostDiscount = "d",
  Range = "r",
  GaiaFormer = "gf",
  SpaceStation = "space-station",
  SpaceShip = "ship",
  MoveShips = "move",
  MoveAllShips = "move-all",
  SpaceShipRange = "ship-range",
  SpaceShipMove = "ship-move",
  DowngradeLab = "down-lab",
  UpgradeTerraforming = "up-terra",
  UpgradeNavigation = "up-nav",
  UpgradeIntelligence = "up-int",
  UpgradeGaiaProject = "up-gaia",
  UpgradeEconomy = "up-eco",
  UpgradeScience = "up-sci",
  UpgradeLowest = "up-lowest",
  UpgradeTradingBonus = "up-trade",
  UpgradeTradingVolume = "up-ship",
  UpgradeBasic = "up-0",
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
  Trade = "trade",

  // count only
  Gaia = "g",
  PlanetType = "pt",
  Sector = "s",
  Structure = "st",
  StructureFed = "stfed",
  Satellite = "sat",
  StructureValue = "stvalue",
  StructureFedValue = "stfedvalue",
  Culture = "culture",
  ResearchLevels = "a",
  HighestResearchLevel = "L",
  PlanetsWithTradeToken = "import",

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
  PlaceShip = "ship",
  MoveShip = "move",
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
  Ship1 = "booster-ship1",
  Ship2 = "booster-ship2",
  Ship3 = "booster-ship3"
}

export namespace Booster {
  export function values(expansions: number = 0): Booster[] {
    return Object.values(Booster).filter((val: Booster) => {
      if (typeof val !== "string") {return; }
      if (/^booster[0-9]/.test(val)) {
        return true;
      }
      if (expansions & Expansion.Spaceships && val.startsWith('booster-ship')) {
        return true;
      }
    });
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
  /** This techtile is one every player starts with. Not included in the shuffles */
  Ship0 = "tech-ship0",
  Ship1 = "tech-ship1",
  Ship2 = "tech-ship2",
  Ship3 = "tech-ship3"
}

export namespace TechTile {
  export function values(expansions: number = 0): TechTile[] {
    return Object.values(TechTile).filter((val: TechTile) => {
      if (typeof val !== "string") {return; }
      if (/^tech[0-9]/.test(val)) {
        return true;
      }
      if (expansions & Expansion.Spaceships && val.startsWith('tech-ship') && val !== TechTile.Ship0) {
        return true;
      }
    });
  }
}

export enum TechTilePos {
  Terraforming = "terra",
  Navigation = "nav",
  Intelligence = "int",
  GaiaProject = "gaia",
  Economy = "eco",
  Science = "sci",
  TradingBonus = "trade",
  TradingVolume = "ship",
  Free1 = "free1",
  Free2 = "free2",
  Free3 = "free3",
  Free4 = "free4",
  BasicShip = "move"
}

export namespace TechTilePos {
  export function values(expansions: number = 0): TechTilePos[] {
    const ret = ["terra", "nav", "int", "gaia", "eco", "sci", "free1", "free2", "free3"] as TechTilePos[];

    if (expansions & Expansion.Spaceships) {
      ret.push(TechTilePos.TradingBonus, TechTilePos.TradingVolume, TechTilePos.Free4);
    }

    return ret;
  }
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
  AdvTech15= "advtech15",
  Ship1 = "advship1",
  Ship2 = "advship2",
  Ship3 = "advship3",
  Ship4 = "advship4",
  Ship5 = "advship5",
  Ship6 = "advship6"
}

export namespace AdvTechTile {
  export function values(expansions: number = 0): AdvTechTile[] {
    return Object.values(AdvTechTile).filter((val: AdvTechTile) => {
      if (typeof val !== "string") {return; }
      if (val.startsWith('advtech')) {
        return true;
      }
      if (expansions & Expansion.Spaceships && val.startsWith('advship')) {
        return true;
      }
    });
  }
}

export enum AdvTechTilePos {
  Terraforming = "adv-terra",
  Navigation = "adv-nav",
  Intelligence = "adv-int",
  GaiaProject = "adv-gaia",
  Economy = "adv-eco",
  Science = "adv-sci",
  TradingBonus = "adv-trade",
  TradingVolume = "adv-ship"
}

export namespace AdvTechTilePos {
  export function values(expansions: number = 0): AdvTechTilePos[] {
    const ret = ["adv-terra", "adv-nav", "adv-int", "adv-gaia", "adv-eco", "adv-sci"] as AdvTechTilePos[];

    if (expansions & Expansion.Spaceships) {
      ret.push(AdvTechTilePos.TradingBonus, AdvTechTilePos.TradingVolume);
    }

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
  Ship = "ship"
}

export namespace Federation {
  export function values(expansions = 0) {
    return ["fed1", "fed2", "fed3", "fed4", "fed5", "fed6"] as Federation[];
  }
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
  ShipPower1 = "power-ship1",
  ShipPower2 = "power-ship2",
  ShipPower3 = "power-ship3",
  ShipQic1 = "qic-ship1"
}

export namespace BoardAction {
  export function values(expansions= 0) {
    return Object.values(BoardAction).filter((val: BoardAction) => {
      if (typeof val !== "string") {return; }
      if (/^qic[0-9]/.test(val) || /^power[0-9]/.test(val)) {
        return true;
      }

      if (expansions & Expansion.Spaceships && val.includes("ship")) {
        return true;
      }
    });
  }
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
  Score10= "score10",
  Ship1 = "score-ship1",
  Ship2 = "score-ship2"
}

export namespace ScoringTile {
  export function values(expansions: number = 0): ScoringTile[] {
    return Object.values(ScoringTile).filter((val: ScoringTile) => {
      if (typeof val !== "string") {return; }
      if (/^score[0-9]/.test(val)) {
        return true;
      }
      if (expansions & Expansion.Spaceships && val.startsWith('score-ship')) {
        return true;
      }
    });
  }
}

export enum FinalTile {
  Structure= "structure",
  StructureFed= "structureFed",
  PlanetType= "planetType",
  Gaia= "gaia",
  Sector= "sector",
  Satellite= "satellite",
  TradeTokens = "trade",
  Culture = "culture"
}

export namespace FinalTile {
  export function values(expansions: number = 0): FinalTile[] {
    const ret = [FinalTile.Structure, FinalTile.StructureFed, FinalTile.PlanetType, FinalTile.Gaia, FinalTile.Sector, FinalTile.Satellite];

    if (expansions & Expansion.Spaceships) {
      ret.push(FinalTile.TradeTokens, FinalTile.Culture);
    }

    return ret;
  }
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
  SetupShip = "setupShip",
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
  PlaceShip = "placeShip",
  MoveShip = "moveShip",
  DeliverTrade = "deliver",
  PISwap = "swap-PI",
  DowngradeLab = "down-lab"
}
