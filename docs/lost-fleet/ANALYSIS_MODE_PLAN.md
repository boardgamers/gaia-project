# Analysis Mode — Implementation Plan (ready for handoff)

> Status: **Phases 1-7 all done, plus §5.4, off-turn entry, and §11's round-0 faction seed (viewer
> v5.68.0, 2026-08-17, PROGRESS.md #166-175) — the whole feature is landed, including the map-corner
> button, entry that no longer requires it to genuinely be this seat's turn, and the ability to pick
> which faction a round-0 line analyses.** Board takeover + line + replay +
> enter/exit/undo/reset/persistence, the sandbox wallet + resource-diff counter, real solo round flow
> (Pass/income/Gaia, the two-round cap, opponent decision auto-resolution), setup-phase pass-and-play
> (opponent mine placement, faction pick, sealed-bid auctions), the hazard-stripe visual treatment
> with the counter's two real surfaces (header headline + full breakdown panel), staleness handling
> on re-entry (§3.5's four-row table, including the own-seat Restore/Discard prompt and the
> `externalData` re-anchor notice), the leech adjustment stepper (§4.4), the commit path (§6, decision
> #13: move 1 live, the rest queued as Sequential premoves in hosted play, gated on real affordability
> with every `adjust` entry stripped out first), and §5.4's map-corner button (bottom-right of the
> hexmap, mirroring the chart icon's top-right placement - built in a follow-up session after being
> deliberately deferred in Phase 5). Every open question in this document was put to the owner and
> answered; §1 is the record of those decisions and should not be relitigated. §2 is a traced account
> of how the existing code actually works — every file:line in it was read, not recalled, so a fresh
> session (Sonnet is fine) can execute this plan without re-deriving the mechanics, though
> PROGRESS.md #167-172 found and corrected five real gaps along the way:
>
> - Shrinking `turnOrderAfterSetupAuction` (via `engine.setup`) for `beginRoundStartPhase`'s benefit,
>   as §2.5 originally said to, would have also broken `beginLeechingPhase`'s unrelated use of the
>   same getter for table-seating order — so the solo switch shrinks `turnOrder` directly instead,
>   and steers `beginRoundStartPhase`'s own fallback via `passedPlayers`, never touching
>   `engine.setup`. Recorded in `applySoloRoundFlow`'s own doc comment (`viewer/src/logic/analysis.ts`).
> - Pre-seeding `passedPlayers` unconditionally (needed to make a **setup**-phase entry's eventual
>   round-1 transition resolve correctly) breaks a **mid-round** entry instead: `passedPlayers` is
>   also the current round's own live pass accumulator, so seeding it non-empty while a round is
>   already under way double-counts this seat's own next pass. The fix checks whether round 1 has
>   ever started (`passedPlayers === undefined`) before pre-seeding, and otherwise resets it to a
>   fresh `[]`, matching what `beginRoundStartPhase` itself always does at an ordinary round
>   boundary. Same file, same doc comment.
> - That same `passedPlayers` pre-seed had a UI-side consequence unit tests never caught: entering
>   analysis mode during setup made `TurnOrder.vue` show a duplicate player circle, since its own
>   `passedPlayers` getter had no round guard (real games never populate that field before round 1,
>   so this was never exercised before). Found via a live-browser check (Playwright against the dev
>   server) in Phase 5 - fixed by gating that getter on `round >= Round.Round1`.
> - Phase 7's `committableAnalysisMoves` first passed `initialWallet: null` into `replayAnalysisLine`
>   unconditionally, assuming its lazy wallet grant would cover a fresh, adjust-stripped replay the
>   same way it covers a setup-phase entry. It doesn't: that lazy grant only fires on the _transition_
>   into `Phase.RoundMove`, never when `origin` already starts there - the overwhelmingly common case
>   (anything past setup). Left unfixed, every round-flow line would have been treated as free to
>   commit, with no affordability check at all. Caught by a test built specifically to exercise it
>   (zero real credits/ore, a move only affordable via the sandbox top-up) before it ever shipped.
>   Fixed by mirroring `enterAnalysisMode`'s own split: grant a fresh wallet eagerly, up front, when
>   `origin.phase === Phase.RoundMove`, only falling through to the lazy path for a genuine
>   setup-phase entry. Recorded in `committableAnalysisMoves`'s own doc comment.
> - `analysisOffered` gated entirely on `canPlay`, which only ever reads true for whichever seat
>   `engine.playerToMove` happens to point at - but a simultaneous sealed-bid round (Silent Auction/
>   Preference Split) isn't gated by turn order from the player's point of view at all
>   (`Commands.vue`, what `canPlay` actually gates, is not even rendered during one). Found from a
>   live owner report on an actual game stuck in that exact round, first fixed narrowly (fall back to
>   `sealedBidPhase(engine) !== null` for a locked seat) - then generalized once the owner asked for
>   entry to be available off-turn everywhere, not just there. It turned out the narrow fix was one
>   instance of a pattern the mechanics already supported for free: `applySoloRoundFlow` already
>   forces the clone's turn to the entering seat outright once it reaches `Phase.RoundMove`,
>   regardless of the real `playerToMove` at entry, and `grantSandboxWallet` has no turn dependency
>   either - the gate was always the only turn-hostile part. `analysisOffered` now reads
>   `myLockedSeat !== undefined ? true : canPlay`, and the now-redundant `sealedBidPhase` check was
>   removed rather than kept alongside the broader rule. Composing a move or bid once inside already
>   worked regardless of turn either way (Phase 4 had already built that half). Recorded in
>   `analysisOffered`'s own doc comment.
>
> §11 was added after the fact, from an owner request that round 0 let you pick ONE faction and go —
> and building it turned up two real bugs in Phase 4's own setup-entry path (the sandbox wallet not
> being re-applied on later replays, and a false "infeasible from move 1"), both found by driving the
> flow through a real browser rather than by any unit test, and both fixed. See PROGRESS.md #173-175.
>
> **Nothing left to continue - this plan is complete, including §5.4 and §11.** The map-corner button lives
> in `SpaceMap.vue` (bottom-right, mirroring the chart icon's top-right placement, `bounds()` extended
> with a second bottom-band reservation) and toggles both directions through one emit Game.vue
> resolves against its own state; the panel's own Enter/Exit buttons and the striped-header
> tap-to-exit from Phase 5 all still coexist with it, matching §5.4's own reasoning for more than one
> exit path. §10's "out of scope" items (AI/move suggestion, opponents moving outside setup mine
> placement, sharing/exporting a line, any database object/RPC/migration/Edge Function) were never in
> scope for this plan and remain exactly that.
>
> Read `CLAUDE.md` and `PROGRESS.md`'s **Working agreements** first. This plan touches the viewer and
> makes one small engine change; it touches no database object and no Edge Function.

---

## 0. What this feature is

**Analysis mode** turns the live board into a local sandbox. You press a button, the board becomes
yours, and you take turn after turn as yourself — unrestricted by what you can currently afford —
while a counter tells you what the whole chain of actions costs. Then you leave, and the real game is
exactly as you left it.

The question it answers is _"can I actually afford this line, and what does it leave me with?"_ — the
thing players currently work out on paper.

It is **not** an AI, an evaluator, or a hint system. It executes exactly the moves you click.

Scope: hosted and self-contained/offline modes both. Nothing about it is server-side.

---

## 1. Owner decisions (settled — do not relitigate)

| #   | Question                                 | Decision                                                                                          |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Do opponents move?                       | **No** — with exactly one exception, opponent mine placement during setup (see #7).               |
| 2   | What does exit do?                       | **Discard the board preview, keep the line.** Re-entering restores it.                            |
| 3   | Reset / undo                             | Both. A **Reset** button and an **Undo last move** button.                                        |
| 4   | Where is the line stored?                | localStorage, per game, per seat. **Never the database.** Store move strings, never engine state. |
| 5   | Name                                     | "Analysis mode". Header text reads `ANALYSIS — not saved`.                                        |
| 6   | Round 0 / setup                          | Playable. Pick any faction, place mines, take a booster, play on.                                 |
| 7   | Opponent mines in setup                  | **Yes** — placed by you, in real setup turn order, so trading-station adjacency is realistic.     |
| 8   | Already past faction pick?               | Faction pool restricts itself to what is actually available. Falls out for free — see §2.6.       |
| 9   | Income / Gaia / pass / round transitions | Work normally, via the engine's own code. See §3.1.                                               |
| 10  | How far can a line run?                  | **Current round + one more round. Hard cap.**                                                     |
| 11  | Shared single-use resources              | **Out of scope.** Do not build "assume this board action is taken". Document the limitation.      |
| 12  | Leech power you would realistically gain | **In scope.** A manual "assume I leech N power" adjustment. See §4.4.                             |
| 13  | Commit the line for real                 | **In scope**, capped at 4 moves. See §6.                                                          |
| 14  | Visual treatment                         | Yellow/black hazard stripes: full strength on the sticky header, dimmed on the map. See §5.       |

---

## 2. How the existing code works (traced, not recalled)

Do not skip this section. Three of the five hard parts of this feature are already solved somewhere
in the codebase, and two of the traps below will silently produce wrong numbers if you miss them.

### 2.1 The viewer is a renderer; moves leave through one funnel

`state.data` is an `Engine`, replaced wholesale on every update and wrapped in `markRaw`
(`viewer/src/store.ts:228`) so Vue never deep-observes it. Moves leave the viewer at
`viewer/src/launcher.ts:129`:

```ts
if (type === "move") { ...; item.emit("move", payload); return; }
```

The host (`self-contained.ts` or `hosted.ts`) applies that move to the real engine and emits the new
state back. **Anything that must not reach the real game simply must not dispatch the `move` action.**

### 2.2 Board takeover already exists — twice

Both premove compose and cancel-trigger compose already do "stash the real engine, take the board
over, play against a throwaway clone, restore on exit":

- `Game.vue:994` — `applyPremoveMove()`
- `Game.vue:1139` — `applyCancelTriggerMove()`
- `Game.vue:1335` — the dispatch switch that routes a click to `premoveMove` / `cancelTriggerMove`
  instead of `move`
- `store.ts:401-408` — the three no-body actions those ride on

Analysis mode is the third instance of this pattern. Follow it: add an `analysisMove` action, route
to it in the `Game.vue:1335` switch, intercept it in the `created()` subscribeAction block near
`Game.vue:486`.

**Replay from a stable base, never from `this.engine`.** `Game.vue:1003` has the comment explaining
why — `handleData()` commits the partial-move-applied result back into `this.engine` on every call, so
cloning from it re-executes an already-applied partial move and throws. This bit premove once already.

### 2.3 Resources: affordability is enforced in command _generation_

`canPay` / `hasResource` (`player-data.ts:433` and `:395`) gate roughly ten call sites across
`engine/src/available/*.ts` — actions, research, federations, ships, spaceship-actions, artifacts.

There is no "ignore cost" flag. **If you cannot pay, the button is never generated.** The only way to
offer an unaffordable move is to make the engine believe you can afford it. That is exactly what
cancel-trigger compose does at `Game.vue:1109`:

```ts
data.credits = 30; data.ores = 15; data.knowledge = 15;
data.qics = 10; data.power.area1 = 4; ...
```

### 2.4 TRAP: the resource caps will silently eat your grant

`player-data.ts:28-30`:

```ts
const MAX_ORE = 15;
const MAX_CREDIT = 30;
const MAX_KNOWLEDGE = 15;
```

They are applied **on gain**, in `gainRewards`:

```ts
this.credits = Math.min(MAX_CREDIT, this.credits + count);
```

Set `credits = 200`, then gain 1 credit from a power action, and you get `Math.min(30, 201)` = **30**.
170 credits vanish with no error. Note the cancel-trigger grant above sits at _exactly_ the caps —
whoever wrote it hit this wall.

This lands precisely on the feature's headline case ("take a power action, watch the counter"). It is
fixed in Phase 2 and is the one engine change in this plan.

### 2.5 Round flow: shrinking the turn order gives you everything

This is the key architectural finding. `move/round.ts:34-35` — passing does:

```ts
engine.passedPlayers.push(player);
engine.turnOrder.splice(engine.turnOrder.indexOf(player), 1);
```

and `move/phase.ts:219` reacts:

```ts
if (executedCommand === Command.Pass) {
  if (engine.turnOrder.length === 0) { cleanUpPhase(engine); return; }
```

So with `turnOrder = [mySeat]`, your pass empties the list and triggers the engine's real
`cleanUpPhase` (`phase.ts:517`) → `beginRoundStartPhase` (`:405`) → `beginIncomePhase` (`:469`) →
`beginGaiaPhase` (`:487`) → back to `RoundMove` (`:513`). Round scoring tiles, booster return,
power/QIC action resets, income selection, Gaia phase — all genuine engine code.

And `beginRoundStartPhase` sets `turnOrder = passedPlayers` — which is `[mySeat]` again. **The solo
loop is self-sustaining.**

Two things to know:

- `phase.ts:405` and `phase.ts:366` both fall back to `turnOrderAfterSetupAuction`, so that list must
  be shrunk too, or it re-expands your turn order.
- Do **not** use `forcePremovePreviewTurn` (`engine.ts:598`) for this. It sets `phase = RoundMove`
  unconditionally, which by definition skips income, Gaia and round transitions — the exact opposite
  of decision #9. It stays useful only for the one-shot preview it was written for.

**Correction, found implementing Phase 3 (PROGRESS.md #167) — do not shrink `turnOrderAfterSetupAuction`
after all.** It has no setter; the only way to "shrink" it is mutating its backing `engine.setup`
array. But `beginLeechingPhase` (`phase.ts:561`) reads the SAME getter via `playersInTableOrderFrom`
for a completely different purpose — table-seating order, used to find who a new building offers
leech to. Shrink `engine.setup` and `canLeechPlayers` is always empty from that point on, so a real
leech offer (the "your very first mine" scenario §2.8 is about) never happens at all — the exact
opposite of what the feature needs to demonstrate. The actual fix ships in `applySoloRoundFlow`
(`viewer/src/logic/analysis.ts`): shrink `turnOrder` and clear `passedPlayers` only, applied once
from `enterAnalysisMode` (today's entry gate always already lands at `Phase.RoundMove`, round ≥ 1,
so `beginRoundStartPhase`'s `turnOrderAfterSetupAuction` fallback — which only fires when
`passedPlayers` is still `undefined`, i.e. only on the real game's own setup→round1 transition — has
already happened before analysis mode exists; `engine.setup` never needs touching in that case).
**Phase 4 still needs to work this out for a setup-phase entry**, where `analysisOrigin` starts
before that transition: applying the same `turnOrder=[seat]`/`passedPlayers=[]` reset needs to
happen lazily, mid-replay, at the exact point the clone first reaches round 1's `beginRoundStartPhase`
— probably by pre-seeding `passedPlayers = [seat]` right before that transition fires, so the
`|| turnOrderAfterSetupAuction` fallback never triggers, rather than shrinking `setup` and risking
the same leech-adjacency breakage for round 1 itself.

### 2.6 Setup already does what decision #7 wants — if you leave it alone

`beginSetupBuildingPhase` (`phase.ts:366`) builds the setup turn order including Lost Fleet expansion
stages, the reverse-order second mine, and Ivits' late placement. `beginSetupBoosterPhase` (`:399`)
does the reverse booster order.

**Do not shrink the turn order during setup.** Run setup as pass-and-play — you make every seat's
choices, which _is_ opponent mine placement, in the correct order, with zero special-casing. Shrink to
`[mySeat]` only when round 1's move phase begins (§3.1).

Decision #8 also falls out for free: start the clone from the live state and the engine's own
available-commands already offer only the factions still available.

### 2.7 Auction phases: null the sealed-bid backend

`store.ts:113-120` documents it: a non-null `sealedBidBackend` means bids are collected server-side;
**null means offline/hot-seat play, where the bid form submits an ordinary move.** So analysis mode
forces it to null, you enter every seat's bid locally, and analysis never touches
`auction_sealed_bids`.

### 2.8 Opponent decisions can be auto-resolved

`engine.autoMove()` (`engine.ts:767`, implementation in `move/auto.ts`) already has handlers for
`autoChooseFaction`, `autoChargePower`, `autoIncome` and `autoBrainstone`.

This matters because of **leech**: `beginLeechingPhase` (`phase.ts:561`) switches to
`Phase.RoundLeech` and waits for opponents to answer a charge offer. Without handling, analysis mode
stalls on your very first mine.

### 2.9 The sticky header already supports context variants

`Commands.vue:55`:

```html
:class="premoveContext ? `sticky-bar-title--${premoveContext.variant}` : null"
```

with `#move-buttons .sticky-bar-title` at `Commands.vue:1296` and the amber `&--trigger` variant at
`:1320`. Analysis mode is one more variant.

Two things not to break:

- The `::before` pseudo-element (`Commands.vue:1305-1315`) is the bottom-sheet **grab handle**. Put
  stripes in `background`, not `::before`.
- The auto-leech dropdown (`Commands.vue:76`, `class="ml-auto auto-leech-select"`) is **meaningless in
  analysis mode** (opponent decisions are auto-resolved) — that slot is where the counter goes (§5.3).

### 2.10 The map surface is on the container, and it is shared

`theme.scss:755`:

```scss
.space-map,
.space-map-canvas {
  background-color: var(--ui-map-canvas);
```

The comment above it notes _"The SVG's transparent inter-sector gaps reveal this material"_ — so
striping this rule makes stripes show through the gaps between sectors, framing the board while
leaving hexes legible. That is the desired effect.

**But that rule is explicitly shared with setup and open-game previews.** Scope the striping under an
analysis-mode class or every lobby preview turns into hazard tape.

Map corners, for button placement: faction wheel occupies a top-left pocket, the chart button
(`SpaceMap.vue:49`) and terraform swatches (`:55`) occupy a top-right band, the colour legend runs
down the left. **Bottom-right and top-centre are free.** `bounds` (`SpaceMap.vue:389`) reserves
footprints so hexes do not overlap map UI, and `SpaceMap.spec.ts` tests that clearance — a new
occupant must be added to that reservation logic.

### 2.11 The premove queue caps at 3

`PremoveBar.vue:179` — `:disabled="rows.length >= 3"`. This is what bounds the commit path in §6.

---

## 3. Architecture

### 3.1 The analysis clone

On entry:

1. Snapshot the real engine (`analysisBackup`), exactly as `premoveBackup` does.
2. Clone it: `Engine.fromData(JSON.parse(JSON.stringify(engine)))`.
3. Record `baseRound = clone.round` and `baseMoveCount = engine.moveHistory.length`.
4. Mark the clone `analysis = true` (§3.4) and grant the sandbox wallet (§4.1) — **only if already in
   `RoundMove`**; during setup the grant is withheld (it would allow builds setup does not permit).
5. Force `sealedBidBackend = null` in the store (§2.7).
6. `generateAvailableCommandsIfNeeded()` and hand it to `handleData()`.

The **solo switch** — setting `turnOrder = [mySeat]` and `turnOrderAfterSetupAuction = [mySeat]` — is
applied lazily, the first time the clone reaches `Phase.RoundMove` with `round >= 1`. Before that
point setup runs pass-and-play (§2.6).

### 3.2 The line

The line is an **ordered list of entries**, not just move strings, because §4.4's leech adjustment
must survive replay:

```ts
type AnalysisEntry = { kind: "move"; move: string } | { kind: "adjust"; charge: number };
```

Every change replays the whole line from the entry snapshot. This is the established pattern
(`Game.vue:1003`) and it gives **Undo** (pop the last entry, replay) and **Reset** (clear, replay
nothing) for free. Replaying at most two rounds is cheap — the engine replays entire games routinely.

After each replayed move, resolve any opponent-side pause via `autoMove()` until control returns to
you (§2.8). Setup-phase building placement is the one deliberate exception — that pause is yours to
answer.

### 3.3 Persistence

Key on game id + seat. Store **only** the entry list plus `baseRound` and `baseMoveCount` — never a
serialized engine. This sidesteps engine schema drift in localStorage and makes it structurally
impossible for the §3.4 flag to round-trip into anything real.

### 3.4 The uncapped flag

Add a non-serialized `analysis` flag to `PlayerData` (or thread it from the engine) and make the three
clamps in `gainRewards` conditional on it:

```ts
this.credits = this.analysis ? this.credits + count : Math.min(MAX_CREDIT, this.credits + count);
```

Set it **after** `Engine.fromData`, and confirm it does not appear in `toJSON` (`player-data.ts:167`).
An engine spec should assert both: uncapped gain works when the flag is set, and the flag never
survives a `toJSON` → `fromData` round trip.

### 3.5 Staleness on re-entry

Compare stored `baseMoveCount` against the live `moveHistory.length`:

| Situation                   | Behaviour                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Unchanged                   | Restore the line silently.                                                         |
| Only opponents moved        | Replay; keep the valid prefix, stop at the first entry that throws; show a notice. |
| **Your own seat moved**     | **Prompt to keep or clear.** Do not silently replay.                               |
| Live game advanced past cap | Clear the line; the two-round window has moved on.                                 |

The third row matters: the common case is "I analysed a line, then played it", and silently replaying
it would double the move or throw.

Note that a mid-analysis `externalData` arrival must **not** nuke the line the way premove does at
`Game.vue:461-483`. Keep the line; re-anchor and show a notice.

### 3.6 Isolation

Non-negotiable, in rough order of danger:

- Never dispatch `move` — use `analysisMove` (§2.2).
- Exclude analysis state from `HostedGameHost.onCommittedState` — `CLAUDE.md` names it as the hook for
  anything that saves or exports hosted state.
- Exclude it from the offline mirror (`hosted/offline-mirror.ts`), or a sandbox line could be written
  into the offline copy and uploaded.
- Analysis mode, premove compose and cancel-trigger compose must be **mutually exclusive**. Three
  board-takeover modes contending for `state.data` is a bug farm. Entering one disables the others.

### 3.7 The two-round cap

Allow Pass while `clone.round < baseRound + 1`; suppress it after, with a short explanation in the
panel. Entering during setup gives you setup plus round 1.

**Round 6 is the deliberate exception**: passing there hits `finalScoringPhase` (`phase.ts:542`) and
ends the game. Allow it — seeing a line's final score is genuinely useful — but make it explicit
rather than incidental, and make sure the EndGame state does not fire real game-over UI.

---

## 4. Resource accounting

### 4.1 The sandbox wallet

Once the clone is flagged (§3.4) the caps are gone, so grant generously — enough that affordability
never blocks a button. Record the granted amount per resource as `grant`.

### 4.2 Display: real numbers, negative when overdrawn

Displayed value = `cloneValue − grant`. So a player with 3 credits who spends 10 shows **−7**, in red.
Negative means "this line is not affordable as it stands", which is the answer players actually want.

### 4.3 The counter itself

Diff-based, never accumulated: `net = current − baseline`, per resource. Gains from power actions,
income and leech then fall out automatically as negative usage with no special-casing.

Three things to surface:

- **Per-resource net** — c / o / k / q / VP, plus power as a **bowl-state delta** (`4/2/3 → 2/2/1`)
  rather than an invented scalar, since power is derived (`player-data.ts:456-462`), not stored.
- **Feasibility verdict** — not a single number. If you overdraw at entry 4, everything after it is
  hypothetical: say **"infeasible from move 4"**, not "short 6c".
- **Per-round breakdown** once a line crosses a round boundary, since income muddies a cumulative
  total.

### 4.4 The leech adjustment (decision #12)

Because opponents never build, you never gain the leech power you would realistically collect, so
analysis is **pessimistic on power**. Provide a small stepper — "assume I leech N power" — which
appends an `{ kind: "adjust", charge: N }` entry to the line. On replay it applies as a
`Resource.ChargePower` gain to your player data. It is an explicit, visible line item, never silent.

### 4.5 Known limitation (decision #11 — document, do not build)

Board actions, tech tiles, boosters and federation tiles are **shared, single-use** pools. With
opponents frozen, analysis shows all of them available, so a line built on the 7-credit power action
assumes nobody takes it first. This is deliberately out of scope. State it in the panel's help text so
the number is not over-trusted.

---

## 5. Visual design

The board must be unmistakably not-live at a glance. The treatment is **yellow/black diagonal hazard
stripes**, at two different strengths.

### 5.1 Header — full strength

A new `&--analysis` variant beside `&--trigger` (`Commands.vue:1320`), using a
`repeating-linear-gradient` at 45°. Text reads `ANALYSIS — not saved`. Keep the grab handle (§2.9) and
ensure text contrast against the stripes — a solid or scrimmed text backing, not raw text on stripes.

Desktop does not render the sticky bar (`showStickyMobileBar`), so give the standalone `#move-title`
the same treatment, or desktop is the one place analysis mode looks like live play.

### 5.2 Map — dimmed

Same gradient, **much lower contrast**, on the `theme.scss:755` rule, scoped under an analysis-mode
class (§2.10). Stripes read through the inter-sector gaps and frame the board without fighting planet
colours or straining the eye over a long session. Verify in both light and dark themes — the block
right below that rule adjusts hex strokes per theme.

### 5.3 Where the counter goes

The owner's instinct that `StickyResourceBar` is too tight is right — it is already ten SVG icons
wide on a phone, and adding deltas would double it.

**Recommendation — split by urgency, using two surfaces that already exist:**

- **Headline in the striped header**, in the slot freed by the auto-leech dropdown (§2.9). Compact:
  net deltas plus the feasibility verdict. This is the surface that is _always_ visible on mobile,
  which matters because the map scrolls away.
- **Full breakdown as a compact HTML overlay pinned to the map's top-centre** — genuinely free space
  (§2.10), and it reads well against the dimmed stripes. Per-resource, per-round, plus the leech
  stepper and Reset / Undo / Commit controls.

On desktop both are visible at once; on mobile the header carries you when the map is scrolled off.

### 5.4 Entering and leaving

Enter via a button at the **map's bottom-right** (free, §2.10 — remember to extend the `bounds`
reservation). Exit from either that button **or by tapping the striped header**, since on mobile the
map is often scrolled and a map-anchored control can be off-screen when you want out.

---

## 6. Committing a line (decision #13)

The natural end of an analysis is "yes, do that". The premove system already provides the machinery.

**The line becomes: move 1 committed live, moves 2..N queued as Sequential premoves.** This is not a
workaround — in a real game opponents move between your turns, so anything past move 1 _is_ a premove
by definition.

The cap therefore is not arbitrary: `PremoveBar.vue:179` caps the queue at 3 rows, so **4 moves total**
(1 live + 3 queued). Offer the first 4 and grey out the rest.

Hard constraints:

- **Only an affordable prefix may be committed.** Track per-entry feasibility during replay; if the
  line went negative at entry 3, only entries 1-2 are committable. A line that only worked because of
  the sandbox grant must never be committable.
- Premoves are **hosted-only**. In self-contained/offline play, offer move 1 only.
- `{ kind: "adjust" }` entries are analysis-only fiction — they are never committed, and an entry
  after one is only committable if it is still affordable without the assumed leech.
- Committing exits analysis mode and clears the line.

---

## 7. Suggested phasing

Each phase should end green and be independently useful.

| Phase | Scope                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------- |
| **1** | Board takeover + line + replay. Enter/exit, `analysisMove`, undo, reset, persistence. No unlock yet.    |
| **2** | The engine `analysis` flag (§3.4) + sandbox wallet + the diff counter. This is where it becomes useful. |
| **3** | Round flow: solo turn-order switch, pass, income/Gaia, the two-round cap, opponent auto-resolve.        |
| **4** | Setup-phase play: pass-and-play setup, opponent mines, null sealed-bid backend.                         |
| **5** | Visual treatment (§5) and the counter surfaces.                                                         |
| **6** | Staleness handling (§3.5) and the leech adjustment (§4.4).                                              |
| **7** | The commit path (§6).                                                                                   |

Phases 1-3 are the feature. 4-7 can each be cut without invalidating what is built.

---

## 8. Testing

Per `CLAUDE.md`'s testing table — **run only what the change can break**, and always append
`--reporter min`:

- Viewer work (most phases): the touched component specs, then the viewer suite **once**, at the end.
- The engine change in Phase 2: the affected engine specs, then the engine suite **minus `src/ai/**`\*\*.
- **Never the offline-AI suite.** It is unrelated to this feature, takes many minutes, and is
  OOM-killed partway through in this container.

Specs worth adding:

- Engine: uncapped gain with the flag set; the flag not surviving a `toJSON` → `fromData` round trip.
- Solo round flow: pass with `turnOrder = [seat]` reaches the next round's `RoundMove` with income
  applied.
- Line replay: undo, reset, truncation at a since-illegal entry, and the three staleness cases.
- Counter: a power action produces a **negative** net cost (this is the case §2.4's trap breaks).
- Isolation: an analysis move never dispatches `move`, and never reaches `onCommittedState`.

---

## 9. Before committing

- Run **`pnpm run prettier`** from the repo root. The `All` workflow gates `prettier --check` on every
  push to every branch, and `master` is the production/Vercel target.
- Add the changelog entry through `node scripts/update-viewer-release.js`, never by hand-editing
  `release.json`. This is user-facing, so it needs a `user:` entry as well as `dev:` ones.
- Update `PROGRESS.md`'s "Done so far" and this document's status header.

---

## 10. Out of scope

- Any AI, evaluation or move suggestion.
- Shared single-use resource contention (§4.5) — deliberate, decision #11.
- Opponent moves outside setup mine placement.
- Sharing or exporting a line (the `?state=` URL loader and game chat would make this natural later).
- Any database object, RPC, migration or Edge Function. **This feature is entirely client-side.**

---

## 11. Round 0: the faction seed (added 2026-08-17, viewer v5.68.0)

Decision #6 made round 0 playable, and decision #7 made you place everyone's starting mines. What
neither gave you was a say in **which faction you analyse as**: the line had to walk every seat's
pick, and in an auction game every seat's bid — after which the auction's own resolution decided your
faction for you. (Checked against the engine, not assumed: a Preference Split line that picked
terrans for seat 0 resolved to nevlas.) So the one question a round-0 analysis exists to answer —
"how does this faction's opening actually play?" — was the one it could not be asked.

### 11.1 The mechanism

A third entry kind beside `move` and `adjust` (§3.2), and like `adjust` it is analysis-only fiction
with no move string behind it:

```ts
{ kind: "faction"; lineup: Faction[] }   // one faction per seat, indexed by seat
```

Applying it (`applyFactionSeed`, `viewer/src/logic/analysis.ts`) assigns the lineup and then calls
the engine's own `endSetupFactionPhase`, so faction boards load, Lost Fleet terraforming costs and
Moweyds' starting ship are dealt out, and the setup building turn order is built by the same code a
real game uses. **This is the one engine change**: that function is now exported
(`engine/src/move/phase.ts`, re-exported from `engine/index.ts` beside `leechPossible`) with its
behaviour untouched.

Three things the implementation must keep right, each of which breaks silently otherwise:

- **`engine.setup` has to keep matching the lineup.** `turnOrderAfterSetupAuction` is a getter that
  reads player order back out of it by looking up who holds each faction, so a mismatch fills every
  later turn order with -1. A seed that only permutes an already-complete pool (the auction case)
  keeps its existing order — preserving the real table's turn order — and only a seed that changes
  the pool itself rebuilds it in seat order.
- **`player.variant` must be cleared**, or `endSetupFactionPhase` loads the faction board of whatever
  faction that seat held _before_ the seed.
- **`data.bid` is reset to 0.** A bid recorded against the old faction is meaningless against the new
  one, and a bid only costs VP at final scoring (`finalScoringPhase`), which a two-round line never
  reaches — so a seeded line has no auction price in it at all. Stated in the panel rather than
  guessed at.

### 11.2 Which factions are offered, and what a swap means

The pool is everything the table already holds plus everything still on offer (the engine's own
`ChooseFaction` data, so bans, expansion membership and the same-planet-colour rule are respected
without re-deriving any of them). Both halves matter: mid-pick the available half carries the answer,
while in an auction's bid phase every faction is already claimed and nothing is on offer — that is
precisely the case this feature exists for.

Choosing a faction an opponent currently holds **swaps the two seats** rather than pulling an
unrelated faction in, which is what "what if the auction lands it on me" means. The lineup is built at
compose time and stored in the entry, never re-derived on replay: the pool shrinks and grows as the
line is edited, so re-deriving could hand a stored line a different table than the one it was set up
with.

### 11.3 Scope limits

- Only from a round-0 phase before the first starting mine (`SetupBoard` … `SetupPreferenceBid`).
  From `SetupBuilding` onwards the table is settled and pass-and-play (§2.6) already covers it;
  reseeding there would silently discard placements already made.
- A line holds at most one seed, always as its first entry. Choosing again replaces the line — that
  is what "actually, show me Itars instead" means.
- **Nothing from a seeded line is ever committable** (§6). Every move in one was played on a table
  this seat only imagined, possibly as a faction it does not hold.
