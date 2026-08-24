import { createHash } from "crypto";
import { Command, Phase, Player, SubPhase } from "../../enums";
import { ATOMIC_CANDIDATE_SCHEMA } from "./types";

export interface CandidateKeyMaterial {
  command: Command;
  actor: Player;
  phase: Phase;
  subphase: SubPhase | null;
  target: unknown;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = stableValue((value as Record<string, unknown>)[key]);
          return result;
        },
        {} as Record<string, unknown>
      );
  }
  return value;
}

export function stableCandidateJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

/**
 * Keys describe the atomic choice, not its array position or JavaScript object identity. All
 * choice-set arrays in the key material are normalized by the explicit command projector before
 * reaching this function.
 */
export function canonicalCandidateKey(material: CandidateKeyMaterial): string {
  const payload = {
    schemaVersion: ATOMIC_CANDIDATE_SCHEMA,
    command: material.command,
    actor: material.actor,
    phase: material.phase,
    subphase: material.subphase,
    target: material.target,
  };
  const digest = createHash("sha256").update(stableCandidateJson(payload)).digest("hex");
  return `atomic-v1:${digest}`;
}
