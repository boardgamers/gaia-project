import { createHash } from "crypto";
import { stableCandidateJson } from "../actions/canonical-key";
import {
  CONVERSION_PLAN_SCHEMA,
  CONVERSION_STATE_SCHEMA,
  CanonicalConversionPlanKey,
  CanonicalConversionStateKey,
  ConversionTimingContext,
  ProjectedConversionState,
} from "./types";

function digest(value: unknown): string {
  return createHash("sha256").update(stableCandidateJson(value)).digest("hex");
}

/** Object identity and property insertion order are deliberately absent from state keys. */
export function canonicalConversionStateKey(state: ProjectedConversionState): CanonicalConversionStateKey {
  return `conversion-state-v1:${digest({
    schemaVersion: CONVERSION_STATE_SCHEMA,
    ...state,
    conversionRights: [...state.conversionRights].sort(),
  })}`;
}

/**
 * A plan key names the semantic transition, not a particular commutative ordering. The ordered
 * executable fragments remain on OrderedConversionPlan for replay.
 */
export function canonicalConversionPlanKey(material: {
  sourceStateKey: CanonicalConversionStateKey;
  destinationStateKey: CanonicalConversionStateKey;
  timing: ConversionTimingContext;
}): CanonicalConversionPlanKey {
  return `conversion-plan-v1:${digest({ schemaVersion: CONVERSION_PLAN_SCHEMA, ...material })}`;
}
