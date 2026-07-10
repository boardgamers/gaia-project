import Engine, { Command } from "@gaia-project/engine";

/**
 * Builds the `RotateSectors` move line for a locked-in preview rotation.
 * Mirrors viewer/src/logic/buttons/setup.ts's sectorRotationButton onClick
 * exactly: mod-6 every rotation count (a sector has 6 sides), then drop any
 * that land back on 0 (no-op rotations don't need to be recorded).
 */
export function buildRotateMove(playerCount: number, rotation: Map<string, number>): string {
  const pairs = [...rotation.entries()]
    .map(([center, times]) => [center, times % 6] as [string, number])
    .filter(([, times]) => times !== 0);
  return [`p${playerCount}`, Command.RotateSectors, ...pairs.flatMap(([center, times]) => [center, String(times)])].join(
    " "
  );
}

export type RotationValidation = { valid: true } | { valid: false; error: string };

/**
 * Confirms a rotate move doesn't trip the German-rules assert
 * (engine/src/move/setup.ts's moveRotateSectors: no two matching planet
 * types adjacent) before it's allowed to be locked in. Uses a scratch
 * Engine, never the live preview engine.
 */
export function validateRotation(
  playerCount: number,
  seed: string,
  rotateMove: string,
  officialCenterSectors = false
): RotationValidation {
  try {
    new Engine([`init ${playerCount} ${seed}`, rotateMove], {
      lostFleet: true,
      advancedRules: true,
      officialCenterSectors,
    });
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}
