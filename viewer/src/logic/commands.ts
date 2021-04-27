import Engine, {
  BrainstoneArea,
  Faction,
  GaiaHex,
  HighlightHex,
  Operator,
  Resource,
  Reward,
} from "@gaia-project/engine";
import AvailableCommand, { AvailableHex } from "@gaia-project/engine/src/available-command";
import { ButtonWarning, HighlightHexData } from "../data";

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
