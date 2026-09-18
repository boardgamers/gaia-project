import type { Phase } from "./enums";

export type PremoveTiming = { round: number; phase: Phase };

export type PremovePlan = {
  moves: string[];
  timings?: PremoveTiming[];
  revision: number;
  round: number;
  requestId?: string;
  notice?: { kind: "played" | "stopped"; text: string };
};

export type AutomationState = {
  version: 1;
  roundPremoves?: true;
  plans: Record<number, PremovePlan>;
  increments: number[];
  turns: number[];
  liveUpdate: boolean;
};

export type PremoveCommand = {
  type: "premoves";
  requestId: string;
  moves: string[];
  timings?: PremoveTiming[];
  round: number;
  turn: number;
  revision: number;
};

export const MAX_PREMOVES = 3;
