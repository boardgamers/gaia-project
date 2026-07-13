# AI Challenge Plan — a seed-locked "beat the AI" monthly game

> **Status:** design / brainstorming spec. Nothing here is built yet. This document is the
> hand-off artifact for further review and implementation.

---

## 0. FOR AN EXTERNAL REVIEWER (e.g. ChatGPT) — READ THIS FIRST

You are being asked to brainstorm and critique this plan **with your latest flagship model**.
Before you analyze anything:

1. **Pull the latest `master` of `kimphamnguyen/gaia-lost-fleet` from GitHub and work against
   that.** This plan references specific files, function names, and line-level behavior in the
   *current* engine and viewer. An older checkout (or reasoning from memory) will describe code
   that no longer matches. Do a fresh `git clone`/`git pull origin master` and read the real files.
2. The relevant code lives in:
   - `engine/` — the game engine (`engine/src/engine.ts`, `engine/src/move/`, `engine/src/available/`).
   - `engine/src/fuzz/` — an existing **headless self-play harness** (this is the backbone we reuse).
   - `viewer/` — the Vue app (`viewer/src/self-contained.ts`, `viewer/src/components/Game.vue`,
     `viewer/src/logic/auto-decide.ts`).
   - `supabase/functions/resolve-automation/` — a server-side single-turn resolver we mirror.
   - `docs/lost-fleet/PROGRESS.md`, `FUZZER_PLAN.md`, `PREMOVE_PLAN.md`, `PERFORMANCE.md` — context.
3. **Verify the measured numbers in §3 yourself** if you can — they were taken with `ts-node`
   (unoptimized) on one core and will differ on compiled JS / other hardware. They set the
   feasibility envelope; don't treat them as fixed.
4. Then brainstorm freely: challenge the architecture, the training approach, the strength
   boosters, the leaderboard/anti-cheat design, and the milestones. Push back where you disagree.

The goal we are optimizing for: **the strongest possible AI opponent for ONE specific, fixed game
setup**, so humans have a genuinely hard "beat the AI" monthly challenge.

---

## 1. Goal & scope

Build a monthly challenge where the board **seed, the factions, and the turn order are all fixed
and known in advance**. A human picks one of the pre-assigned factions and plays it; the AI plays
the remaining seat(s). The human's goal is to beat the AI — scored by **margin** (human final
score − AI final score), so it's an optimization puzzle, not a binary pass/fail.

**Why fixing the setup is the whole trick:** it deletes the hardest problem in game AI —
generalization across the astronomically large space of boards/tiles/factions/drafts. We no longer
need an AI that plays *any* Gaia game well; we need one that plays **this one game** extremely well.
That turns "solve Gaia Project" (research-lab hard) into "deeply analyze one position" (tractable on
a single machine). Every design choice below exploits this.

**Chosen AI strength target:** a trained neural network **plus live MCTS** (AlphaZero-style),
specialized to the one fixed setup, with additional cheap strength boosters (§6).

---

## 2. The fixed setup (TO BE FILLED IN BY THE OWNER)

The challenge is defined by these values. They are inputs to both the challenge definition and the
seed-locked training target.

```
Seed:               <string or number>
Base or Lost Fleet: <base | lostFleet>
Player count:       <2 | 3 | 4>
Options:            <standard board/factions, no auction, advancedRules off — or specify>

Turn/setup order + faction per seat (ORDER MATTERS — it fixes turn order):
  Seat 1 (first pick):  <faction>
  Seat 2:               <faction>
  Seat 3:               <faction>   (3-4p)
  Seat 4:               <faction>   (4p)

Human's seat:  <which seat the human controls; the rest are AI>
               OR: "human may pick any of {factions}; AI takes the remaining seats"
```

Notes:
- **Order = turn order.** Gaia's initial turn order derives from setup pick order, so the listed
  sequence *is* the turn order (unless the owner specifies otherwise).
- Faction-specific setup steps (Ivits' PI placed last, Xenos' extra mine, the Lost Fleet expansion
  factions placing 1 mine after base factions, etc.) are handled automatically in the scripted
  setup prefix — the owner only supplies the lineup.
- The setup is expressed to the engine as `init <players> <seed>` followed by a **scripted prefix
  of `ChooseFaction` (and any forced setup) move lines**. Deterministic replay (an enforced engine
  invariant) guarantees the same starting position every time.

---

## 3. Feasibility findings from the current codebase (measured this session)

These numbers were taken via `ts-node --transpile-only` on a single core (i.e. a pessimistic floor;
compiled JS is several× faster). They define what's affordable.

| Operation | Cost | Note |
|---|---|---|
| Full random game, 2p (via fuzz harness) | ~355 ms, ~53 turns | includes fuzzer overhead |
| Full random game, 4p | ~770 ms, ~111 turns | |
| Raw `engine.move()` per committed line | ~0.8 ms | full-game rollout ≈ 40 ms |
| **Clone (`JSON.stringify` → `Engine.fromData`)** | **~1.4 ms** | **the MCTS bottleneck** |
| Serialized engine state | ~25 KB | fine |
| `generateAvailableCommandsIfNeeded()` | cheap | fine |

**Key structural facts that make this buildable:**

- **A headless self-play harness already exists**: `engine/src/fuzz/driver.ts` (`fuzzGame()`) plays
  a full game `init → EndGame` with no UI, looping `generateAvailableCommandsIfNeeded()` → pick →
  `engine.move()`. `engine/src/fuzz/random-player.ts` (`chooseMovePart()`) is a ready-made
  **"legal command → concrete move string" mapper** for every command type — the action
  enumeration layer any bot / policy head needs.
- **Legal moves are cleanly exposed** via `engine.generateAvailableCommandsIfNeeded()` →
  `AvailableCommand[]`, each with structured `.data`. The branching factor lives *inside* `.data`
  arrays (factions, buildings+coords, tracks, tiles…), not in the number of commands.
- **Turns are sequential sub-moves**: a move "line" is built part-by-part, committed when
  `engine.newTurn` flips true. Low per-decision branching — good for search.
- **State clone = JSON round-trip**, and games are **deterministic from seed + move list** (an
  enforced fuzz oracle). Perfect for MCTS and for leaderboard verification.
- **Eval surface exists**: `player.data.victoryPoints` is live; resources are on `PlayerData`;
  `finalScorings` gives endgame conditions. Enough for a heuristic evaluator.
- **Setup is fully inspectable**: `engine.tiles.scorings.round[]` (6 round tiles),
  `.scorings.final[]`, `.boosters`, `.techs`, `engine.map`.

**The one engine change worth considering:** clone at ~1.4 ms caps naive MCTS at ~700 clones/sec.
An **incremental undo / copy-on-write** instead of full JSON clone is the single highest-leverage
performance change for a search-heavy bot. Not required to start, but flagged.

---

## 4. Architecture overview

Three layers, each reusing something that already exists:

1. **Engine-side AI module** (`engine/src/ai/`) — features, evaluation, MCTS, net inference,
   opening book. Pure TS, runs on CPU (net inference is small; no GPU needed at play time).
2. **Seed-locked training pipeline** — offline self-play restricted to the one fixed setup,
   producing the specialized net + opening book.
3. **UI / persistence wiring** — challenge entry in the viewer (client-side play + AI compute in a
   Web Worker), Supabase for challenge definitions, leaderboard, and **replay-based verification**.

### 4.1 Proposed `engine/src/ai/` layout

| File | Responsibility | Notes |
|---|---|---|
| `ai/features.ts` | engine state → numeric feature vector | encodes *what to look at* (see §7) |
| `ai/evaluate.ts` | feature vector → scalar/vector value | Tier-0 heuristic; weights hand-set then learned |
| `ai/policy.ts` | move-ordering priors over legal moves | biases which moves MCTS tries first |
| `ai/mcts.ts` | Monte Carlo Tree Search (max-n) | uses net for policy+value at leaves |
| `ai/net.ts` | neural net inference (load weights, forward) | small MLP/CNN over features/planes |
| `ai/book.ts` | opening-book lookup keyed by move-prefix | precomputed for the fixed setup (§6.1) |
| `ai/bot.ts` | `decide(engine, seat): move line` | ties book → MCTS → net together |
| `ai/selfplay.ts` | seed-locked self-play game generator | reuses `fuzz/driver.ts` loop shape |

The bot's public entry mirrors the existing auto-decide hook (see §8): `decide(engine, seat)`
returns a committed move line, given the current engine state.

---

## 5. The AI approach (net + live MCTS, seed-locked)

**Reframe that governs everything:** a faction/position's value is *not* a fixed number — it is the
expected result of the game that follows under good play. So faction choice and every in-game move
are the *same* search problem; `ChooseFaction` is just an early node. With the setup fixed, we
specialize a single net + MCTS to that one tree.

### 5.1 Offline (training time — no human present, take as long as you like)

- **Self-play restricted to the fixed seed/factions/turn-order.** Because the "distribution of
  games" is one board, the net needs a tiny fraction of the data a general net would — plausibly
  **hours to a few days on one machine with a GPU**, versus weeks-to-months for a general model.
- **Loop (AlphaZero-style):** current net + MCTS play games against themselves → those games train
  a better net → repeat. Old self-play data is deliberately discarded (rolling replay buffer);
  the **deliverable is the small weights file**, not a growing archive.
- **Stop criterion:** train until the new net stops beating the previous version (measured
  head-to-head on the fixed setup). Observable and tunable — no blind time commitment.
- **Exploration built in:** Dirichlet/temperature noise + some varied/weaker opponent lines so the
  net is calibrated in the off-distribution positions **humans** actually create, not only
  strong-vs-strong lines.

### 5.2 Online (play time — human is playing)

- The AI reads its move from: **opening book** (if in book) → else **live MCTS** guided by the net.
- Runs **client-side in a Web Worker** so the UI never freezes and search isn't constrained by
  edge-function CPU/time limits.
- **Determinism:** seed the MCTS RNG from `game seed + ply` so the AI's moves are reproducible —
  required for server-side leaderboard verification.

### 5.3 Handling unexpected human moves

The net/MCTS does **not** memorize a fixed line — it evaluates positions, and live MCTS searches
from wherever the human actually took the game, so any move is answered by fresh analysis. The
exploration in §5.1 ensures unusual-but-good human lines aren't off-distribution surprises; bad
human moves land in positions the AI is winning comfortably anyway.

---

## 6. Cheap strength boosters (stack on top of net + MCTS)

Ordered by leverage-per-effort. The first four are the highest-impact cheap adds.

### 6.1 Opening book — the fixed-seed superpower (biggest cheap win)
The first N plies are the *same tree every game*. Analyze them exhaustively offline, store best
responses in a table keyed by the move-history prefix. Instant, near-perfect openings; live search
is saved for the midgame. Exists *only because* the setup is fixed.

### 6.2 Search efficiency (all cheap, standard)
- **Transposition table** — cache evaluations; many move orders reach the same state.
- **Root parallelization** — MCTS across several Web Workers, combined.
- **Ponder on the human's turn** — keep searching likely replies while the human thinks (free
  wall-clock currently wasted).
- **Tune MCTS constants** (PUCT `c`, Dirichlet noise, temperature schedule) via self-play.
- **Raise the simulation count** — the blunt lever; affordable when pondering + no human wait.

### 6.3 Score-margin value target (make it relentless)
Train the value head to predict **score margin**, not win/loss (KataGo-style). A win/loss net
coasts once ahead; a margin-maximizing net keeps pressing for every point — exactly right for a
**margin-scored** "beat the AI" challenge. Cheap target change, large behavioral difference.

### 6.4 Per-player value vector (proper max-n for 3–4p)
Predict every seat's outcome, not a single scalar. Correct multiplayer formulation; just a wider
output head. Fixes kingmaking / threat-misvaluation that 2p-style values get wrong.

### 6.5 Auxiliary training heads
Also predict ownership / future scoring (KataGo-style). Buys strength and sample-efficiency for
little cost by forcing a richer representation. Training-only.

### 6.6 Human-coverage in training
(See §5.1.) Exploration noise + varied opponents so the net is calibrated where humans go.

**Does NOT apply:** board-symmetry data augmentation (a classic cheap AlphaGo trick) — the board is
one fixed *asymmetric* layout, so there are no symmetric equivalents to augment with. Skip it.

---

## 7. Where strategy knowledge lives (and how it "folds in")

Strategy tips are **never fed to the model as text** (no tokens; this is not an LLM). The developer
translates each tip into code, and training tunes how much it matters:

| What you know | Where it's written | Form |
|---|---|---|
| *What matters* (leech potential, round-scoring alignment, blocking) | `ai/features.ts` | state → numbers |
| *How much* it matters | `ai/evaluate.ts` weights | hand-set → **learned** |
| "Try these moves first" | `ai/policy.ts` | move-ordering priors |
| "Roll out roughly like this" | rollout policy | biased play |

**Principle:** encode knowledge as **features** (what to look at), not verdicts (what to conclude).
A tip becomes a feature with a *learnable* weight; if the tip is wrong, self-play drives the weight
toward zero. Keep hard "never/always" rules to a bare minimum (only genuinely dominated moves), and
**ablation-test** anything uncertain (run with the heuristic on vs off over N seeded games: better
without → it was a ceiling; worse → it was a useful prior).

Feature ideas to seed from setup (`engine.tiles`, `engine.map`): round-scoring alignment (weighted
by round), final-scoring affinity, terrain/color reachability, booster/tech-tile fit, per-neighbor
leech potential, hex blocking/adjacency, seat/turn-order position.

A **human-readable strategy doc** (for maintainers) is separate from these machine-usable encodings
and does not feed the model.

---

## 8. UI & flow wiring (reusing what exists)

Existing seams we build on:
- **`viewer/src/self-contained.ts`** — boots a full game client-side from `{players, seed, moves,
  options}`. A challenge = fixed `seed` + scripted `moves` prefix. This is the challenge's home.
- **`viewer/src/logic/auto-decide.ts`** (`autoDecideChargePower`) — existing pattern for a
  non-human seat auto-acting and feeding a move through the commit pipeline. The AI opponent is a
  generalization of this call-site.
- **`supabase/functions/resolve-automation/`** — server-side single-turn resolver (premove/
  auto-charge). Template for a server-side bot seat if ever wanted.
- **Deterministic replay + `(seq, move)` move storage + `engine.bundle.js`** (engine already
  bundled for the edge) — gives **replay-based leaderboard verification for free**.

**Recommended shape — client plays + AI computes; server persists + verifies:**

1. **Challenge definition** — `{ id, month, seed, playerCount, options, setupMoves[],
   humanFactionChoices[], modelAsset }`. Start as static JSON; graduate to a `challenges` table.
2. **Challenge entry UI** — a route beside `hosted/CreateGame.vue` / `Lobby.vue`: shows the current
   challenge + leaderboard; "Play" boots the self-contained viewer with `seed` + `setupMoves`, lets
   the human pick from `humanFactionChoices`.
3. **AI-seat driver** — `viewer/src/logic/ai-opponent.ts` mirroring `auto-decide.ts`:
   `aiDecide(engine, seat): Promise<string>`, delegating to `ai.worker.ts` (net + MCTS in a Web
   Worker). Wired at the same call-site as `autoDecideChargePower`: after each committed move, if
   the next seat is AI, compute and `emit("move")`.
4. **Human-seat lock** — in challenge mode, `Commands.vue`/`Game.vue` accept input only when
   `playerToMove === humanSeat`; AI seats are worker-driven. (Reuse hosted mode's "which seats are
   mine" notion.)
5. **Model asset** — the trained weights file served as a static Vercel asset; loaded by the worker.
6. **Result submission + verification** — on `EndGame`, POST `{challengeId, faction, moveHistory,
   scores}` to a Supabase RPC/edge function that **replays `moveHistory` through `engine.bundle.js`**,
   recomputes scores, checks the human's margin/placement, and inserts a verified leaderboard row.
7. **Leaderboard UI** — read from Supabase; rank by **margin**.

**Leaderboard integrity note:** because net + MCTS has randomness, the AI must be **deterministic**
(seed RNG from game seed + ply) so the verifier can confirm the AI moves in the submitted log are
legitimate (not tampered to be weak). Two caveats to accept: (a) shipping the model to the client
means a determined player can study it — margin scoring + difficulty tiers make that fine (studying
it *is* the puzzle); (b) if full re-verification of MCTS moves proves too expensive, fall back to
recomputing only a spot-check of AI moves, or run the authoritative AI seats server-side while
keeping client-side search as a "practice / hard mode."

**Difficulty tiers for free:** same setup, different AI search budget (shallow = easy, deep = hard).

---

## 9. Milestones (each independently testable)

1. **M0 — headless harness confirmed.** Reuse `fuzz/driver.ts`; add a strength-measurement runner
   (bot A vs bot B, win-rate/margin over N seeded games).
2. **M1 — Tier-0 heuristic bot.** `ai/features.ts` + `ai/evaluate.ts` + 1-ply greedy `decide()`.
   Drop-in for `chooseMovePart`. Benchmark vs random. This is the baseline and the eval harness.
3. **M2 — MCTS bot.** `ai/mcts.ts` (max-n) using the Tier-0 heuristic as leaf evaluator + rollout
   policy. Benchmark vs Tier-0. Add transposition table.
4. **M3 — seed-locked self-play + net.** `ai/selfplay.ts` + `ai/net.ts`; train the specialized net
   (score-margin value, per-player head, exploration noise). Net-guided MCTS. Train to plateau.
5. **M4 — opening book** for the fixed setup (§6.1) + ponder + root parallelization.
6. **M5 — UI wiring** (§8 steps 1–5): challenge entry, self-contained boot, `ai.worker.ts`,
   human-seat lock.
7. **M6 — Supabase persistence + verification + leaderboard** (§8 steps 1, 6, 7).
8. **M7 — polish:** difficulty tiers, par-score display, margin leaderboard.

Perf escape hatch: if MCTS is starved by clone cost (§3), implement incremental undo / copy-on-write
in the engine before scaling sims.

---

## 10. Open questions / for further brainstorming

- Is a full neural net worth it over a very deep MCTS + strong heuristic + opening book for a
  *single* board? (The net earns its keep only if the tree is too big for search alone.)
- Best state/feature representation for the net (planes for the hex map + vectors for
  resources/tech/tokens vs. a pure hand-feature vector).
- Exact action encoding for the policy head (fixed enumerated action space + legality masking,
  reusing `chooseMovePart`'s canonical mapping).
- How to model / exploit the *specific human population* (they deviate from self-play). Worth a
  learned human-move predictor to focus search, or overkill?
- Leaderboard anti-cheat: full re-verification vs spot-check vs server-authoritative AI seats.
- Whether to invest in the incremental-undo engine change up front.

---

## 11. References (read against latest `master`)

- `engine/src/fuzz/` — `driver.ts`, `random-player.ts`, `state.ts`, `run.ts` (self-play backbone).
- `engine/src/engine.ts` — `tiles.scorings/.boosters/.techs`, `map`, `generateAvailableCommandsIfNeeded`.
- `engine/src/available/` — `AvailableCommand` types + `.data` shapes.
- `viewer/src/self-contained.ts`, `viewer/src/components/Game.vue`, `viewer/src/logic/auto-decide.ts`.
- `supabase/functions/resolve-automation/` — server-side turn resolver template.
- `docs/lost-fleet/FUZZER_PLAN.md`, `PREMOVE_PLAN.md`, `PERFORMANCE.md`, `PROGRESS.md`.
