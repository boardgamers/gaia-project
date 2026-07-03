/**
 * FUZZER_PLAN.md §2: AvailableCommand -> concrete move string (seeded RNG).
 *
 * Design rules (from the plan):
 * - Consume ONLY `AvailableCommand.data` — never re-derive legality — so the generator cannot
 *   mask availability bugs (if the engine offers it, the fuzzer may play it; if playing an
 *   offered command throws, that is itself a tier-1 finding).
 * - Forced sub-decisions (charge/income/brainstone) are randomized, not auto-decided — leech
 *   interrupts are §J2-critical territory.
 * - Guard against free-action loops (`Spend`, `BurnPower`): cap conversions per line, then
 *   force progress (pass weighting grows as the round ages).
 * - v1 scope: `factionVariant: "standard"`, no auction, no `customBoardSetup`, players 2-4.
 *   Commands outside that scope (Bid, Setup, RotateSectors, MoveShip) throw GeneratorError.
 */
import { AvailableCommand } from "../available/types";
import { Command, Faction, Phase } from "../enums";
import Reward from "../reward";
import { pick, pickWeighted, Rng } from "./rng";

/** A fuzzer-internal bug (unimplemented command arm), NOT an engine finding. */
export class GeneratorError extends Error {}

export interface PlayContext {
  rng: Rng;
  phase: Phase;
  /** Committed lines since the current round started — used to grow the pass weight. */
  roundLines: number;
  /** Spend/BurnPower parts already emitted in the current line. */
  conversionsInLine: number;
  playerCount: number;
}

const CONVERSIONS_PER_LINE_CAP = 2;

const LOST_FLEET_FACTIONS: readonly Faction[] = [
  Faction.Tinkeroids,
  Faction.Darkanians,
  Faction.Moweyds,
  Faction.SpaceGiants,
];

/** Multiply every reward count in a reward string, e.g. scale("1tg,1pw", 3) = "3tg,3pw". */
function scaleRewardString(rewards: string, k: number): string {
  return Reward.parse(rewards)
    .map((r) => new Reward(r.count * k, r.type))
    .join(",");
}

/**
 * Base weight per command for the main-move menu. Lost Fleet commands are weighted UP —
 * per the owner's instruction, the fuzzer's focus is the Lost Fleet rules surface; the
 * base game implementation is trusted (base seeds are oracle calibration only).
 */
function commandWeight(command: AvailableCommand, ctx: PlayContext): number {
  switch (command.name) {
    case Command.Build:
      return 5;
    case Command.FormFederation:
      // `federations: []` with fed-check on means only a CUSTOM (hand-picked hex set) federation
      // is possible (`available/federations.ts`, `federationCache.custom`). Synthesizing custom
      // hex sets would re-derive legality, which the plan's design rules forbid — skip those.
      return command.data.federations.length > 0 ? 3 : 0;
    case Command.UpgradeResearch:
      return 2.5;
    case Command.Action:
      return 2;
    case Command.Special:
      return 2;
    // Lost Fleet actions get extra weight so ship/artifact interactions are exercised often.
    case Command.Explore:
      return 4;
    case Command.SpaceshipAction:
      return 4;
    case Command.ExamineArtifact:
      return 3;
    case Command.Spend:
      // Free actions are always allowed in the Gaia phase (Terrans MUST convert to progress);
      // in the move phase they are capped per line to avoid conversion loops.
      if (ctx.phase === Phase.RoundGaia) {
        return 10;
      }
      return ctx.conversionsInLine < CONVERSIONS_PER_LINE_CAP ? 1 : 0;
    case Command.BurnPower:
      return ctx.conversionsInLine < CONVERSIONS_PER_LINE_CAP ? 0.4 : 0;
    case Command.Pass:
      // Pass weight grows as the round ages so games always progress toward termination.
      return 0.6 + 0.12 * ctx.roundLines;
    case Command.EndTurn:
      // AfterMove menu: mostly end the turn, sometimes squeeze in a free action first.
      return 6;
    case Command.DeadEnd:
      return 0;
    default:
      return 2;
  }
}

/**
 * Choose one dot-separated move part for `player` from the offered commands.
 * Returns null when nothing is choosable (only DeadEnd / empty) — the caller retries the line.
 */
export function chooseMovePart(commands: AvailableCommand[], player: number, ctx: PlayContext): string | null {
  const mine = commands.filter((c) => c.player === player && c.name !== Command.DeadEnd);
  if (mine.length === 0) {
    return null;
  }

  const chosen = pickWeighted(
    ctx.rng,
    mine.map((c) => [c, commandWeight(c, ctx)] as [AvailableCommand, number])
  );
  if (chosen === null) {
    return null;
  }
  return movePartFor(chosen, ctx);
}

function movePartFor(command: AvailableCommand, ctx: PlayContext): string | null {
  const rng = ctx.rng;

  switch (command.name) {
    case Command.ChooseFaction: {
      const factions = command.data;
      // Bias toward the 4 new Lost Fleet factions (when offered) so LF faction mechanics
      // dominate the campaign, per the owner's Lost-Fleet-first instruction.
      const lf = factions.filter((f) => LOST_FLEET_FACTIONS.includes(f));
      if (lf.length > 0 && rng() < 0.7) {
        return `${Command.ChooseFaction} ${pick(rng, lf)}`;
      }
      return `${Command.ChooseFaction} ${pick(rng, factions)}`;
    }

    case Command.Build: {
      const b = pick(rng, command.data.buildings);
      return `${Command.Build} ${b.building} ${b.coordinates}`;
    }

    case Command.PlaceLostPlanet:
      return `${Command.PlaceLostPlanet} ${pick(rng, command.data.spaces).coordinates}`;

    case Command.UpgradeResearch:
      return `${Command.UpgradeResearch} ${pick(rng, command.data.tracks).field}`;

    case Command.ChooseTechTile:
      return `${Command.ChooseTechTile} ${pick(rng, command.data.tiles).pos}`;

    case Command.ChooseCoverTechTile:
      return `${Command.ChooseCoverTechTile} ${pick(rng, command.data.tiles).pos}`;

    case Command.ChooseRoundBooster:
      return `${Command.ChooseRoundBooster} ${pick(rng, command.data.boosters)}`;

    case Command.Pass: {
      const boosters = command.data.boosters;
      if (boosters.length === 0) {
        return `${Command.Pass}`;
      }
      return `${Command.Pass} ${pick(rng, boosters)}`;
    }

    case Command.EndTurn:
      return Command.EndTurn;

    case Command.Action:
      return `${Command.Action} ${pick(rng, command.data.poweracts).name}`;

    case Command.Special:
      return `${Command.Special} ${pick(rng, command.data.specialacts).income}`;

    case Command.Spend: {
      const act = pick(rng, command.data.acts.filter((a) => !a.hide).length > 0
        ? command.data.acts.filter((a) => !a.hide)
        : command.data.acts);
      let k = 1;
      if (act.range && act.range.length > 0) {
        // In the Gaia phase spend as much as possible (Terrans must empty their Gaia area to
        // progress); otherwise scale modestly.
        k =
          ctx.phase === Phase.RoundGaia
            ? act.range[act.range.length - 1]
            : pick(rng, act.range.slice(0, 3));
      }
      return `${Command.Spend} ${scaleRewardString(act.cost, k)} for ${scaleRewardString(act.income, k)}`;
    }

    case Command.BurnPower:
      return `${Command.BurnPower} ${pick(rng, command.data)}`;

    case Command.ChargePower:
      return `${Command.ChargePower} ${pick(rng, command.data.offers).offer}`;

    case Command.Decline:
      return `${Command.Decline} ${command.data.offers[0].offer}`;

    case Command.BrainStone:
      return `${Command.BrainStone} ${pick(rng, command.data.choices).area}`;

    case Command.ChooseIncome:
      return `${Command.ChooseIncome} ${pick(rng, command.data)}`;

    case Command.FormFederation: {
      const fed = pick(rng, command.data.federations);
      const tile = pick(rng, command.data.tiles);
      return `${Command.FormFederation} ${fed.hexes} ${tile}`;
    }

    case Command.ChooseFederationTile:
      return `${Command.ChooseFederationTile} ${pick(rng, command.data.tiles)}`;

    case Command.PISwap:
      return `${Command.PISwap} ${pick(rng, command.data.buildings).coordinates}`;

    // ---- Lost Fleet commands ----

    case Command.Explore:
      return `${Command.Explore} ${pick(rng, command.data.ships).ship}`;

    case Command.SpaceshipAction: {
      const action = pick(rng, command.data.actions);
      return `${Command.SpaceshipAction} ${action.ship} ${action.type}`;
    }

    case Command.GaiaFormTransdim:
      return `${Command.GaiaFormTransdim} ${pick(rng, command.data.spaces).coordinates}`;

    case Command.ExamineArtifact:
      return `${Command.ExamineArtifact}`;

    case Command.ChooseArtifactToken:
      return `${Command.ChooseArtifactToken} ${pick(rng, command.data.tokens)}`;

    case Command.ChooseTinkeringTile:
      return `${Command.ChooseTinkeringTile} ${pick(rng, command.data.tiles)}`;

    case Command.PlacePowerRing:
      return `${Command.PlacePowerRing} ${pick(rng, command.data.spaces).coordinates}`;

    // ---- outside v1 scope (plan §2) ----
    case Command.Bid:
    case Command.Setup:
    case Command.RotateSectors:
    case Command.MoveShip:
      throw new GeneratorError(`Command ${command.name} is outside the fuzzer's v1 scope (plan §2) but was offered`);

    default:
      throw new GeneratorError(`No generator arm for command ${(command as AvailableCommand).name}`);
  }
}

export function isConversionPart(part: string): boolean {
  return part.startsWith(`${Command.Spend} `) || part.startsWith(`${Command.BurnPower} `);
}
