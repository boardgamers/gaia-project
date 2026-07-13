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

**This is a recurring monthly challenge.** The architecture is built once and reused for every new
seed; only the challenge definition, the trained weights, and the opening book are regenerated each
month, and prior months' models/data warm-start and strengthen later ones. See §5.4 for the monthly
production workflow and cross-month transfer.

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

**Chosen format: 2-player (human vs one AI)** — committed. For a *strongest-possible-AI* skill
leaderboard, 2p is the best choice on every axis, and it makes the game a clean zero-sum problem we
exploit hard in §6.7:
- **Strongest AI per unit of compute** — games are ~half the length (~53 vs ~111 turns, §3),
  self-play is ~2× faster, and 2p search/value is far cleaner than the multiplayer case, which
  brings kingmaking and the hard max-n opponent-cooperation problem. Fewer opponents → a better AI.
- **Purest, fairest test** — a clean head-to-head; no third-party AI whose interactions randomly help
  or hurt the human (that variance is bad for a skill leaderboard).
- **Cheapest to make deterministic and verify** (one AI seat, fewer moves), and fastest to iterate.
- 3-player is a reasonable occasional variety; **4-player is the worst fit** (maximum variance, fuzzy
  "did I beat it", weakest AI per unit of compute).

**Free replayability:** seed-locked self-play trains *one* net that plays *every* seat, so letting the
human pick **either** of the two factions (AI takes the other) costs no extra training — two ways to
play each monthly challenge. The challenge: 2p, fixed seed, two pre-chosen factions + fixed turn
order, human picks either faction and tries to out-score the AI, ranked by **margin**, easy/hard tiers
via AI search depth.

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

### 5.4 Monthly production & cross-month improvement

This is a **monthly** challenge, so the architecture is built once and reused every month.
Separate three kinds of thing:

- **Reusable / write-once (seed-agnostic):** the entire `ai/` module (features, evaluate, policy,
  mcts, net architecture, selfplay, bot), the training pipeline, tuned MCTS hyperparameters, the
  strength-measurement harness, the UI challenge framework, and the Supabase verification/
  leaderboard plumbing. None of this changes month to month.
- **Per-challenge / regenerated monthly:** the challenge definition (seed + factions + turn order),
  the trained **weights file**, and the **opening book** (100% seed-specific — never reused). Plus a
  per-challenge leaderboard.
- **Accumulating across months:** a general **base net**, the self-play corpus feeding it, and the
  **human-game corpus** the challenge itself produces.

So spinning up month N+1 = fill in a new challenge definition + run the (unchanged) pipeline to
produce new weights + a new book. **The code does not change.**

**Can previous months' data/model improve next month's? Yes — four mechanisms:**

1. **Warm-start / fine-tuning (biggest practical win).** Don't train each month from scratch.
   Initialize the new seed's net from prior weights and fine-tune on the new seed's self-play — you
   *re-specialize* instead of re-learning Gaia. Turns each month's training from days into hours and
   gives stronger starting play.
2. **Base model + monthly specialist.** Keep one persistent **base net** trained on the union of all
   past self-play (general Gaia strength). Each month, fork it and fine-tune to the specific seed.
   As the base grows, every month's starting point is stronger — a compounding effect.
3. **Reused features / hyperparameters / recipe.** Feature set, network shape, MCTS constants,
   training schedule — all carried over unchanged.
4. **Human-game flywheel (the compounding advantage).** Every month's challenge generates real human
   games on that seed. Accumulated, they train a **human-move predictor** (focus search on what
   humans actually do), calibrate the value net in human-reachable positions, and serve as
   evaluation. The challenge literally produces the data that makes future AIs better at beating
   *humans specifically*.

**Data-reuse nuance (be precise):** raw self-play *games* from month A are on board A, so they are
**not** direct training data for month B's *specialized head* — but they are exactly the fuel for the
general **base net** (#2). Per-seed fine-tuning always uses fresh self-play on the new board; old
self-play lives on in the base model. Human games (#4) transfer across months because the skill they
teach (modeling human deviation) is board-general.

**Caveat — negative transfer:** warm-starting from *last month's over-specialized* net can carry
that board's quirks into the new one. Prefer warm-starting from the **general base**, or fine-tune
with enough new self-play to wash out stale specifics. The opening book never transfers.

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

### 6.4 Per-player value vector (multiplayer only — NOT used in the 2p challenge)
Predict every seat's outcome, not a single scalar — the correct formulation *if* you ever add a 3–4p
variety challenge. **For the committed 2p format this is superseded by §6.7** (a single margin scalar
+ negamax is cleaner and stronger). Keep this only for a future multiplayer variant.

### 6.5 Auxiliary training heads
Also predict ownership / future scoring (KataGo-style). Buys strength and sample-efficiency for
little cost by forcing a richer representation. Training-only.

### 6.6 Human-coverage in training
(See §5.1.) Exploration noise + varied opponents so the net is calibrated where humans go.

**Does NOT apply:** board-symmetry data augmentation (a classic cheap AlphaGo trick) — the board is
one fixed *asymmetric* layout, so there are no symmetric equivalents to augment with. Skip it.

### 6.7 Two-player is a clean zero-sum game — exploit it (the biggest 2p-only lever)

Committing to 2p + **margin** scoring (§1) makes this a genuine **two-player zero-sum game**:
my margin = −opponent's margin. That unlocks strength levers unavailable (or much weaker) in
multiplayer:

- **Single-scalar, low-variance value + negamax.** The value head predicts one number (expected
  margin) with a clean negamax backup instead of a per-player vector + max-n → lower variance, faster
  training, stronger net. (Supersedes §6.4.)
- **Alpha-beta / minimax search.** Zero-sum 2p admits alpha-beta pruning (impossible to apply cleanly
  under multiplayer max-n). Complement MCTS with it — or use deep exact search near the end — for far
  greater effective depth at the same budget.
- **A much deeper opening book (§6.1).** One opponent → a far narrower opening tree, so the fixed-seed
  book pre-solves *much* more of the game for the same storage/compute.
- **Exact late-game solving.** Late 2p positions have few branches; the last round or two of a
  fixed-seed game may be **exactly solvable** by full search → perfect endgame play that directly
  maximizes the scoring margin (squeezing the final points). Infeasible in 4p.
- **Clean best-response / human exploitation.** With exactly one opponent to model, the human-game
  flywheel (§5.4 #4) feeds a single **human-move predictor**, and you can compute a **best response**
  to it — a policy tuned to punish the mistakes real humans make on this seed, not just Nash-strong.
  This makes the AI specifically hard for *humans* to beat.
- **More valuable pondering (§6.2).** Only one opponent's move to anticipate; predict it and
  pre-search the reply precisely.

Net effect: 2p lets you *drop* multiplayer complexity (max-n, kingmaking, per-player value) **and**
run deeper, cleaner search with a lower-variance net — stronger AI for less effort.

### 6.8 Opportunistic denial (cheap thwarting) — without spite

Desired behavior: predict what the human is going for, take **cheap** chances to thwart it — even a
slightly suboptimal move — but never spite-block at real cost to yourself. This falls out of two
things already in the plan, combined:

- **The margin/zero-sum value (§6.7) sets the threshold automatically.** margin = my score −
  opponent score, so a move that costs me 2 to deny the opponent 5 is **+3 margin** (search takes
  it); costing me 5 to deny 3 is **−2 margin** (search rejects it). The exact "cheap thwart yes /
  costly spite no" line *is* the margin calculation — not a hand-tuned threshold.
  - **Do NOT add a separate "hurt the opponent" bonus.** Margin already counts opponent losses; an
    extra denial reward double-counts and produces an over-blocking, spiteful AI. Let margin own the
    cost/benefit; this *is* the "don't ruin it for yourself" guardrail, and it's automatic as long as
    denial isn't over-encoded.
- **The opponent model (§6.7) makes the AI *see* what to deny.** Search only blocks a plan whose
  payoff it can see; if the human's target is beyond the search horizon, a cheap block is missed. A
  **human-move predictor** ("the human is heading for X") lets the AI evaluate "cheaply deny X"
  without searching all the way to X, and a **threat/denial feature** (§7-style: the opponent's
  likely plan + the cost-to-me vs damage-to-them of the cheapest interfering move) makes it sharp.

**Why this needs the human model specifically:** self-play trains against a *strong, flexible*
opponent that rarely telegraphs a fat, deniable single-track plan — so a purely self-play AI tends to
*under*-value denial against humans. Humans commit to predictable plans that *can* be cheaply
thwarted; the human-game flywheel (§5.4 #4) teaches the AI to notice and punish that. Much of "cheap
thwarting" is simply winning the §7.1 contested-resource races (block the hex they need, grab the
per-round action first, take the tile they're racing for); the new part is predicting the *softer,
non-obvious* targets.

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
and does not feed the model. That doc lives at **`docs/lost-fleet/AI_STRATEGY_NOTES.md`** — a
fill-in intake of human play knowledge, organized so each tip maps to a concrete encoding (feature /
policy prior / eval weight / rollout bias / rare hard-avoid). A developer translates its entries into
the `ai/` code; the file itself is never read by the model.

### 7.1 Contested & limited-availability resources (races and tempo)

Gaia is full of **contested, limited-availability resources**, many of them powerful. They come in
two kinds, both races:

- **One-time claims (whole-game race):** advanced tech tiles (one copy each, gated by research level
  + a federation token), federation tiles (limited stacks, can be exhausted), Lost Fleet **expansion
  federations**, **artifact tokens** (limited, seeded), the Lost Planet, key blocking hexes. Once
  taken, gone forever.
- **Per-round shared actions (within-round race):** the board **power actions**, the **QIC/green
  actions**, and Lost Fleet **ship actions**. Any player may take them, but each is available only
  *once per round*, so within a round it's a sprint to grab the one you want before a rival does —
  and it hinges on **turn order this round** (can you reach it on your turn before an opponent reaches
  it on theirs, with the resources ready?).

Whoever reaches the prerequisites first claims the prize and denies it to everyone else. The AI must
recognize the race, track how close every faction is, and avoid moves that surrender its lead.

**This is handled emergently by net + MCTS — no bespoke race-tracking code required:**
- MCTS with opponent modeling (max-n) literally simulates the opponents racing for the same prize.
  "Keep track of everyone else's path toward it" *is* the search tree exploring their best
  responses — including them rushing the prerequisites and taking it in the branches where the AI
  delays.
- The value net (with the score-margin target, §6.3) learns that being ahead in a race is winning,
  because in self-play the games where it secured the prize scored higher. A move that surrenders the
  tempo lead therefore *evaluates worse*, so the AI avoids it — exactly the "don't fall out of the
  lead" behavior. It falls out of the objective; it is not hand-coded.

**Caveat + cheap fix:** races span many turns, which stresses search horizon and credit assignment,
so pure search alone can be shaky. Make it sharp and robust with an explicit **contention feature**
(a §7 "what to look at"), covering both kinds:
- *One-time claims:* for each contested asset, *moves-until-I-can-claim-it* vs
  *moves-until-each-opponent-can* → a per-asset **lead/deficit** signal.
- *Per-round shared actions:* current **availability** + whether I can **afford/reach** it before
  each opponent given **this round's turn order**.

This hands the net the race arithmetic instead of forcing it to rediscover the counting from raw
state, so it plays every race precisely even at modest search depth. Board-general and reused every
month; applies to the whole contested-resource family, not just advanced tech.

**Fixed-seed bonus:** because the opening is the same tree every game, the opening book (§6.1)
*pre-solves* the early race optimally — the AI plays the fastest correct line to a contested prize
from move one.

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

**M8 — monthly production loop (§5.4).** Once M0–M7 work for the first seed, factor the per-challenge
artifacts (definition, weights, book, leaderboard) apart from the reusable machinery, stand up the
persistent **base net**, and wire warm-start fine-tuning + the human-game corpus so each new month is
cheap to produce and stronger than the last.

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
- Cross-month transfer (§5.4): warm-start from last month's specialist vs from a general base net —
  how to avoid negative transfer, and how much the human-game flywheel actually helps in practice.

---

## 11. References (read against latest `master`)

- `engine/src/fuzz/` — `driver.ts`, `random-player.ts`, `state.ts`, `run.ts` (self-play backbone).
- `engine/src/engine.ts` — `tiles.scorings/.boosters/.techs`, `map`, `generateAvailableCommandsIfNeeded`.
- `engine/src/available/` — `AvailableCommand` types + `.data` shapes.
- `viewer/src/self-contained.ts`, `viewer/src/components/Game.vue`, `viewer/src/logic/auto-decide.ts`.
- `supabase/functions/resolve-automation/` — server-side turn resolver template.
- `docs/lost-fleet/FUZZER_PLAN.md`, `PREMOVE_PLAN.md`, `PERFORMANCE.md`, `PROGRESS.md`.
