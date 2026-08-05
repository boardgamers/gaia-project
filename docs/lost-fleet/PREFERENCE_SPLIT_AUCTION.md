# Preference Split Auction

A faction-selection variant for **exactly four players and four factions**. Selectable at game
creation as `AuctionVariant.PreferenceSplit` (`"preference-split"`), alongside Standard, Silent
Auction, Choose-Then-Bid and Bid-While-Choosing.

It is deliberately **not** a first-price, second-price or ascending ("silent") auction: nobody
outbids anybody, nobody reacts to anybody else's numbers, and the price never comes from a single
opponent's bid.

## The rules, in plain language

1. Every player secretly distributes **exactly X bid points** among the four factions, all at the
   same time. Bids are whole numbers, 0 is allowed, and the four must add up to exactly X.
2. Nothing is revealed until every player has submitted. Then everything is revealed at once.
3. Factions are **ranked by the total** bid on them, highest first.
4. Going down that ranking, each faction is **awarded to the highest bidder who has not already
   received a faction**. A player who wins one is out of the running for the rest.
5. The price is the **average of all four bids** on that faction — including bids from players who
   already won something else. It is never recalculated as players drop out.
6. A winner **never pays more than their own bid** on the faction they got. They often pay less. A
   player who bid 0 on the faction they end up with pays 0.
7. Any tie — two factions on the same total, or two eligible players on the same highest bid — is
   resolved **automatically and at random**. Players are never asked to break a tie.

The payment is deducted from the winner's final score, the same way every other auction variant's
bid is (`player.data.bid`, cashed out in `finalScoringPhase`).

### Budget (X)

Configurable per game (`EngineOptions.auctionBudget`, set from the create-game screen). Default
**40**, valid range 1–999, whole numbers only. 40 points across four factions averages 10 per
faction, which puts a typical winning price in the 5–15 VP range next to a ~120 VP game.

### Rounding

`roundVictoryPoints()` in `engine/src/algorithms/preference-split-auction.ts` is the single place
this happens: conventional **half-up** (10.5 → 11, 10.49 → 10). Totals, averages and the cap all
stay exact until the very end; only the final payment is rounded. Averages are exact in binary
anyway (an integer divided by 4), and the UI shows them to two decimals.

## Flow

```
SetupBoard → [SetupFactionBan] → SetupFaction → SetupPreferenceBid → SetupBuilding → …
```

The ban round is the existing independent `EngineOptions.banPhase` and is orthogonal to this
variant. The pick round is the ordinary `Command.ChooseFaction` one: four players each nominate one
faction, which is where the four factions up for auction come from. A pick is only a nomination —
the auction can and often does give it to somebody else.

Turn order after the auction is the existing rule for every auction variant: `engine.setup` (pick
order) mapped to each faction's final owner.

## Where the code lives

| Layer                                    | File                                                                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolution algorithm (pure, no engine)   | `engine/src/algorithms/preference-split-auction.ts`                                                                                                 |
| Variant + persisted result on the engine | `engine/src/engine.ts` (`AuctionVariant.PreferenceSplit`, `auctionBudget`, `preferenceSplitBids`, `preferenceSplitResult`, `preferenceSplitBudget`) |
| Phase + one-shot resolution              | `engine/src/move/phase.ts` (`phaseSetupPreferenceBid`)                                                                                              |
| Move validation                          | `engine/src/move/setup.ts` (`movePreferenceBid`, plus the 4-player/budget preconditions in `moveInit`)                                              |
| Available command                        | `engine/src/available/setup.ts` (`possiblePreferenceBids`)                                                                                          |
| Server-side sealed bidding               | `supabase/migrations/20260805120000_preference_split_sealed_bids.sql`                                                                               |
| Hosted orchestration                     | `viewer/src/hosted/host.ts` (`submitSealedBid`, `refreshSealedBids`, `sealedBidMove`)                                                               |
| Bid form                                 | `viewer/src/components/PreferenceSplitBid.vue`                                                                                                      |
| Reveal / result                          | `viewer/src/components/PreferenceSplitLog.vue`, `PreferenceSplitSummary.vue`                                                                        |
| In-app rules                             | `viewer/src/components/PreferenceSplitInfo.vue`                                                                                                     |
| Setup                                    | `viewer/src/hosted/new-game.ts`, `viewer/src/hosted/CreateGame.vue`                                                                                 |

## How secrecy is enforced

The engine is client-side and authoritative, and every committed move lands in `public.moves`,
which every seated player can read. That is fine for the Silent Auction, whose bids are entered
strictly one seat at a time, but not here: all four players bid simultaneously.

So in hosted play, a `preferenceBid` move **does not exist** while the auction is open. Submissions
go to `public.auction_sealed_bids` through `submit_sealed_bid()`, behind an RLS policy that returns
a player only their own row until `sealed_bids_complete()` is true. There are no insert/update/
delete policies at all, so a submission can never be edited or withdrawn. The RPC — not the client —
enforces the budget, the whole-number/non-negative bids, one bid per faction and one submission per
seat.

When the last submission lands, any client may call `reveal_sealed_bids()`, which builds the four
move lines **itself, from the stored rows**, appends them to `public.moves` in seat order and moves
the turn pointer, all in one transaction. It is exactly-once by construction: the caller names the
sequence number it expects, `games` is locked for the duration, and a loser of the race gets
`seq_conflict` — which the client already treats as "someone else landed it, resync". A second call
after a successful reveal returns 0.

The only thing the client contributes is `nextSeat`, which it works out by replaying the game
locally with the (now readable) bids applied — the same trust model as `commit_turn`'s own
client-computed `p_next_seat`.

While the auction is open, the only thing any player can learn is **how many seats have submitted**
(`sealed_bid_status()` returns counts and seat numbers, never points). The bid panel polls it every
5s; Realtime cannot help here, precisely because the rows are invisible to everyone else.

**Offline / hot-seat play** has no server, so there is nothing to enforce: the bid form falls back
to an ordinary `preferenceBid` move for the seat on turn, and secrecy is pass-the-device — the same
model the Silent Auction already uses offline.

## Randomness and determinism

The two tiebreaks are the only randomness, and they draw from the game's own **seeded** PRNG
(`engine.map.rng()`), exactly as the Silent Auction's do. Replaying the same move log therefore
always produces the same ranking and the same allocation.

On top of that, the whole outcome is **persisted** on the engine as `preferenceSplitResult` —
ranking, both kinds of tiebreak, every eligibility set, every price and every payment — and
`resolvePreferenceSplitPhase` is a no-op when it is already set. A reload cannot reroll a tie, and
a state restored from JSON never re-runs the auction at all.

The result object is also what the reveal screen renders, so what a player sees is literally the
stored decision, not a re-derivation of it.

## Tests

| File                                                       | Covers                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `engine/src/algorithms/preference-split-auction.spec.ts`   | rounding, submission validation, ranking, allocation, exclusion of assigned players, averages including assigned players' bids, the cap, the 0-bid case, both tiebreaks, determinism, and both end-to-end fixtures (the four-way-tied one and a tie-free one with exact expected payments) |
| `engine/src/preference-split-variant.spec.ts`              | the same through real move logs: full flow, the 4-player and budget preconditions, per-move validation, one submission per player, a configured budget, reload determinism (full replay and `fromData`), and that nothing is derived before the last submission                            |
| `viewer/src/hosted/host.spec.ts`                           | sealed submissions unreadable until the last one lands, resolution on the fourth, exactly-once reveal under two concurrent clients, identical result on reload, the abandoned-last-submitter fallback, and server-side rejection of a wrong total / second submission                      |
| `viewer/src/components/PreferenceSplitBid.spec.ts`         | one input per faction, allocated/remaining, submit disabled off-budget, submits through the sealed backend (never as a move), renders for a seat that is not on turn, post-submission progress, and the offline move fallback                                                              |
| `viewer/src/components/PreferenceSplitLog.spec.ts`         | every bid, totals, averages, the ranking, the step-by-step allocation timeline, and a capped payment explained as capped                                                                                                                                                                   |
| `viewer/src/hosted/new-game.spec.ts`, `CreateGame.spec.ts` | 4-player-only gating, the stored budget and its default, invalid-budget blocking, and dropping the variant on a player-count change                                                                                                                                                        |

## Adding another auction variant later

Nothing here is hardcoded to this mechanism. A new variant needs: a value in `AuctionVariant`, a
`Phase`/`Command` pair, a resolver under `engine/src/algorithms/`, a branch in `phaseSetupFaction`,
an entry in `AUCTION_VARIANT_OPTIONS` (with `playerCounts` if it is restricted), and — only if it
needs simultaneous secret input — reuse of the `auction_sealed_bids` table, which is keyed by game
and seat and holds an opaque `bids` JSON payload, not anything specific to this variant.
