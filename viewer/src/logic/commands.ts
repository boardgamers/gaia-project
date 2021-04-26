import Engine, { Faction, GaiaHex, HighlightHex, Operator, Resource, Reward } from "@gaia-project/engine";
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

export function passWarning(engine: Engine, command: AvailableCommand): ButtonWarning | null {
  const warnings: string[] = [];
  if (engine.round > 0) {
    const p = engine.players[command.player];
    if (p.data.hasResource(new Reward(1, Resource.GaiaFormer)) && p.faction === Faction.BalTaks) {
      warnings.push("Gaiaformers are not yet converted.");
    }

    for (const e of p.events[Operator.Activate].filter((e) => !e.activated)) {
      warnings.push(`Special action is not yet used: ${e.spec.split(Operator.Activate)[1]}`);
    }
  }

  return warnings.length == 0 ? null : { title: "Are you sure you want to pass?", body: warnings };
}
