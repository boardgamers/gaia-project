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

/**
 * Pick from a choice list that the engine may hand over EMPTY. Returning null makes the driver
 * treat the line like a DeadEnd: ban the opening choice, retry. (Originally added for the
 * rescore subphase's `{tiles: []}` case, finding LF-2 — now fixed, see the comment on the
 * `Command.ChooseFederationTile` arm below — kept as general defensive coding.)
 */
function pickOrNull<T>(rng: Rng, items: readonly T[] | undefined): T | null {
  if (!items || items.length === 0) {
    return null;
  }
  return items[Math.floor(rng() * items.length)];
}

function movePartFor(command: AvailableCommand, ctx: PlayContext): string | null {
  const rng = ctx.rng;

  switch (command.name) {
    case Command.ChooseFaction: {
      const factions = command.data;
      // Bias toward the 4 new Lost Fleet factions (when offered) so LF faction mechanics
      // dominate the campaign, per the owner's Lost-Fleet-first instruction.
      const lf = factions.filter((f) => LOST_FLEET_FACTIONS.includes(f));
      const faction = lf.length > 0 && rng() < 0.7 ? pick(rng, lf) : pickOrNull(rng, factions);
      return faction === null ? null : `${Command.ChooseFaction} ${faction}`;
    }

    case Command.Build: {
      const b = pickOrNull(rng, command.data.buildings);
      return b === null ? null : `${Command.Build} ${b.building} ${b.coordinates}`;
    }

    case Command.PlaceLostPlanet: {
      const space = pickOrNull(rng, command.data.spaces);
      return space === null ? null : `${Command.PlaceLostPlanet} ${space.coordinates}`;
    }

    case Command.UpgradeResearch: {
      const track = pickOrNull(rng, command.data.tracks);
      return track === null ? null : `${Command.UpgradeResearch} ${track.field}`;
    }

    case Command.ChooseTechTile: {
      const tile = pickOrNull(rng, command.data.tiles);
      return tile === null ? null : `${Command.ChooseTechTile} ${tile.pos}`;
    }

    case Command.ChooseCoverTechTile: {
      const tile = pickOrNull(rng, command.data.tiles);
      return tile === null ? null : `${Command.ChooseCoverTechTile} ${tile.pos}`;
    }

    case Command.ChooseRoundBooster: {
      const booster = pickOrNull(rng, command.data.boosters);
      return booster === null ? null : `${Command.ChooseRoundBooster} ${booster}`;
    }

    case Command.Pass: {
      const boosters = command.data.boosters;
      if (boosters.length === 0) {
        return `${Command.Pass}`;
      }
      return `${Command.Pass} ${pick(rng, boosters)}`;
    }

    case Command.EndTurn:
      return Command.EndTurn;

    case Command.Action: {
      const act = pickOrNull(rng, command.data.poweracts);
      return act === null ? null : `${Command.Action} ${act.name}`;
    }

    case Command.Special: {
      const act = pickOrNull(rng, command.data.specialacts);
      return act === null ? null : `${Command.Special} ${act.income}`;
    }

    case Command.Spend: {
      const visible = command.data.acts.filter((a) => !a.hide);
      const act = pickOrNull(rng, visible.length > 0 ? visible : command.data.acts);
      if (act === null) {
        return null;
      }
      let k = 1;
      if (act.range && act.range.length > 0) {
        // In the Gaia phase spend as much as possible (Terrans must empty their Gaia area to
        // progress); otherwise scale modestly.
        k = ctx.phase === Phase.RoundGaia ? act.range[act.range.length - 1] : pick(rng, act.range.slice(0, 3));
      }
      return `${Command.Spend} ${scaleRewardString(act.cost, k)} for ${scaleRewardString(act.income, k)}`;
    }

    case Command.BurnPower: {
      const amount = pickOrNull(rng, command.data);
      return amount === null ? null : `${Command.BurnPower} ${amount}`;
    }

    case Command.ChargePower: {
      const offer = pickOrNull(rng, command.data.offers);
      return offer === null ? null : `${Command.ChargePower} ${offer.offer}`;
    }

    case Command.Decline:
      return `${Command.Decline} ${command.data.offers[0]?.offer ?? ""}`.trimEnd();

    case Command.BrainStone: {
      const choice = pickOrNull(rng, command.data.choices);
      return choice === null ? null : `${Command.BrainStone} ${choice.area}`;
    }

    case Command.ChooseIncome: {
      const income = pickOrNull(rng, command.data);
      return income === null ? null : `${Command.ChooseIncome} ${income}`;
    }

    case Command.FormFederation: {
      const fed = pickOrNull(rng, command.data.federations);
      const tile = pickOrNull(rng, command.data.tiles);
      return fed === null || tile === null ? null : `${Command.FormFederation} ${fed.hexes} ${tile}`;
    }

    case Command.ChooseFederationTile: {
      // The rescore subphase is never offered at all with zero owned Federation tokens (fixed
      // per finding LF-2, owner ruling 2026-07-03: rescoring with nothing to rescore resolves as
      // a silent no-op — see `available/federations.ts` `possibleFederationTiles`), so this
      // command's `tiles` list is never empty in practice; `pickOrNull` stays as defensive coding.
      const tile = pickOrNull(rng, command.data.tiles);
      return tile === null ? null : `${Command.ChooseFederationTile} ${tile}`;
    }

    case Command.PISwap: {
      const b = pickOrNull(rng, command.data.buildings);
      return b === null ? null : `${Command.PISwap} ${b.coordinates}`;
    }

    // ---- Lost Fleet commands ----

    case Command.Explore: {
      const ship = pickOrNull(rng, command.data.ships);
      return ship === null ? null : `${Command.Explore} ${ship.ship}`;
    }

    case Command.SpaceshipAction: {
      const action = pickOrNull(rng, command.data.actions);
      return action === null ? null : `${Command.SpaceshipAction} ${action.ship} ${action.type}`;
    }

    case Command.GaiaFormTransdim: {
      const space = pickOrNull(rng, command.data.spaces);
      return space === null ? null : `${Command.GaiaFormTransdim} ${space.coordinates}`;
    }

    case Command.ExamineArtifact:
      return `${Command.ExamineArtifact}`;

    case Command.ChooseArtifactToken: {
      const token = pickOrNull(rng, command.data.tokens);
      return token === null ? null : `${Command.ChooseArtifactToken} ${token}`;
    }

    case Command.ChooseTinkeringTile: {
      const tile = pickOrNull(rng, command.data.tiles);
      return tile === null ? null : `${Command.ChooseTinkeringTile} ${tile}`;
    }

    case Command.PlacePowerRing: {
      const space = pickOrNull(rng, command.data.spaces);
      return space === null ? null : `${Command.PlacePowerRing} ${space.coordinates}`;
    }

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
