# BGS premoves

Players compose turns in the existing Planning mode, then submit up to three complete turns.
On their own turn the first plays immediately; otherwise it waits. The remaining turns run
server-side when the player becomes active, including when their browser is closed.
The queue above the board is private and can be inspected or cancelled during live play or
while composing another planning line, or reviewing an earlier turn. Cancelling a later move also removes its successors.

## Execution and BGS protocol

`engine/wrapper.ts` uses the existing protocol hooks. No new protocol version is needed:

- `canMoveOutOfTurn` permits a seated player to submit a `premoves` command.
- `isLiveUpdate` marks changes to the queue so BGS saves them without advancing clocks,
  notifications or the public move log. A queue command that executes a turn is a normal save.
- `timeIncrements` returns monotonic per-seat counters. Each completed manual decision or
  executed premove earns one increment; automatic charging and queue edits earn none. Undo keeps
  the counters and clears queues, so replaying the log cannot generate extra increments.
- `stripSecret` includes only the requesting player's plan, including through `logSlice`.

`automation` is optional on old saved games. It is initialized with zero counters so upgrading
an existing game does not retrospectively credit turns. The primary viewer enables its queue
only when this engine capability is present. The alternate viewer can continue making normal moves.

The engine resolves automatic charging/income first. A manual decision waits for the player and
retains their queue. Each premove is checked against a disposable copy of the current board
before being applied, so an unavailable action or a failed later command cannot spend resources.
An illegal turn stops the remaining queue and leaves a private explanation. Queues survive passing
and round changes; each move records its intended round and phase. Unplanned manual income or Gaia
choices wait for the player, while planned income choices can execute automatically. Income already
resolved by the normal auto-income setting is not applied twice. Dropping the seat or ending the
game clears the queue.

Initial building placements and booster choices can also be queued once factions are assigned.
`setupPremoves` advertises this capability. The queue contains only the player's own choices;
opponents' hypothetical setup moves stay in the preview. Each queued choice is checked again
on the real board when its setup turn arrives, including whether its planet or booster is available.

Commands carry the seat's setup/main-turn counter, round, queue revision and request ID. This rejects
stale replacements and makes retries idempotent. Automatic leech does not stale a plan. Cancelling
an existing suffix remains possible even when the retained prefix has become illegal.

The optional `timings` array is additive: older queues default to their recorded round's move phase,
and older viewers' new submissions infer a new round after passing. `roundPremoves` advertises the
new scheduling capability without a new BGS protocol release. Future-round legality is checked
atomically on execution because the intervening income and board changes are not known at submission.

## Sandbox and live updates

Planning is the single composer and enforces the simulated position’s resource costs. Future turns can use simulated income or explicit charges; each is checked
with actual resources when its turn arrives. Simulated charges are never commands or conditions.
The queue stops immediately if the next turn is illegal, without waiting for a charge. An immediately
played turn must already be affordable. A simulated-neighbour Trading Station keeps the `cheap`
qualifier as a 3-credit ceiling: the engine checks the actual upgrade cost and stops if that price
is unavailable, even if the player could afford 6 credits. It never grants a discount. The entire plan
is sent atomically. Saving or cancelling a queue keeps the local plans and variations.
Submitting a new plan replaces the existing queue, with confirmation before submission.

Real moves trim matching prefixes from every local variation, whether played manually or by a
premove. Repeated actions such as research are matched against actual move history, not inferred
from whether they remain legal. Simulation charges attached to a played turn are removed with it.
Unrelated or invalid alternatives are preserved for editing. Reopening a saved plan after a reload
applies the same reconciliation. A rollback requires explicit recovery instead of guessing.

Incoming turns and automatic charging rebase the simulation without closing it. Opponent updates
preserve the partly composed current turn; your own real turn clears that unfinished preview. Queue changes update the real backup without clearing the draft.
Local sandbox saves are scoped by the initial game move (BGS's game seed/name) and player seat,
since BGS uses the same iframe URL for multiple games. Old unscoped BGS drafts are not restored
into an arbitrary game.

## Local preview

```sh
npm --prefix engine run build
npm --prefix viewer run package
npm --prefix viewer run premove:preview
```

Open <http://127.0.0.1:5201/>. This small local host uses the built viewer and real engine wrapper;
its state stays in server memory until the preview process restarts. It does not access a BGS database.

1. Choose **Plan a move**, use the normal controls, and finish the simulated turn.
2. Choose **Queue moves**, then confirm. Reload: the private queue remains.
3. **View on board** opens the queued line; cancelling it keeps an unrelated sandbox draft.
4. **Play opponent's turn** upgrades Alex's adjacent mine, resolves your automatic charging,
   then executes your premove.
5. **Other player's view** shows that seat's own queue, never yours. **Reset position** starts over.

Engine tests cover privacy, stale requests, chains, manual and automatic charging, atomic failure,
cancellation and replay counters. The retained contention tests exercise occupied planets,
research caps, federation and advanced technology tokens, and Lost Fleet space stations.
