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
  Transdim = "m"
}

export enum Resource {
  None = "~",
  Ore = "o",
  Credit = "c",
  Knowledge = "k",
  Qic = "q",
  ChargePower = "pw",
  GainToken = "t",
  VictoryPoint = "vp",
  TerraformStep = "d",
  RangeExtension = "r"
}

export enum Operator {
  Once = ">",
  Income = "+",
  Trigger = ">>",
  Activate = "=>",
  Pass = "|",
  Special = "S" // reserved op for PI and AC becoming 4pw structures
}

export enum Condition {
  None = "~",

  // common
  Mine = "m",
  TradingStation = "ts",
  ResearchLab = "lab",
  PIorAc = "piac",
  Federation = "fed",
  
  // count only
  Gaia = "g",
  PlanetType = "pt",
  Sector = "s",

  // trigger only
  MineOnGaia = "mg",
  AdvanceTech = "a",
  TerraformStep = "d"
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
