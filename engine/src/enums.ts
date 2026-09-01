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
  Protoplanet = "p",
  Asteroid = "a",
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
  // 1 was the old spaceships expansion
  None = 0,
  LostFleet = 4,
  // "all content" sentinel for `.values()` enumeration only - never a valid game-config selection
  All = LostFleet,
}

export function hasExpansion(expansions: Expansion, expansion: Expansion): boolean {
  return (expansions & expansion) !== 0;
}

export namespace Planet {
  export function values(expansions: Expansion): Planet[] {
    const ret = [
      Planet.Empty,
      Planet.Terra,
      Planet.Desert,
      Planet.Swamp,
      Planet.Oxide,
      Planet.Volcanic,
      Planet.Titanium,
      Planet.Ice,
      Planet.Gaia,
      Planet.Transdim,
      Planet.Lost,
    ];

    if (hasExpansion(expansions, Expansion.LostFleet)) {
      ret.push(Planet.Protoplanet, Planet.Asteroid);
    }

    return ret;
  }
}

export namespace ResearchField {
  export function values(expansions: Expansion): ResearchField[] {
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
  /** Lost Fleet: gain a power token directly into Area III (Xenos's free action). */
  GainTokenArea3 = "ta3",
  Brainstone = "brainstone",
  GainTokenGaiaArea = "tg",
  MoveTokenToGaiaArea = "t->tg",
  MoveTokenFromGaiaAreaToArea1 = "tg->t",
  VictoryPoint = "vp",
  TerraformCostDiscount = "d",
  Range = "r",
  GaiaFormer = "gf",
  MoveGaiaFormerFromGaiaAreaToArea1 = "gf->t",
  InstantGaiaforming = "instant-gaiaforming",
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
  GainArtifact = "artifact",
  TemporaryStep = "step",
  TemporaryRange = "range",
  MoveTokenFromArea3ToGaia = "t-a3",
  PISwap = "swap-PI",
  Turn = "turn",
  PowerRing = "power-ring",
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
  FourPowerBuildings = "PA->4pw",
}

export enum Condition {
  None = "~",

  // common
  Mine = "m",
  TradingStation = "ts",
  ResearchLab = "lab",
  BigBuilding = "PA",
  Federation = "fed",

  // count only
  Gaia = "g",
  PlanetType = "pt",
  TechTile = "tt",
  Sector = "s",
  Structure = "st",
  StructureFed = "stfed",
  Satellite = "sat",
  StructureValue = "stvalue",
  StructureFedValue = "stfedvalue",
  ResearchLevels = "a",
  HighestResearchLevel = "L",
  // Lost Fleet
  Asteroid = "ast",
  DeepSpaceSector = "ds",
  PlanetaryInstituteAcademyDistance = "pi-ac-dist",

  // trigger only
  MineOnGaia = "mg",
  AdvanceResearch = "a",
  TerraformStep = "step",
  GaiaFormer = "gf",
  // Lost Fleet
  SpaceshipQicAction = "shipq",
  /** A mine built in a Space/Deep Space sector not colonized by this player before (§G4 "sector3"). */
  NewSector = "newsector",
  /** A mine built on a planet type not colonized by this player before (§G4 "planet3"). */
  NewPlanetType = "newplanet",
}

export namespace Condition {
  export function matchesBuilding(condition: Condition, building: Building, planet: Planet): boolean {
    if ((condition as string) === (building as string)) {
      return true;
    }
    switch (condition) {
      case Condition.MineOnGaia:
        return building === Building.Mine && planet === Planet.Gaia;
      case Condition.BigBuilding:
        return building === Building.PlanetaryInstitute || isAcademy(building);
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

export namespace Building {
  export function values(_expansion: Expansion): Building[] {
    return (Object.values(Building) as Building[]).filter((b: Building) => typeof b === "string");
  }
}

export function isAcademy(b: Building) {
  return b === Building.Academy1 || b === Building.Academy2;
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
  Tinkeroids = "tinkeroids",
  Darkanians = "darkanians",
  Moweyds = "moweyds",
  SpaceGiants = "space-giants",
}

export namespace Faction {
  export function values(expansions: Expansion): Faction[] {
    const ret = [
      Faction.Terrans,
      Faction.Lantids,
      Faction.HadschHallas,
      Faction.Ivits,
      Faction.Geodens,
      Faction.BalTaks,
      Faction.Xenos,
      Faction.Gleens,
      Faction.Taklons,
      Faction.Ambas,
      Faction.Firaks,
      Faction.Bescods,
      Faction.Nevlas,
      Faction.Itars,
    ];

    if (hasExpansion(expansions, Expansion.LostFleet)) {
      ret.push(Faction.Tinkeroids, Faction.Darkanians, Faction.Moweyds, Faction.SpaceGiants);
    }

    return ret;
  }
}

export enum Command {
  Action = "action",
  BanFaction = "banFaction",
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
  Explore = "explore",
  FormFederation = "federation",
  GaiaFormTransdim = "gaiaFormTransdim",
  Init = "init",
  PISwap = "swap-PI",
  Pass = "pass",
  PlaceLostPlanet = "lostPlanet",
  PreferenceBid = "preferenceBid",
  RotateSectors = "rotate",
  Special = "special",
  Setup = "set",
  SilentBid = "silentBid",
  Spend = "spend",
  SpaceshipAction = "spaceshipAction",
  ExamineArtifact = "examineArtifact",
  ChooseArtifactToken = "chooseArtifactToken",
  ChooseTinkeringTile = "chooseTinkeringTile",
  UpgradeResearch = "up",
  PlacePowerRing = "placePowerRing",
}

export enum Player {
  Player1,
  Player2,
  Player3,
  Player4,
  Player5,
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
  export function values(): RoundScoring[] {
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
  LostFleetFormer = "booster-lostfleet-former",
  LostFleetPlanet = "booster-lostfleet-planet",
  LostFleetDeep = "booster-lostfleet-deep",
  LostFleetInstant = "booster-lostfleet-instant",
}

export namespace Booster {
  export function values(expansions: Expansion = Expansion.None): Booster[] {
    const ret = [
      Booster.Booster1,
      Booster.Booster2,
      Booster.Booster3,
      Booster.Booster4,
      Booster.Booster5,
      Booster.Booster6,
      Booster.Booster7,
      Booster.Booster8,
      Booster.Booster9,
      Booster.Booster10,
    ];

    if (hasExpansion(expansions, Expansion.LostFleet)) {
      ret.push(Booster.LostFleetFormer, Booster.LostFleetPlanet, Booster.LostFleetDeep, Booster.LostFleetInstant);
    }

    return ret;
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
  export function values(_expansions: Expansion): TechTile[] {
    return (Object.values(TechTile) as TechTile[]).filter((val: TechTile) => typeof val === "string") as TechTile[];
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
  export function values(expansions: Expansion): TechPos[] {
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
  export function values(expansions: Expansion): TechTilePos[] {
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

  // Lost Fleet, see RULES_CLARIFICATIONS.md §G2
  AsteroidPass = "advtech-asteroidpass",
  Big = "advtech-big",
  Deep = "advtech-deep",
  DeepPass = "advtech-deeppass",
  QAction = "advtech-qaction",
  Terra = "advtech-terra",
}

export namespace AdvTechTile {
  export function values(expansions: Expansion): AdvTechTile[] {
    const ret = [
      AdvTechTile.AdvTech1,
      AdvTechTile.AdvTech2,
      AdvTechTile.AdvTech3,
      AdvTechTile.AdvTech4,
      AdvTechTile.AdvTech5,
      AdvTechTile.AdvTech6,
      AdvTechTile.AdvTech7,
      AdvTechTile.AdvTech8,
      AdvTechTile.AdvTech9,
      AdvTechTile.AdvTech10,
      AdvTechTile.AdvTech11,
      AdvTechTile.AdvTech12,
      AdvTechTile.AdvTech13,
      AdvTechTile.AdvTech14,
      AdvTechTile.AdvTech15,
    ];

    if (hasExpansion(expansions, Expansion.LostFleet)) {
      ret.push(
        AdvTechTile.AsteroidPass,
        AdvTechTile.Big,
        AdvTechTile.Deep,
        AdvTechTile.DeepPass,
        AdvTechTile.QAction,
        AdvTechTile.Terra
      );
    }

    return ret;
  }
}

export enum AdvTechTilePos {
  Terraforming = "adv-terra",
  Navigation = "adv-nav",
  Intelligence = "adv-int",
  GaiaProject = "adv-gaia",
  Economy = "adv-eco",
  Science = "adv-sci",
  // Lost Fleet's Scoring Board Extension: a 7th Advanced Tech slot not tied to any research field.
  ScoringExtension = "adv-ext",
}

export namespace AdvTechTilePos {
  export function values(expansions: Expansion): AdvTechTilePos[] {
    const ret = ["adv-terra", "adv-nav", "adv-int", "adv-gaia", "adv-eco", "adv-sci"] as AdvTechTilePos[];

    if (hasExpansion(expansions, Expansion.LostFleet)) {
      ret.push(AdvTechTilePos.ScoringExtension);
    }

    return ret;
  }
}

// The face-up side of Lost Fleet's Scoring Board Extension, decided once per game at setup. It
// replaces the usual "research level 4/5" condition for the one Advanced Tech tile placed on it.
export enum ScoringBoardExtensionSide {
  VictoryPoints = "vp",
  ExploredShips = "ships",
}

// The face-up side of Lost Fleet's Economy research track overlay tile (covers levels 3/4 income),
// decided once per game at setup (§F1).
export enum LostFleetEconomySide {
  Power = "pw",
  VictoryPoints = "vp",
}

export type AnyTechTilePos = TechTilePos | AdvTechTilePos;
export type AnyTechTile = TechTile | AdvTechTile;

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
  export function values(expansions: Expansion) {
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
  // Lost Fleet replaces the research-board Q.I.C. actions with the spaceship boards' own
  // Q.I.C. actions (RULES_CLARIFICATIONS.md §E4/§K3) — Qic1-3 are not available in those games.
  export function values(expansions: Expansion = Expansion.None): BoardAction[] {
    const ret = Object.values(BoardAction).filter(
      (val: BoardAction) => typeof val === "string" && /^power[0-9]/.test(val)
    ) as BoardAction[];

    if (!hasExpansion(expansions, Expansion.LostFleet)) {
      ret.push(BoardAction.Qic1, BoardAction.Qic2, BoardAction.Qic3);
    }

    return ret;
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
  // Lost Fleet (RULES_CLARIFICATIONS.md §G4): "lab4"/"sector3"/"planet3"
  LfLab4 = "lflab4",
  LfSector3 = "lfsector3",
  LfPlanet3 = "lfplanet3",
}

export namespace ScoringTile {
  export function values(expansions = 0): ScoringTile[] {
    const base = (Object.values(ScoringTile) as ScoringTile[]).filter((val: ScoringTile) => {
      if (typeof val !== "string") {
        return;
      }
      if (/^score[0-9]/.test(val)) {
        return true;
      }
    }) as ScoringTile[];

    if (hasExpansion(expansions, Expansion.LostFleet)) {
      base.push(ScoringTile.LfLab4, ScoringTile.LfSector3, ScoringTile.LfPlanet3);
    }

    return base;
  }
}

export enum FinalTile {
  Structure = "structure",
  StructureFed = "structureFed",
  PlanetType = "planetType",
  Gaia = "gaia",
  Sector = "sector",
  Satellite = "satellite",
  Asteroid = "asteroid",
  PlanetaryInstituteAcademyDistance = "piAcademyDistance",
  DeepSpaceSector = "deepSpaceSector",
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

    if (hasExpansion(expansions, Expansion.LostFleet)) {
      ret.push(FinalTile.Asteroid, FinalTile.PlanetaryInstituteAcademyDistance, FinalTile.DeepSpaceSector);
    }

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
  SetupFactionBan = "setupFactionBan",
  SetupFaction = "setupFaction",
  SetupAuction = "setupAuction",
  SetupSilentBid = "setupSilentBid",
  SetupPreferenceBid = "setupPreferenceBid",
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
  InstantGaiaforming = "instantGaiaforming",
  SpaceshipBuildMine = "spaceshipBuildMine",
  SpaceshipUpgradeBuilding = "spaceshipUpgradeBuilding",
  FederationTokenBuildMine = "federationTokenBuildMine",
  SpaceshipTechTileBuildMine = "spaceshipTechTileBuildMine",
  ChooseArtifactToken = "chooseArtifactToken",
  PlacePowerRing = "placePowerRing",
}

export enum TinkeringTile {
  Step1 = "tinkering-step1",
  Power4 = "tinkering-power4",
  Qic1 = "tinkering-qic1",
  Step3 = "tinkering-step3",
  Knowledge3 = "tinkering-knowledge3",
  Qic2 = "tinkering-qic2",
}

export namespace TinkeringTile {
  export function values(): TinkeringTile[] {
    return [
      TinkeringTile.Step1,
      TinkeringTile.Power4,
      TinkeringTile.Qic1,
      TinkeringTile.Step3,
      TinkeringTile.Knowledge3,
      TinkeringTile.Qic2,
    ];
  }
}

// Lost Fleet Spaceship Boards (4 generic boards, not tied to any faction).
export enum Spaceship {
  Twilight = "twilight",
  Rebellion = "rebellion",
  TFMars = "tfmars",
  Eclipse = "eclipse",
}

export namespace Spaceship {
  export function values(expansions: Expansion): Spaceship[] {
    if (!hasExpansion(expansions, Expansion.LostFleet)) {
      return [];
    }
    return [Spaceship.Twilight, Spaceship.Rebellion, Spaceship.TFMars, Spaceship.Eclipse];
  }
}

// The 3 new Standard Tech tiles seeded onto Rebellion/T F Mars/Eclipse's single tech slot at setup.
export enum SpaceshipTechTile {
  Range = "ship-tech-range",
  Terraform = "ship-tech-terraform",
  Resource = "ship-tech-resource",
}

export namespace SpaceshipTechTile {
  export function values(expansions: Expansion): SpaceshipTechTile[] {
    if (!hasExpansion(expansions, Expansion.LostFleet)) {
      return [];
    }
    return [SpaceshipTechTile.Range, SpaceshipTechTile.Terraform, SpaceshipTechTile.Resource];
  }
}

// The 8 new Federation tokens distributed at random across the spaceships in play at setup.
export enum SpaceshipFederation {
  Credit = "ship-fed-credit",
  Knowledge = "ship-fed-knowledge",
  OreQic = "ship-fed-orequic",
  PowerTokens = "ship-fed-power",
  Range = "ship-fed-range",
  Tech = "ship-fed-tech",
  Terraform = "ship-fed-terraform",
  Vp = "ship-fed-vp",
}

export namespace SpaceshipFederation {
  export function values(expansions: Expansion): SpaceshipFederation[] {
    if (!hasExpansion(expansions, Expansion.LostFleet)) {
      return [];
    }
    return [
      SpaceshipFederation.Credit,
      SpaceshipFederation.Knowledge,
      SpaceshipFederation.OreQic,
      SpaceshipFederation.PowerTokens,
      SpaceshipFederation.Range,
      SpaceshipFederation.Tech,
      SpaceshipFederation.Terraform,
      SpaceshipFederation.Vp,
    ];
  }
}

// The 13 Artifact tokens seeded onto Twilight's artifact slots at setup (one slot per player); see
// RULES_CLARIFICATIONS.md §G6.
export enum ArtifactToken {
  KnowledgeOre = "artifact-knowledgeore",
  Credit = "artifact-credit",
  KnowledgeQic = "artifact-knowledgeqic",
  CreditLarge = "artifact-creditlarge",
  Power = "artifact-power",
  Asteroid = "artifact-asteroid",
  Protoplanet = "artifact-protoplanet",
  ResearchLevel = "artifact-researchlevel",
  ResearchTracks = "artifact-researchtracks",
  Federation = "artifact-federation",
  GaiaProject = "artifact-gaiaproject",
  PlanetTypes = "artifact-planettypes",
  DeepSpace = "artifact-deepspace",
}

export namespace ArtifactToken {
  export function values(expansions: Expansion): ArtifactToken[] {
    if (!hasExpansion(expansions, Expansion.LostFleet)) {
      return [];
    }
    return [
      ArtifactToken.KnowledgeOre,
      ArtifactToken.Credit,
      ArtifactToken.KnowledgeQic,
      ArtifactToken.CreditLarge,
      ArtifactToken.Power,
      ArtifactToken.Asteroid,
      ArtifactToken.Protoplanet,
      ArtifactToken.ResearchLevel,
      ArtifactToken.ResearchTracks,
      ArtifactToken.Federation,
      ArtifactToken.GaiaProject,
      ArtifactToken.PlanetTypes,
      ArtifactToken.DeepSpace,
    ];
  }
}
