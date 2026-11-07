import type Engine from "./engine";
import type PlayerData from "./player-data";
import type { PremovePower } from "./premove-types";
import assert from "./utils/assert";

// Observation is deliberately ephemeral: never serialized, shared with another seat, or applied
// to a live game. Command-local event lists prevent one reward/payment masking another.
const observers = new WeakMap<Engine | PlayerData, { trace: PremovePower; command: number }>();

export function observePowerCommand(engine: Engine, command: string): () => void {
  const observer = observers.get(engine);
  if (!observer) return () => undefined;
  const previous = observer.command;
  observer.command = observer.trace.length;
  observer.trace.push({ command, events: [] });
  return () => {
    observer.command = previous;
  };
}

export function observePower(
  data: PlayerData,
  kind: "charge" | "discard" | "gaia",
  waste: number,
  area2 = 0,
  area3 = 0
): void {
  const observer = observers.get(data);
  if (!observer) return;
  // Phase transitions (income etc.) can also produce effects outside a command.
  if (observer.command < 0) {
    observer.command = observer.trace.length;
    observer.trace.push({ command: "phase", events: [] });
  }
  observer.trace[observer.command].events.push({ kind, waste, area2, area3 });
}

export function capturePremovePower(engine: Engine, seat: number, move: string): PremovePower {
  const observer = { trace: [] as PremovePower, command: -1 };
  observers.set(engine, observer);
  observers.set(engine.players[seat].data, observer);
  try {
    engine.move(move);
    return observer.trace;
  } finally {
    observers.delete(engine);
    observers.delete(engine.players[seat].data);
  }
}

export function validatePremovePower(value: unknown): asserts value is PremovePower {
  assert(Array.isArray(value) && value.length <= 1000, "Invalid premove power baseline");
  for (const command of value) {
    assert(
      command &&
        typeof command.command === "string" &&
        command.command.length <= 8000 &&
        Array.isArray(command.events) &&
        command.events.length <= 1000,
      "Invalid premove power baseline"
    );
    for (const event of command.events) {
      assert(
        event &&
          ["charge", "discard", "gaia"].includes(event.kind) &&
          [event.waste, event.area2, event.area3].every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 10000),
        "Invalid premove power baseline"
      );
    }
  }
}

export function assertPremovePower(actual: PremovePower, baseline?: PremovePower): void {
  if (baseline !== undefined) validatePremovePower(baseline);
  actual.forEach((command, i) =>
    command.events.forEach((event, j) => {
      const original = baseline?.[i];
      // If the operation sequence changed, don't lend another operation's allowance to this one.
      const matches =
        original?.command === command.command &&
        original.events.length === command.events.length &&
        original.events.every((previous, index) => previous.kind === command.events[index].kind);
      const expected = matches ? original.events[j] : undefined;
      const legacy = baseline === undefined ? " This older plan has no power baseline; review and queue it again." : "";
      assert(
        event.waste <= (expected?.waste ?? 0),
        "This action would waste more power charges than planned." + legacy
      );
      assert(
        (expected && expected.area2 + expected.area3 > 0) || event.area2 + event.area3 === 0,
        "This action would remove power tokens from bowls II or III instead of bowl I as planned." + legacy
      );
    })
  );
}

/** Analysis top-ups are assumptions, not rewards chosen by the player. */
export function withoutPowerObservation<T>(data: PlayerData, action: () => T): T {
  const observer = observers.get(data);
  observers.delete(data);
  try {
    return action();
  } finally {
    if (observer) observers.set(data, observer);
  }
}
