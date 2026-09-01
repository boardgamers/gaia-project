import Engine, { Booster, Command, ResearchField, Spaceship } from "@gaia-project/engine";
import { factionName } from "../data/factions";
import type { FederationChoice } from "../data/federations";
import { federationChoiceDescription } from "../data/federations";
import { techTileData } from "../data/tech-tiles";
import type { CommandObject } from "./recent";
import { parseCommands } from "./recent";

const OUT_OF_TURN = new Set<string>([Command.ChargePower, Command.BrainStone, Command.ChooseIncome, Command.Decline]);

const NOISE_COMMANDS = new Set<string>([
  ...Array.from(OUT_OF_TURN),
  Command.BurnPower,
  Command.Spend,
  Command.EndTurn,
  Command.DeadEnd,
]);

const BUILDING_LABELS: Record<string, string> = {
  m: "m",
  ts: "ts",
  t: "ts",
  lab: "rl",
  l: "rl",
  PI: "PI",
  i: "PI",
  ac1: "ac1",
  k: "ac1",
  ac2: "ac2",
  q: "ac2",
  gf: "GF",
  g: "GF",
  sp: "SS",
  spaceStation: "SS",
};

const TRACK_LABELS: Record<string, string> = {
  [ResearchField.Terraforming]: "terra",
  [ResearchField.Navigation]: "nav",
  [ResearchField.Intelligence]: "int",
  [ResearchField.GaiaProject]: "Gaia",
  [ResearchField.Economy]: "eco",
  [ResearchField.Science]: "sci",
  [ResearchField.Diplomacy]: "dip",
};

const SHIP_LABELS: Record<string, string> = {
  [Spaceship.Twilight]: "Twilight",
  [Spaceship.Rebellion]: "Rebellion",
  [Spaceship.TFMars]: "TFM",
  [Spaceship.Eclipse]: "Eclipse",
};

const BOOSTER_LABELS: Record<string, string> = {
  [Booster.Booster1]: "1k/1o",
  [Booster.Booster2]: "1o/2t",
  [Booster.Booster3]: "1q/2c",
  [Booster.Booster4]: "2c/1 step",
  [Booster.Booster5]: "2pw/+3 range",
  [Booster.Booster6]: "1o/1vp/m",
  [Booster.Booster7]: "1o/2vp/ts",
  [Booster.Booster8]: "1k/3vp/rl",
  [Booster.Booster9]: "4pw/4vp/PI-ac",
  [Booster.Booster10]: "4c/1vp/Gaia",
  [Booster.LostFleetFormer]: "1o/3vp/GF",
  [Booster.LostFleetPlanet]: "1o/1vp/planet",
  [Booster.LostFleetDeep]: "3c/2vp/DS",
  [Booster.LostFleetInstant]: "2pw/instant Gaia",
};

const BOOSTER_CODES: Record<string, string> = {
  [Booster.Booster1]: "B1",
  [Booster.Booster2]: "B2",
  [Booster.Booster3]: "B3",
  [Booster.Booster4]: "B4",
  [Booster.Booster5]: "B5",
  [Booster.Booster6]: "B6",
  [Booster.Booster7]: "B7",
  [Booster.Booster8]: "B8",
  [Booster.Booster9]: "B9",
  [Booster.Booster10]: "B10",
  [Booster.LostFleetFormer]: "B-GF",
  [Booster.LostFleetPlanet]: "B-planet",
  [Booster.LostFleetDeep]: "B-DS",
  [Booster.LostFleetInstant]: "B-Gaia",
};

const BOARD_ACTION_LABELS: Record<string, string> = {
  power1: "PA1 +3k",
  power2: "PA2 +2 steps",
  power3: "PA3 +2o",
  power4: "PA4 +7c",
  power5: "PA5 +2k",
  power6: "PA6 step",
  power7: "PA7 +2t",
  qic1: "QA1 tech",
  qic2: "QA2 re-fed",
  qic3: "QA3 vp/planet",
};

const CONSEQUENTIAL_COMMANDS = new Set<string>([
  Command.Build,
  Command.UpgradeResearch,
  Command.Explore,
  Command.FormFederation,
  Command.GaiaFormTransdim,
  Command.PlaceLostPlanet,
]);

const RAW_SUMMARY_COMMANDS = new Set<string>([
  ...Array.from(CONSEQUENTIAL_COMMANDS),
  Command.Action,
  Command.BanFaction,
  Command.Bid,
  Command.ChooseFaction,
  Command.ChooseRoundBooster,
  Command.ExamineArtifact,
  Command.Pass,
  Command.PreferenceBid,
  Command.RotateSectors,
  Command.Setup,
  Command.SilentBid,
  Command.Special,
  Command.SpaceshipAction,
]);

function compactFactionLabel(raw: string): string {
  if (/^p\d+$/i.test(raw)) {
    return raw.toUpperCase();
  }
  try {
    return factionName(raw.toLowerCase() as any);
  } catch {
    return raw
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}

function cleanArg(value: string | undefined): string {
  return (value ?? "").replace(/\.+$/, "");
}

function compactEffect(value: string): string {
  return value
    .replace(/Q\.I\.C\.?/gi, "q")
    .replace(/credits?/gi, "c")
    .replace(/knowledge/gi, "k")
    .replace(/ore/gi, "o")
    .replace(/victory points?|VP/gi, "vp")
    .replace(/power tokens?/gi, "t")
    .replace(/\s*,\s*/g, "/")
    .replace(/\b([ockq])\b/g, "1$1")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function buildingSummary(command: CommandObject): string {
  const building = BUILDING_LABELS[cleanArg(command.args[0])] ?? (cleanArg(command.args[0]) || "build");
  const location = cleanArg(command.args[1]);
  return location ? `build ${building} @ ${location}` : `build ${building}`;
}

function researchSummary(command: CommandObject): string {
  const track = cleanArg(command.args[0]);
  return `up ${TRACK_LABELS[track] ?? track}`.trim();
}

function boosterSummary(raw: string | undefined): string | null {
  const booster = cleanArg(raw);
  if (!booster) {
    return null;
  }
  const code = BOOSTER_CODES[booster] ?? booster;
  const effect = BOOSTER_LABELS[booster];
  return effect ? `${code} (${effect})` : code;
}

function federationChoice(command: CommandObject): FederationChoice | null {
  const raw = command.args.map(cleanArg).find((arg) => /^fed\d+$|^gleens$|^ship-fed-/.test(arg));
  return (raw as FederationChoice) ?? null;
}

function federationReward(choice: FederationChoice | null): string | null {
  if (!choice) {
    return null;
  }
  try {
    return compactEffect(federationChoiceDescription(choice));
  } catch {
    return cleanArg(choice);
  }
}

function claimedTechTile(engine: Engine, position: string): string | null {
  const data = engine as any;
  const pooledTile = data?.tiles?.techs?.[position]?.tile;
  const ownedTile = data?.players
    ?.flatMap((player: any) => player?.data?.tiles?.techs ?? [])
    .find((tile: any) => tile?.pos === position)?.tile;
  const tile = pooledTile ?? ownedTile;
  if (!tile) {
    return null;
  }
  try {
    return compactEffect(techTileData(tile as any).name);
  } catch {
    return null;
  }
}

function techSummary(command: CommandObject | undefined, engine?: Engine | null): string | null {
  if (!command) {
    return null;
  }
  const position = cleanArg(command.args[0]);
  const tile = engine ? claimedTechTile(engine, position) : null;
  return tile ? `tech ${tile}` : position ? `tech@${position}` : "tech";
}

function boardActionSummary(command: CommandObject, commands: CommandObject[], engine?: Engine | null): string {
  const action = cleanArg(command.args[0]);
  const base = BOARD_ACTION_LABELS[action] ?? (action.toUpperCase() || "action");
  const fedTile = commands.find((entry) => entry.command === Command.ChooseFederationTile);
  const tech = commands.find((entry) => entry.command === Command.ChooseTechTile);
  const research = commands.find((entry) => entry.command === Command.UpgradeResearch);

  if (action === "qic2" && fedTile) {
    const reward = federationReward(federationChoice(fedTile));
    return reward ? `${base} (${reward})` : base;
  }
  if (action === "qic1") {
    return [base, techSummary(tech, engine), research ? researchSummary(research) : null].filter(Boolean).join(" · ");
  }
  return base;
}

function spaceshipActionPrefix(ship: string, type: string): string {
  const label = SHIP_LABELS[ship] ?? compactFactionLabel(ship);
  const prefixes: Record<string, Record<string, string>> = {
    [Spaceship.Twilight]: { qic: `${label} QA`, power: `${label} PA`, knowledge: `${label} +3 range` },
    [Spaceship.Rebellion]: { qic: `${label} QA`, power: `${label} PA`, knowledge: `${label} 2k` },
    [Spaceship.TFMars]: { qic: `${label} QA`, power: `${label} PA`, credit: `${label} 3c` },
    [Spaceship.Eclipse]: { qic: `${label} QA`, power: `${label} PA`, credit: `${label} 6c` },
  };
  return prefixes[ship]?.[type] ?? `${label} ${type}`.trim();
}

function standaloneSpaceshipAction(command: CommandObject, commands: CommandObject[]): string {
  const ship = cleanArg(command.args[0]);
  const type = cleanArg(command.args[1]);
  const prefix = spaceshipActionPrefix(ship, type);
  const fedTile = commands.find((entry) => entry.command === Command.ChooseFederationTile);
  const effects: Record<string, Record<string, string>> = {
    [Spaceship.Twilight]: { qic: "re-fed", power: "rl", knowledge: "+3 range" },
    [Spaceship.Rebellion]: { qic: "tech", power: "ts", knowledge: "+2c/1q" },
    [Spaceship.TFMars]: { qic: "2vp + 1vp/tech", power: "Gaia", credit: "m" },
    [Spaceship.Eclipse]: { qic: "2vp + 1vp/planet", power: "research", credit: "m" },
  };
  let effect = effects[ship]?.[type];
  if (fedTile) {
    const reward = federationReward(federationChoice(fedTile));
    effect = reward ? `re-fed → ${reward}` : "re-fed";
  }
  return effect && !prefix.endsWith(effect) ? `${prefix} → ${effect}` : prefix;
}

function consequentialSummary(command: CommandObject): string {
  switch (command.command as string) {
    case Command.Build:
      return buildingSummary(command);
    case Command.UpgradeResearch:
      return researchSummary(command);
    case Command.Explore:
      return `explore ${SHIP_LABELS[cleanArg(command.args[0])] ?? cleanArg(command.args[0])}`;
    case Command.FormFederation: {
      const reward = federationReward(federationChoice(command));
      return reward ? `form fed (${reward})` : "form fed";
    }
    case Command.GaiaFormTransdim:
      return `GF @ ${cleanArg(command.args[0])}`;
    case Command.PlaceLostPlanet:
      return `Lost Planet @ ${cleanArg(command.args[0])}`;
    default:
      return cleanArg(command.command as string);
  }
}

function appendFollowUps(
  summary: string,
  primary: CommandObject,
  commands: CommandObject[],
  engine?: Engine | null
): string {
  const pieces: Array<string | null> = [summary];
  const tech = commands.find((command) => command.command === Command.ChooseTechTile);
  const research = commands.find((command) => command.command === Command.UpgradeResearch);
  if (tech) {
    pieces.push(techSummary(tech, engine));
  }
  if (research && research !== primary) {
    pieces.push(researchSummary(research));
  }
  return pieces.filter(Boolean).join(" · ");
}

function setupOrFallbackSummary(command: CommandObject, commands: CommandObject[], engine?: Engine | null): string {
  switch (command.command as string) {
    case Command.BanFaction:
      return `ban ${compactFactionLabel(cleanArg(command.args[0]))}`;
    case Command.ChooseFaction:
      return `pick ${compactFactionLabel(cleanArg(command.args[0]))}`;
    case Command.SilentBid:
    case Command.PreferenceBid:
      return "bids in";
    case Command.Bid:
      return `bid ${compactFactionLabel(cleanArg(command.args[0]))} ${cleanArg(command.args[1])}vp`.trim();
    case Command.ChooseRoundBooster:
      return boosterSummary(command.args[0]) ?? "B";
    case Command.Pass: {
      const booster = boosterSummary(command.args[0]);
      return booster ? `pass ${booster}` : "pass";
    }
    case Command.Action:
      return boardActionSummary(command, commands, engine);
    case Command.SpaceshipAction:
      return standaloneSpaceshipAction(command, commands);
    case Command.Special:
      return command.args[0] ? `special ${compactEffect(cleanArg(command.args[0]))}` : "special";
    case Command.ExamineArtifact:
      return "artifact";
    case Command.ChooseArtifactToken:
      return command.args[0] ? `artifact ${cleanArg(command.args[0])}` : "artifact";
    case Command.ChooseTinkeringTile:
      return command.args[0] ? `tinker ${cleanArg(command.args[0])}` : "tinker";
    case Command.PlacePowerRing:
      return command.args[0] ? `ring @ ${cleanArg(command.args[0])}` : "ring";
    case Command.RotateSectors:
      return "rotate sectors";
    case Command.Setup:
      return `setup ${command.args.map(cleanArg).join(" ")}`.trim();
    default:
      return `${command.command}${command.args.length ? ` ${command.args.map(cleanArg).join(" ")}` : ""}`.trim();
  }
}

/**
 * One compact, public move summary for lobby rows, the in-game game list, offline games and the
 * between-turn opponent recap. It deliberately drops burns, conversions, leech and other payment
 * plumbing, and uses the terse notation Gaia players use in session reports.
 */
export function compactMoveSummary(move: string, engine?: Engine | null): string | null {
  const commands = parseCommands((move ?? "").trim());
  if (commands.length === 0 || commands.every((command) => NOISE_COMMANDS.has(command.command as string))) {
    return null;
  }

  const actor = compactFactionLabel(commands[0].faction as string);
  const actionSource = commands.find((command) => command.command === Command.Action);
  const shipSource = commands.find((command) => command.command === Command.SpaceshipAction);
  const primary = commands.find((command) => CONSEQUENTIAL_COMMANDS.has(command.command as string));

  let detail: string;
  if (actionSource?.args[0] === "qic1") {
    detail = boardActionSummary(actionSource, commands, engine);
  } else if (primary) {
    const outcome = consequentialSummary(primary);
    if (shipSource && commands.indexOf(shipSource) < commands.indexOf(primary)) {
      detail = `${spaceshipActionPrefix(cleanArg(shipSource.args[0]), cleanArg(shipSource.args[1]))} → ${outcome}`;
    } else if (actionSource && commands.indexOf(actionSource) < commands.indexOf(primary)) {
      detail = `${BOARD_ACTION_LABELS[cleanArg(actionSource.args[0])] ?? "action"} → ${outcome}`;
    } else {
      detail = outcome;
    }
    detail = appendFollowUps(detail, primary, commands, engine);
  } else {
    const visible = commands.find((command) => !NOISE_COMMANDS.has(command.command as string));
    if (!visible) {
      return null;
    }
    detail = setupOrFallbackSummary(visible, commands, engine);
  }

  return detail ? `${actor}: ${detail}` : null;
}

function normalizeReleasedCompactSummary(summary: string): string {
  const match = summary.match(/^(.+?):\s*(.+)$/);
  if (!match) {
    return summary;
  }

  let detail = match[2];
  const oldTracks: Record<string, string> = {
    "TF↑": "up terra",
    "NAV↑": "up nav",
    "QIC↑": "up int",
    "GAIA↑": "up Gaia",
    "ECO↑": "up eco",
    "SCI↑": "up sci",
    "DIP↑": "up dip",
  };
  for (const [oldLabel, newLabel] of Object.entries(oldTracks)) {
    detail = detail.split(oldLabel).join(newLabel);
  }

  const oldActions: Record<string, string> = {
    "PA +3k": BOARD_ACTION_LABELS.power1,
    "PA +2 steps": BOARD_ACTION_LABELS.power2,
    "PA +2o": BOARD_ACTION_LABELS.power3,
    "PA +7c": BOARD_ACTION_LABELS.power4,
    "PA +2k": BOARD_ACTION_LABELS.power5,
    "PA step": BOARD_ACTION_LABELS.power6,
    "PA +2t": BOARD_ACTION_LABELS.power7,
    "QA tech": BOARD_ACTION_LABELS.qic1,
    "QA re-fed": BOARD_ACTION_LABELS.qic2,
    "QA vp/planet": BOARD_ACTION_LABELS.qic3,
  };
  for (const [oldLabel, newLabel] of Object.entries(oldActions)) {
    detail = detail.replace(oldLabel, newLabel);
  }

  detail = detail.replace(
    /(^| → )(m|ts|rl|PI|ac1|ac2|GF|SS)(?= @| ·|$)/g,
    (_whole, prefix: string, building: string) => `${prefix}build ${building}`
  );
  detail = detail.replace(/(^| → )fed → ([^·]+)(?= ·|$)/g, "$1form fed ($2)");
  detail = detail.replace(/(^| → )fed(?= ·|$)/g, "$1form fed");
  detail = detail.replace(/^pass → B\((.+)\)$/, (_whole, effect: string) => {
    const booster = Object.keys(BOOSTER_LABELS).find((key) => BOOSTER_LABELS[key] === effect);
    return `pass ${booster ? boosterSummary(booster) : `B(${effect})`}`;
  });

  return `${match[1]}: ${detail}`;
}

/** Immediately modernize old cached summaries without waiting for that game to receive a new move. */
export function normalizeCachedMoveSummary(summary: string): string {
  const trimmed = (summary ?? "").trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.includes(":")) {
    return normalizeReleasedCompactSummary(trimmed);
  }

  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^(.+?) submitted silent bids\.?$/i, (m) => `${m[1]}: bids in`],
    [/^(.+?) up (terra|nav|int|gaia|eco|sci|dip)\.?$/i, (m) => `${m[1]}: up ${TRACK_LABELS[m[2].toLowerCase()]}`],
    [/^(.+?) build mine sector (\S+?)\.?$/i, (m) => `${m[1]}: build m @ S${cleanArg(m[2])}`],
    [
      /^(.+?) build (ts|lab|PI|academy)\.?$/i,
      (m) => `${m[1]}: build ${BUILDING_LABELS[m[2]] ?? BUILDING_LABELS[m[2].toLowerCase()] ?? m[2]}`,
    ],
    [
      /^(.+?) (power|qic) action (\d+)\.?$/i,
      (m) =>
        `${m[1]}: ${BOARD_ACTION_LABELS[`${m[2].toLowerCase()}${m[3]}`] ?? `${m[2] === "qic" ? "QA" : "PA"}${m[3]}`}`,
    ],
    [/^(.+?) form fed\.?$/i, (m) => `${m[1]}: form fed`],
    [
      /^(.+?) explore (twilight|rebellion|tfmars|eclipse)\.?$/i,
      (m) => `${m[1]}: explore ${SHIP_LABELS[m[2].toLowerCase()]}`,
    ],
    [/^(.+?) pass(?: (booster\d+))?\.?$/i, (m) => `${m[1]}: pass${m[2] ? ` ${boosterSummary(m[2])}` : ""}`],
    [/^(.+?) (pick|ban) (.+?)\.?$/i, (m) => `${m[1]}: ${m[2].toLowerCase()} ${m[3]}`],
  ];

  for (const [pattern, format] of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return format(match);
    }
  }

  const rawTokens = trimmed.replace(/\.$/, "").split(/\s+/);
  if (rawTokens.length > 1 && RAW_SUMMARY_COMMANDS.has(rawTokens[1])) {
    return compactMoveSummary(trimmed) ?? trimmed;
  }
  return trimmed;
}
