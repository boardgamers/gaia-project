import type { Phase } from "./enums";

export type PremoveTiming = { round: number; phase: Phase };

export type PremoveStep = {
  move: string;
  timing: PremoveTiming;
  status: "queued" | "played" | "skipped" | "blocked" | "unplayed" | "undone";
  /** Index in the real move history, never the simulation. */
  moveIndex?: number;
};

export type PremoveRun = {
  id: string;
  label?: string;
  steps: PremoveStep[];
  status: "queued" | "completed" | "stopped" | "cancelled" | "replaced";
  reason?: string;
};

export type PremovePlan = {
  moves: string[];
  timings?: PremoveTiming[];
  revision: number;
  round: number;
  requestId?: string;
  notice?: { kind: "played" | "stopped"; text: string };
  /** Most recent queue first. Executable moves remain separate from this private audit trail. */
  runs?: PremoveRun[];
};

export type AutomationState = {
  version: 1;
  roundPremoves?: true;
  setupPremoves?: true;
  plans: Record<number, PremovePlan>;
  increments: number[];
  turns: number[];
  liveUpdate: boolean;
};

export type PremoveCommand = {
  type: "premoves";
  requestId: string;
  label?: string;
  moves: string[];
  timings?: PremoveTiming[];
  round: number;
  turn: number;
  revision: number;
};
