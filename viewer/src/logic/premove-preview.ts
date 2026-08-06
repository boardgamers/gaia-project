import Engine, { PlayerEnum } from "@gaia-project/engine";

// Phase 3 (docs/lost-fleet/PREMOVE_PLAN.md §10.1) - the composer-side counterpart of the engine's
// own `previewAvailableCommandsFor`: builds the clone a NEW queue entry should be composed against.
//
// - Priority mode previews every rank against the SAME fresh current state (one turn ahead only) -
//   trivial, just `previewAvailableCommandsFor` itself.
// - Sequential mode chains: premove #2 is previewed against a clone with #1 already applied, #3
//   against a clone with #1+#2 applied. Each already-queued move is replayed in turn-order, then the
//   engine's own "force it to be this seat's turn" trick (identical to previewAvailableCommandsFor)
//   is re-applied so the NEXT slot's preview models "assume my prior queued turn(s) landed, what can
//   I do for the one after that" rather than whoever the engine says is really up next.
//
// A since-illegal earlier entry (replayed move now throws) stops the chain where it broke rather
// than guessing further - the resolver's own runtime cascade (§10.5) is what actually cleans up a
// broken chain when it executes; this is preview-only, never used for execution (see §2's own
// caveat, unchanged by Phase 3).
export function buildSequentialChainPreview(engine: Engine, seat: number, priorMoves: string[]): Engine {
  const clone = Engine.fromData(JSON.parse(JSON.stringify(engine)));
  for (const move of priorMoves) {
    // Force it to be this seat's move-phase turn before EACH replayed step, not just once at the
    // end - the real engine only lets a move through when playerToMove already matches the move's
    // stated player, and every one of these steps is only ever hypothetically "this seat's turn"
    // (that's the whole point of previewing a premove chain before it's genuinely anyone's turn for
    // real). `forcePremovePreviewTurn` resets the PHASE too, which is what makes a chain survive a
    // step that offers an opponent a leech: replaying such a move leaves the clone in RoundLeech,
    // where the next step could neither execute nor generate a single available command, so every
    // slot after the first build near an opponent came back empty/"no longer possible" (2026-08-06).
    clone.forcePremovePreviewTurn(seat as PlayerEnum);
    try {
      clone.move(move);
      clone.generateAvailableCommandsIfNeeded();
    } catch {
      break;
    }
  }
  clone.forcePremovePreviewTurn(seat as PlayerEnum);
  clone.generateAvailableCommands();
  return clone;
}
