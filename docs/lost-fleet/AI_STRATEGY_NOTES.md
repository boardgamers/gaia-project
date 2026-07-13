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

> **Note on abilities.** These faction abilities are **already implemented in the engine** (base-game
> factions + the Lost Fleet free actions). So the AI automatically *has* them via legal-move
> enumeration and *learns* to use them through self-play — nothing here is a rule to hard-code. What
> these notes capture is the strategic **usage/weighting** (soft), and they flag the ability-related
> state the net's features must *see* (§7.4 completeness) so it can time them.

### Faction: Xenos  (engine-accurate)
- **Core engine / plan:** wide expansion; extra starting mine; forms federations cheaply (PI counts as
  power 4); QIC-rich.
- **Abilities:** start income `3k,4o,15c,q,up-int` (free Intelligence/AI step at start), mine income
  `+o,k`; **PI income `+4pw,+q`** and PI counts as power 4 for federations; **Lost Fleet free action
  `OreToPowerTokenArea3`: 1 ore → 1 power token straight into bowl 3.**
- **Strong on:** this board's R1 (TS), R4 (new sector), Sector final — wide-expansion fits Xenos.
- **Key timings:** PI early (the +4pw+q and cheap feds); grab sectors before HH.
- **Common traps:** NOT a native gaiaformer — this board's two mine-on-Gaia rounds + Gaia final demand
  deliberate gaiaforming; don't neglect it.

| # | Tip | When | Conf | Encode as | Notes |
|---|---|---|---|---|---|
| 1 | Use ore→bowl3 to fund a power action instead of burning | ore spare + a bowl-3 power action is wanted | M | FEAT | LF Xenos free action; cheaper than burn (§7.5) |
| 2 | Lean into sector spread (Sector final + R4 new-sector) | this board | M | FEAT+WEIGHT | Xenos strength; race it (§7.1) |

### Faction: Hadsch Hallas  (engine-accurate)
- **Core engine / plan:** economic powerhouse; credits fund everything (terraform, range, buildings);
  highly flexible.
- **Abilities:** start income `3k,4o,15c,q,up-eco` (free Economy step), mine income `+o,k,3c` — the
  **extra +3 credits**; **PI free actions (once PI built): `4c→1q`, `3c→1o`, `4c→1k`** (convert gold
  into QIC / ore / knowledge).
- **Usage — soft, not a rule:** the credit→QIC conversion is *often* used late to top up QIC (range/
  tech/actions), but that's a tendency; early credit→ore/knowledge can be right when it unblocks a
  build or tech now. Encode as FEAT (credit surplus + what the conversion unblocks), never a hard
  "only late / only QIC" rule.
- **Common traps:** hoarding credits without converting; building PI too late to use the conversions.

| # | Tip | When | Conf | Encode as | Notes |
|---|---|---|---|---|---|
| 1 | Convert credits→QIC late for range/tech/actions | late, credit surplus, QIC needed | M | FEAT (credit-surplus→conversion) | soft tendency — NOT "only late/only QIC" |
| 2 | Convert credits→ore/knowledge early to unblock a build/tech | when it enables a higher-value action now | M | FEAT | the explicit "not a hard rule" case |

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
| 2 | _(example — replace)_ Don't accept leech / pick a booster that makes you overcharge | bowls full or income will fill them | M | FEAT (wasted-charge) | paying VP for nothing |
| 3 | _(example — replace)_ Consider passing early for first player next round | RARE — only when few useful actions/resources left and the first booster / a per-round claim beats them | M | FEAT (pass-tempo) + PRIOR | don't reflexively spend everything first; with a full hand, don't pass; keep power for next-round power actions |
| 4 | _(example — replace)_ Burn power to take a power action you need or to deny one the opponent needs | credits/ore near zero; OR (denial) the opponent ALREADY has bowl-3 power OR your next move will charge them into range — and natural leech won't get you there in time | M | FEAT+WEIGHT | lossy (~half); NO denial value if the opponent can't take it soon (§7.5) |
| 5 | _(example — replace)_ Prefer natural leech over burning — wait if the opponent will build where you can charge | opponent likely to build adjacent soon | M | FEAT (expected-natural-charge) | needs opponent-build prediction (§6.8) |
| 6 | _(example — replace)_ Order queued moves so leech-granting builds come last | multiple moves queued and the opponent could use/burn the charge this round | M | FEAT (opponent-leech-cost) + PRIOR | conditional — don't delay a build you need now (plan §7.6) |
| 7 | | | | | |

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

### Challenge: `lf-mrj5exuu-c680`  (2p Lost Fleet — Xenos vs Hadsch Hallas)
- **Seed / factions / turn order:** seed `lf-mrj5exuu-c680`; 2p Lost Fleet; Seat 1 **Xenos** (first
  player), Seat 2 **Hadsch Hallas** (default order — confirm/flip); human picks either, AI plays the
  other. Validated: boots a legal game.
- **Round scoring (decoded from engine):**
  - **R1** `score8` — 3 VP per **Trading Station** built
  - **R2** `score9` — 3 VP per **mine built on a Gaia planet**
  - **R3** `score1` — 2 VP per **terraforming step**
  - **R4** `lfsector3` — 3 VP the **first time you build a mine in a new Space/Deep-Space sector** (LF)
  - **R5** `score10` — 5 VP per **Planetary Institute / Academy** built
  - **R6** `score6` — 4 VP per **mine on a Gaia planet**
- **Final scoring:** F1 `sector` = **most sectors colonized** · F2 `gaia` = **most Gaia planets**
- **Boosters in box:** booster5, booster7, booster8, booster9, booster10
- **Lost Fleet ships:** ship techs {tfmars, eclipse}; ship feds {twilight, tfmars, eclipse}; 2 artifact
  tokens. Only 2 shuttles for 3 ships — choose carefully (§9, §13e).
- **The big read:** **Gaia-heavy** (R2 + R6 mine-on-Gaia + F2 Gaia final) *and* **expansion-heavy**
  (R4 new-sector + F1 Sector final), with R3 rewarding terraforming and R5 rewarding big buildings.
  Neither Xenos nor HH is a native gaiaformer, so **gaiaforming investment vs wide expansion is the
  central trade-off to solve.** Xenos naturally hits sector spread (F1/R4) + TS (R1) + cheap feds; HH
  funds terraform/gaiaform/expansion via credits (and up-eco start).
- **Opening plan for each faction (fills / feeds the opening book):** _to fill_
- **Known strong lines / traps specific to this setup:** _to fill_

| # | Seed-specific tip | When | Conf | Encode as | Notes |
|---|---|---|---|---|---|
| 1 | Invest in gaiaforming — two mine-on-Gaia rounds (R2,R6) + Gaia final | whole game | M-H | FEAT+WEIGHT | central to this board; neither faction is native |
| 2 | Race sector spread (F1 + R4 new-sector) | expansion phase | M | FEAT (tempo) | contested (§7.1); Xenos favored |
| 3 | Value the R5 (PI/Academy = 5 VP) window | round 5 timing | M | FEAT | time a big-building for R5 |

---

## 12. Uncertain / to ablation-test

Park low-confidence or contradictory tips here. Each becomes an A/B test: run the AI with the tip on
vs off over N seeded games; keep it only if it measurably helps (plan §7).

| # | Tip to test | Hypothesis | Status |
|---|---|---|---|
| 1 | | | untested |

---

## 13. Community-sourced general strategy (captured from forums/guides)

Captured from public Gaia Project / Lost Fleet strategy guides and community discussion (see the
Sources note at the bottom). **Treat these as priors to ablation-test, not truths** — they are
board-agnostic folklore, and per §0 the fixed board may reward otherwise. **Faction/ship "tier"
claims are LOW confidence and must NOT be hard-coded** — use as weak priors at most; the whole point
of the seed-locked value model is to find the truth for *this* setup.

### 13a. Setup evaluation & faction selection
| # | Tip | Conf | Encode as | Notes |
|---|---|---|---|---|
| 1 | Gaia is setup-driven: evaluate board + tech tiles + round & final scoring + boosters **and opponents' picks** *before* choosing a faction; pick the one the setup favors | H | FEAT | validates the whole faction-value approach (plan §5) |
| 2 | Community "often-strong" factions: Taklons, Itars, Ivits, Lantids; beginner-friendly: Terrans, Xenos, Hadsch Hallas | L | PRIOR (weak) | board-dependent folklore — do NOT hard-code; a weak prior at most |

### 13b. Game arc, tempo, engine
| # | Tip | Conf | Encode as | Notes |
|---|---|---|---|---|
| 1 | Rounds 1–3 build economy + expand to ~3–4 planets; rounds 4–6 form federations + take tech tiles; late game pivot to round-goal/endgame scoring | M | WEIGHT / emergent | matches plan §7.2 |
| 2 | Secure the Planetary Institute early (R1–2) when it unlocks the faction's power | M | FEAT+WEIGHT | conditional per faction |
| 3 | "Always Be Charging" — settle near opponents to leech power | M | FEAT (leech potential) | balance against overcharge (§7.4) and against feeding opponents leech (§7.6) |

### 13c. Federations & research tracks
| # | Tip | Conf | Encode as | Notes |
|---|---|---|---|---|
| 1 | Aim for 3+ federations; power-7 efficiency + tight satellite placement is critical | H | FEAT (fed-efficiency) | matches §7.3 |
| 2 | Commit fully to 2–3 research tracks; don't spread thin across all 5 | H | FEAT+WEIGHT | |
| 3 | Advance ~2 tracks to L4+ for endgame scaling; endgame research VP can reach 30–40 | M-H | WEIGHT | emergent under final-margin value |
| 4 | With a resource surplus in R5–6, prioritize research to close gaps; grabbing extra L3 milestones each adds endgame VP | M | FEAT | mild tension with "only 2–3 tracks" — it's about milestone thresholds |

### 13d. Advanced tech, boosters, power
| # | Tip | Conf | Encode as | Notes |
|---|---|---|---|---|
| 1 | Advanced tech tiles are ~15 pts each — prioritize them over chasing every final objective | M-H | FEAT+WEIGHT | validates the §7.1 adv-tech race |
| 2 | Economic boosters early, VP boosters late | M | FEAT (booster value by round) | |
| 3 | Pass early to grab the best booster + first player — but only once you've met the round's goals | H | FEAT (pass-tempo) | matches the bounded §7.4 |
| 4 | L2→L3 power lets you charge 3; manage burn/charge cycles (esp. Itars/Taklons) | mech | — | mechanical context for §7.4/§7.5 |

### 13e. Lost Fleet–specific
| # | Tip | Conf | Encode as | Notes |
|---|---|---|---|---|
| 1 | You can't explore every ship (2 shuttles / 3 ships in 2p; 3 / 4 otherwise) and exploring costs 5 VP (7 for one faction) — choose which ships carefully | H | FEAT (explore cost/benefit) | real VP-now vs actions/fed-token/tech-later tradeoff; contested (§7.1) |
| 2 | Starting close to the ships you need matters (range-gated like mines) | M | FEAT (ship reachability) | feeds setup/faction eval |
| 3 | Each ship holds 1 info + 1 power + 1 credit/knowledge action, 1 fleet skill tile, 1 fleet federation token; the explorer may take a fleet action, a fleet tech tile (instead of a normal one), or a fleet fed token when forming a fed | mech | — | mechanical context |
| 4 | Artifacts are strong and generally underrated; bought with power tokens | M | FEAT+WEIGHT | limited/contested (§7.1) |
| 5 | Ships add flexibility to the rigid base game (e.g. 3 credits→terraform step; 1 knowledge→+3 range) — best for factions with spare credits/knowledge | M | FEAT | |
| 6 | Community opinion: Twilight ship strongest, then Rebellion | L | PRIOR (weak) | board-dependent — do NOT hard-code |

> **Sources (captured 2026-07):** victoryconditions.com Gaia Project factions guide; officialgamerules.org
> Gaia Project strategy; BoardGameGeek & Board Game Arena Lost Fleet threads; namu.wiki Lost Fleet
> page; Board Game Quest Lost Fleet review. Community folklore — verify by ablation (§12), don't trust
> blindly.
