import Engine, {
  applyChargePowers,
  BrainstoneArea,
  Event,
  Faction,
  GaiaHex,
  HighlightHex,
  Operator,
  Player,
  ResearchField,
  researchTracks,
  Resource,
  Reward,
} from "@gaia-project/engine";
import AvailableCommand, { AvailableHex } from "@gaia-project/engine/src/available-command";
import { ButtonData, ButtonWarning, HighlightHexData } from "../data";

export const forceNumericShortcut = (label: string) => ["Spend", "Charge", "Income"].find((b) => label.startsWith(b));

export function hexMap(engine: Engine, coordinates: AvailableHex[]): HighlightHexData {
  return new Map<GaiaHex, HighlightHex>(
    coordinates.map((coord) => [
      engine.map.getS(coord.coordinates),
      {
        cost: coord.cost,
        warnings: coord.warnings,
      },
    ])
  );
}

export function buttonWarning(message?: string): ButtonWarning | null {
  return message && { title: "Are you sure?", body: [message] };
}

export function endTurnWarning(engine: Engine, command: AvailableCommand): ButtonWarning | null {
  const warning = (msg: string) =>
    ({
      title: "Are you sure you want to end the turn?",
      body: [msg],
    } as ButtonWarning);

  const p = engine.players[command.player];
  if (p.faction == Faction.Taklons) {
    const brainstoneArea = p.data.brainstone;
    switch (brainstoneArea) {
      case BrainstoneArea.Area2:
        if (p.data.burnablePower() > 0) {
          return warning("Brainstone in area 2 not moved to area 3 using burn.");
        }
        break;
      case BrainstoneArea.Area3:
        return warning("Brainstone in area 3 not used as free action.");
    }
  }
  return null;
}

export function passWarning(engine: Engine, command: AvailableCommand): ButtonWarning | null {
  const warnings: string[] = [];
  const endTurn = endTurnWarning(engine, command);
  if (endTurn != null) {
    warnings.push(...endTurn.body);
  }

  if (engine.round > 0) {
    const p = engine.players[command.player];

    for (const e of p.events[Operator.Activate].filter((e) => !e.activated)) {
      warnings.push(`Special action is not yet used: ${e.spec.split(Operator.Activate)[1]}`);
    }

    switch (p.faction) {
      case Faction.Itars:
        const burnablePower = p.data.burnablePower();
        if (burnablePower > 0) {
          warnings.push(`Power tokens in area 2 not burned: ${burnablePower}`);
        }
        break;
      case Faction.BalTaks:
        if (p.data.hasResource(new Reward(1, Resource.GaiaFormer))) {
          warnings.push("Gaiaformers are not yet converted.");
        }
        break;
    }
  }

  return warnings.length == 0 ? null : { title: "Are you sure you want to pass?", body: warnings };
}

function rewardWarnings(player: Player, r: Reward): string[] {
  const data = player.data.clone();
  let waste = 0;
  if (r.type === Resource.ChargePower) {
    waste = applyChargePowers(data, [new Event(r.toString())]);
  } else {
    data.gainRewards([r]);
    const resources = player.data.getResources(r.type);
    if (resources == 0) {
      //this resource cannot be gained
      return [];
    }
    waste = resources + r.count - data.getResources(r.type);
  }
  if (waste > 0) {
    return [`${waste}${r.type} will be wasted`];
  }
  return [];
}

function resourceWasteWarning(warnings: string[]) {
  return warnings.length == 0 ? null : { title: "Resources will be wasted - are you sure?", body: warnings };
}

export function specialActionWarning(player: Player, income: string): ButtonWarning | null {
  return resourceWasteWarning(rewardWarnings(player, new Reward(income)));
}

export function advanceResearchWarning(player: Player, field: ResearchField): ButtonWarning | null {
  const level = player.data.research[field];
  const events = researchTracks[field][level + 1].map((s) => new Event(s));
  const warnings = events
    .filter((e) => e.operator == Operator.Once)
    .flatMap((e) => e.rewards)
    .flatMap((r) => rewardWarnings(player, r));
  return resourceWasteWarning(warnings);
}

export function finalizeShortcuts(ret: ButtonData[]) {
  let shortcut = 1;

  const shown = ret.filter((b) => !b.hide);
  for (const b of shown) {
    if (b.shortcuts == undefined) {
      b.shortcuts = [];
    }
    if (b.shortcuts.length == 0) {
      b.shortcuts.push(String(shortcut));
    }
    shortcut++;
  }

  if (shown.length == 1) {
    const b = shown[0];
    b.shortcuts = [];
    if (b.label) {
      if (forceNumericShortcut(b.label)) {
        b.shortcuts.push("1");
      } else {
        b.shortcuts.push(b.label.substring(0, 1).toLowerCase());
      }
    }
    b.shortcuts.push("Enter");
  }
}
