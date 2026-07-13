# AI Strategy Notes — human play knowledge to bake into the AI

> **Purpose.** A structured intake for *your* Gaia Project strategy knowledge. You fill it in; a
> developer translates each entry into code in `engine/src/ai/`. See `AI_CHALLENGE_PLAN.md` §7.
>
> **Status:** template — fill in later. Examples are marked _(example — replace)_.

---

## 0. How to write tips so they actually help (read first)

The model **never reads this file as text** — it is not an LLM, there are no tokens. Instead, each
tip you write is translated by a developer into one of a few code forms, and then **training tunes
how much it matters**. So write tips accordingly:

- **Prefer "what to look at" over "always do X".** "Being closer than the opponent to an advanced
  tech tile is valuable" (a *feature*) is far better than "always rush advanced tech" (a brittle
  *rule*). Features get a learnable weight; if you're wrong, self-play drives it to zero. Hard rules
  bake in your blind spots and cap the AI.
- **State the conditions.** A tip that's only true in some situations should say when. "Prefer the
  navigation booster **in early rounds on a spread-out map**" beats "navigation booster is good".
- **It's OK to be uncertain or wrong.** Mark confidence; low-confidence tips are still useful as
  priors and get ablation-tested (run the AI with the tip on vs off; keep it only if it helps).
- **Note contested/tempo tips specially** (§8) — those feed the race/contention feature.

### Two special cases: openings and "must-not-do" moves

- **Opening moves ("moves to yearn for").** Because the seed/factions/turn order are fixed, the
  opening is *solved offline* by the opening book (plan §6.1), not guessed. So write opening tips as
  **PRIOR** (move-ordering hints): they make the book's search converge faster and cover off-book
  positions, but **the book overrules them.** General opening folklore is board-agnostic and this
  specific board may reward something different — you *want* the solver free to find that. Almost
  never encode an opening as a hard rule.
- **"Must-not-do" moves.** Ask: *can you construct any position where the move is correct?*
  - **No, provably never** (e.g. passing up a strictly-free scoring action, wasting a QIC for
    nothing) → **AVOID** (hard prune). Effect is *speed, not strength* — use sparingly, only when
    certain.
  - **Yes, somewhere** ("usually don't over-expand / neglect power") → **FEAT + WEIGHT** (negative),
    learnable and overridable. Most "must-nots" are really this kind. When in doubt, make it soft.

### Encoding legend (put one of these in the "Encode as" column)

| Tag | Meaning | Where it lands in code |
|---|---|---|
| **FEAT** | A thing to measure about a position | `ai/features.ts` |
| **WEIGHT** | How much some feature/outcome matters | `ai/evaluate.ts` (hand-set → learned) |
| **PRIOR** | "Try these moves first" in search | `ai/policy.ts` (move ordering) |
| **ROLL** | Bias for how rollouts/playouts play | rollout policy |
| **AVOID** | A genuinely dominated move to prune (use sparingly!) | search pruning |
| **HUMAN** | A tendency/mistake real humans make (for exploitation) | human-move model (§6.7 of plan) |

### Row format used in every section below

`| # | Tip / heuristic | When it applies (conditions) | Confidence H/M/L | Encode as | Notes |`

---

## 1. General / whole-game principles

Tempo, economy-vs-VP, engine-building curve, when to pivot from building to scoring, resource
efficiency, etc. When noting economy tips, describe **projected position** (income + board presence +
expansion room + leech/gaia/tech potential), **not** "climb the Economy track" — see plan §7.2 — and
prefer FEAT/WEIGHT over rules. Round-1-economy emphasis is a strong *motivation*, not a strict rule:
good board presence or denying a key planet can beat pure income.

| # | Tip / heuristic | When it applies | Conf | Encode as | Notes |
|---|---|---|---|---|---|
| 1 | _(example — replace)_ Prioritize actions that both build the engine **and** score the current round tile | early–mid rounds | M | WEIGHT | tempo compounding |
| 2 | | | | | |
| 3 | | | | | |

---

## 2. Faction play

General notes per faction. (For the monthly challenge only the two chosen factions matter, but keep
general notes here so they're reused across months.) Duplicate the small table per faction.

### Faction: _______________
- **Core engine / plan:**
- **Strong on which round-scoring tiles:**
- **Strong on which final-scoring conditions:**
- **Key timings / thresholds:**
- **Common traps:**

| # | Tip | When | Conf | Encode as | Notes |
|---|---|---|---|---|---|
| | | | | | |

### Faction: _______________
- **Core engine / plan:**
- **Strong on which round-scoring tiles:**
- **Strong on which final-scoring conditions:**
- **Key timings / thresholds:**
- **Common traps:**

| # | Tip | When | Conf | Encode as | Notes |
|---|---|---|---|---|---|
| | | | | | |

---

## 3. Round-scoring tiles

How to exploit / align with each round-scoring tile type, and how much to bend your plan for it.

| # | Round tile (type) | How to exploit it | Which factions love it | Conf | Encode as |
|---|---|---|---|---|---|
| 1 | _(example)_ mine-scoring | front-load mine builds this round | terraform-cheap factions | M | FEAT+WEIGHT |
| 2 | | | | | |

---

## 4. Final-scoring conditions

Affinity notes per final-scoring condition (buildings on a planet type, sectors, tech levels,
gaia planets, federations, satellites, etc.).

| # | Final condition | How to chase it | Which factions favor it | Conf | Encode as |
|---|---|---|---|---|---|
| 1 | | | | | |

---

## 5. Round boosters

Which boosters are strong when, and pick/priority order.

| # | Booster | Value / when strong | When to grab vs pass | Conf | Encode as |
|---|---|---|---|---|---|
| 1 | | | | | |

---

## 6. Tech tiles (standard + advanced)

Value and timing of standard tech tiles and advanced tech tiles; which are worth racing for.

| # | Tech tile | Value | Timing / threshold to take | Race-worthy? | Conf | Encode as |
|---|---|---|---|---|---|---|
| 1 | | | | | | |

---

## 7. Power / charge / leech economy

Leech (charge vs decline) decisions, brainstone handling, gaiaforming timing, power-bowl management.

| # | Tip | When | Conf | Encode as | Notes |
|---|---|---|---|---|---|
| 1 | _(example)_ Decline a small leech if the VP cost outweighs the charge this round | low bowls, early | L | FEAT+WEIGHT | engine already has auto-charge; this tunes it |
| 2 | | | | | |

---

## 8. Contested resources & tempo (feeds the race/contention feature — plan §7.1)

The powerful "claim" things: advanced tech tiles, federation tiles, Lost Fleet expansion feds,
artifact tokens, the Lost Planet, key blocking hexes (one-time claims); and power actions, QIC
actions, ship actions (per-round shared). For each, note **who tends to win the race and why**, and
any **thresholds** (e.g. "needs level-4 track + a fed token by round 3 to beat a rival to it").

| # | Contested thing | Who wins the race / key threshold | One-time or per-round | Conf | Encode as |
|---|---|---|---|---|---|
| 1 | _(example)_ advanced tech tile X | whoever hits nav L4 + has a green fed first | one-time | M | FEAT (tempo) |
| 2 | | | | | |

---

### Federations (formation & timing) — feeds plan §7.3

Note your rules of thumb for *when* to form (early fed-tile boost + unlocking the fed token vs
efficiency), *what* to include (hit the threshold with minimal overshoot & satellites; avoid
overloading 1-power mines), and the *exceptions* (a satellite/federation final-scoring tile flips the
satellite cost; sometimes upgrading a building already in a fed is still right). Encode as FEAT/WEIGHT,
never hard rules — see §0. The engine enumerates candidate feds, so these notes tune *choice + timing*,
not the connection math.

| # | Federation tip | When / condition | Conf | Encode as | Notes |
|---|---|---|---|---|---|
| 1 | _(example — replace)_ Aim for ~7 power with the fewest satellites | default | M | FEAT (fed-efficiency) | overshoot wastes tokens/buildings |
| 2 | _(example — replace)_ Don't sink all power tokens into fed 1 | always | M | FEAT+WEIGHT | keep economy for later feds |
| 3 | | | | | |

---

## 9. Lost Fleet–specific (if the challenge uses Lost Fleet)

Ships, exploration, artifact tokens, expansion federations, Examine Artifact, the new expansion
factions. Note the strong lines and the contested/tempo bits (cross-reference §8).

| # | Tip | When | Conf | Encode as | Notes |
|---|---|---|---|---|---|
| 1 | | | | | |

---

## 10. Human tendencies (for exploitation — 2p best-response, plan §6.7)

Since it's 2p, we can model the human and best-respond. List common **mistakes / habits** real
players make (on this kind of seed) that the AI can punish. Tag these **HUMAN**.

Also list **telegraphed plans** humans commit to and the **cheapest move that thwarts each** (its cost
to you vs damage to them) — this feeds the opportunistic-denial behavior (plan §6.8). Note: margin
scoring already decides *whether* a thwart is worth taking; these notes only help the AI *see* the
opportunity, so don't inflate them into "always block."

| # | Human tendency / mistake | How the AI exploits it | Conf | Notes |
|---|---|---|---|---|
| 1 | _(example)_ humans under-leech early to save VP | build to force big leech decisions on them | L | verify against real games |
| 2 | | | | |

---

## 11. Per-challenge (per-seed) notes

Fill a fresh copy of this block **for each month's specific seed/factions/turn order**. These are
the setup-specific reads that don't generalize.

### Challenge: _______________  (month / seed)
- **Seed / factions / turn order:**
- **Key round & final tiles this game, and what they reward:**
- **The big contested prizes on this board and who's favored:**
- **Opening plan for each faction (fills / feeds the opening book):**
- **Known strong lines / traps specific to this setup:**

| # | Seed-specific tip | When | Conf | Encode as | Notes |
|---|---|---|---|---|---|
| 1 | | | | | |

---

## 12. Uncertain / to ablation-test

Park low-confidence or contradictory tips here. Each becomes an A/B test: run the AI with the tip on
vs off over N seeded games; keep it only if it measurably helps (plan §7).

| # | Tip to test | Hypothesis | Status |
|---|---|---|---|
| 1 | | | untested |
