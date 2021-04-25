import Engine, { GaiaHex, HighlightHex } from "@gaia-project/engine";
import { AvailableHex } from "@gaia-project/engine/src/available-command";
import { HighlightHexData } from "../data";

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
