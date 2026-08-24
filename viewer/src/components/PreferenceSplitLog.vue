<template>
  <!-- The reveal screen. Only ever rendered from a resolved auction (`preferenceSplitResult` is
       written in one go, when the last submission lands), so there is no state here in which some
       bids are shown and others are not. -->
  <section
    v-if="result"
    class="preference-split-log"
    :aria-labelledby="hideTitle ? undefined : 'preference-split-heading'"
  >
    <header v-if="!hideTitle" class="preference-split-log__header">
      <div>
        <span class="preference-split-log__eyebrow">Setup complete</span>
        <h2 id="preference-split-heading">Preference Split summary</h2>
      </div>
      <div class="preference-split-log__metrics" aria-label="Auction totals">
        <span
          ><strong>{{ result.players.length }}</strong> players</span
        >
        <span
          ><strong>{{ result.budget }}</strong> points each</span
        >
        <span
          ><strong>{{ result.factions.length }}</strong> factions</span
        >
      </div>
    </header>

    <section class="preference-section preference-section--results" aria-labelledby="preference-results-heading">
      <div class="preference-section__heading">
        <div>
          <span class="preference-section__eyebrow">Final lineup</span>
          <h3 id="preference-results-heading">Who got what</h3>
        </div>
        <span class="preference-section__hint">Average price, rounded to VP</span>
      </div>

      <ol class="preference-results" aria-label="Final faction allocations">
        <li
          v-for="row in resultRows"
          :key="row.faction"
          class="preference-result-card"
          :style="{ '--preference-accent': row.color }"
        >
          <span class="preference-result-card__rank" :aria-label="`Faction rank ${row.rank}`">{{ row.rank }}</span>
          <span class="preference-result-card__swatch" aria-hidden="true"></span>
          <span class="preference-result-card__identity">
            <strong>{{ row.faction }}</strong>
            <small>{{ row.winner }}</small>
          </span>
          <span class="preference-result-card__bid">Bid {{ row.bid }}</span>
          <span class="preference-result-card__price">
            <strong>{{ row.payment }}</strong>
            <small>VP</small>
          </span>
        </li>
      </ol>

      <div class="preference-rule-strip" aria-label="How Preference Split works">
        <span><strong>1</strong> Split {{ result.budget }} points in secret</span>
        <span><strong>2</strong> Totals rank the factions</span>
        <span><strong>3</strong> Highest eligible bid wins; the table average sets the price</span>
      </div>
    </section>

    <div class="preference-details-grid">
      <section class="preference-section preference-ranking" aria-labelledby="preference-ranking-heading">
        <div class="preference-section__heading">
          <div>
            <span class="preference-section__eyebrow">Market order</span>
            <h3 id="preference-ranking-heading">Faction ranking</h3>
          </div>
          <span class="preference-section__hint">Most wanted first</span>
        </div>

        <ol class="preference-ranking__list">
          <li
            v-for="row in rankRows"
            :key="row.faction"
            class="preference-ranking__row"
            :style="{ '--preference-accent': row.color }"
          >
            <span class="preference-ranking__rank">{{ row.rank }}</span>
            <span class="preference-ranking__faction">
              <span aria-hidden="true"></span>
              <strong>{{ row.faction }}</strong>
            </span>
            <span class="preference-ranking__stat">
              <small>Total</small>
              <strong>{{ row.total }}</strong>
            </span>
            <span class="preference-ranking__stat">
              <small>Average</small>
              <strong>{{ row.average }}</strong>
            </span>
            <small v-if="row.tiebreak !== '-'" class="preference-ranking__tiebreak">{{ row.tiebreak }}</small>
          </li>
        </ol>
      </section>

      <section class="preference-section preference-bids" aria-labelledby="preference-bids-heading">
        <div class="preference-section__heading">
          <div>
            <span class="preference-section__eyebrow">Secret splits revealed</span>
            <h3 id="preference-bids-heading">Every bid</h3>
          </div>
          <span class="preference-section__hint">Winning bid highlighted</span>
        </div>

        <div class="preference-bids__scroll">
          <table>
            <caption class="sr-only">
              Every Preference Split bid, with faction totals, averages and final payments
            </caption>
            <thead>
              <tr>
                <th scope="col">Faction</th>
                <th v-for="player in bidPlayers" :key="player.player" scope="col">{{ player.label }}</th>
                <th scope="col">Total</th>
                <th scope="col">Avg.</th>
                <th scope="col">Paid</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in bidRows" :key="row.faction">
                <th scope="row">
                  <span class="preference-bids__faction" :style="{ '--preference-accent': row.color }">
                    <span aria-hidden="true"></span>{{ row.faction }}
                  </span>
                </th>
                <td
                  v-for="bid in row.bids"
                  :key="bid.player"
                  :class="{ 'preference-bids__winner': bid.winner }"
                  :aria-label="bid.winner ? `${bid.value}, winning bid` : String(bid.value)"
                >
                  {{ bid.value }}<span v-if="bid.winner" aria-hidden="true">&#10003;</span>
                </td>
                <td class="preference-bids__summary">{{ row.total }}</td>
                <td class="preference-bids__summary">{{ row.average }}</td>
                <td class="preference-bids__paid">{{ row.payment }} VP</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="preference-section preference-resolution" aria-labelledby="preference-resolution-heading">
      <div class="preference-section__heading">
        <div>
          <span class="preference-section__eyebrow">How it resolved</span>
          <h3 id="preference-resolution-heading">How each faction was awarded</h3>
        </div>
        <span class="preference-section__hint">Rank order, one allocation at a time</span>
      </div>

      <ol class="preference-split-log__timeline">
        <li
          v-for="step in timeline"
          :key="step.faction"
          class="preference-resolution__step"
          :style="{ '--preference-accent': step.color }"
        >
          <div class="preference-resolution__headline">
            <strong>{{ step.faction }}</strong>
            <span>{{ step.headline }}</span>
          </div>
          <div class="preference-resolution__detail">{{ step.detail }}</div>
          <div v-if="step.tiebreak" class="preference-resolution__tiebreak">{{ step.tiebreak }}</div>
        </li>
      </ol>
    </section>
  </section>
</template>

<script lang="ts">
import Engine, { Faction, PlayerEnum, PreferenceSplitResult } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";
import { factionColor } from "../graphics/utils";

/** Averages are exact but rarely whole; two decimals is enough for a /4 division and matches the
 * rounding rule's own precision. Trailing zeros are dropped so "9" doesn't read as "9.00". */
export function formatPrice(value: number): string {
  return String(Math.round(value * 100) / 100);
}

@Component
export default class PreferenceSplitLog extends Vue {
  /** The summary banner's modal already carries the title; the statistics tab needs its own. */
  @Prop({ default: false, type: Boolean })
  hideTitle: boolean;

  get gameData(): Engine {
    return this.$store.state.data;
  }

  get result(): PreferenceSplitResult | null {
    return this.gameData?.preferenceSplitResult ?? null;
  }

  private playerLabel(player: PlayerEnum): string {
    const pl = this.gameData.players[player];
    return pl?.name || `Player ${(player as number) + 1}`;
  }

  private factionLabel(faction: Faction): string {
    return faction ? factionName(faction) : "-";
  }

  get bidPlayers() {
    return this.result.players.map((player) => ({
      player,
      label: this.playerLabel(player),
    }));
  }

  get bidRows() {
    // Keep the game's original pick order here: this is the raw submission matrix, while the
    // ranked market immediately beside it shows the resolved order.
    return (this.gameData.setup ?? []).map((faction: Faction) => {
      const summary = this.result.factions.find((entry) => entry.faction === faction);
      const allocation = this.result.allocations.find((entry) => entry.faction === faction);

      return {
        faction: this.factionLabel(faction),
        color: factionColor(faction),
        bids: this.result.players.map((player) => {
          const bid = summary?.bids.find((entry) => entry.player === player);
          return {
            player,
            value: bid?.points ?? "-",
            winner: allocation?.winner === player,
          };
        }),
        total: summary?.total ?? "-",
        average: summary ? formatPrice(summary.average) : "-",
        payment: allocation?.payment ?? "-",
      };
    });
  }

  get rankRows() {
    return this.result.factions.map((summary) => ({
      rank: summary.rank,
      faction: this.factionLabel(summary.faction),
      color: factionColor(summary.faction),
      total: summary.total,
      average: formatPrice(summary.average),
      tiebreak:
        summary.tiedWith.length > 0
          ? `Random tiebreak at ${summary.total} with ${summary.tiedWith
              .map((faction) => this.factionLabel(faction))
              .join(", ")}`
          : "-",
    }));
  }

  /** The step-by-step story of the resolution: who was still in the running, who won, and exactly
   * how the price was arrived at - including the unusual case where it exceeds the winner's bid. */
  get timeline() {
    return this.result.allocations.map((allocation) => {
      const price = formatPrice(allocation.basePrice);
      const bids = this.result.factions
        .find((summary) => summary.faction === allocation.faction)
        .bids.map((bid) => bid.points)
        .join(" + ");
      const overBid =
        allocation.payment > allocation.winnerBid
          ? ` That is more than their own bid of ${allocation.winnerBid} - the price is what the table thought the faction was worth, not what the winner happened to bid on it.`
          : "";

      return {
        faction: this.factionLabel(allocation.faction),
        color: factionColor(allocation.faction),
        payment: allocation.payment,
        headline: `${this.playerLabel(allocation.winner)} wins it with a bid of ${allocation.winnerBid}, and pays ${
          allocation.payment
        } VP`,
        detail:
          `Still in the running: ${allocation.eligible.map((player) => this.playerLabel(player)).join(", ")}. ` +
          `Every bid on it was ${bids}, so the average is ${price} - rounded to ${allocation.payment}.` +
          overBid,
        tiebreak:
          allocation.tiedPlayers.length > 0
            ? `Random tiebreak: ${allocation.tiedPlayers
                .map((player) => this.playerLabel(player))
                .join(" and ")} all bid ${allocation.winnerBid}.`
            : "",
      };
    });
  }

  get resultRows() {
    return this.result.allocations.map((allocation) => ({
      faction: this.factionLabel(allocation.faction),
      color: factionColor(allocation.faction),
      rank: allocation.rank,
      winner: this.playerLabel(allocation.winner),
      bid: allocation.winnerBid,
      base: formatPrice(allocation.basePrice),
      payment: allocation.payment,
    }));
  }
}
</script>

<style lang="scss" scoped>
.preference-split-log {
  color: var(--ui-text);
  background: var(--ui-surface) !important;
  border: 1px solid var(--ui-border);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 0.75rem 2rem var(--ui-shadow-soft);
}

.preference-split-log__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 1rem;
  color: var(--ui-banner-text);
  background: linear-gradient(125deg, var(--ui-banner-start), var(--ui-banner-end));

  h2 {
    margin: 0.05rem 0 0;
    font-size: 1.1rem;
    font-weight: 750;
    letter-spacing: -0.01em;
  }
}

.preference-split-log__eyebrow,
.preference-section__eyebrow {
  display: block;
  font-size: 0.63rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  line-height: 1.2;
  text-transform: uppercase;
}

.preference-split-log__eyebrow {
  color: var(--ui-banner-link);
}

.preference-split-log__metrics {
  display: flex;
  gap: 0.4rem;

  span {
    display: flex;
    align-items: baseline;
    gap: 0.22rem;
    padding: 0.3rem 0.48rem;
    color: var(--ui-banner-link);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    font-size: 0.7rem;
    line-height: 1;
  }

  strong {
    color: var(--ui-banner-text);
    font-size: 0.8rem;
  }
}

.preference-section {
  min-width: 0;
  padding: 0.9rem 1rem;
}

.preference-section__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.65rem;

  h3 {
    margin: 0.12rem 0 0;
    font-size: 0.91rem;
    font-weight: 750;
  }
}

.preference-section__eyebrow {
  color: var(--ui-text-subtle);
}

.preference-section__hint {
  color: var(--ui-text-subtle);
  font-size: 0.68rem;
  white-space: nowrap;
}

.preference-results {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 0.55rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.preference-result-card {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.55rem 0.65rem;
  background: linear-gradient(135deg, var(--ui-surface-raised), var(--ui-surface-muted));
  border: 1px solid var(--ui-border);
  border-radius: 0.55rem;
  box-shadow: inset 0 2px 0 var(--preference-accent);
}

.preference-result-card__rank {
  display: grid;
  place-items: center;
  width: 1.55rem;
  height: 1.55rem;
  color: var(--ui-text-muted);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: 50%;
  font-size: 0.72rem;
  font-weight: 800;
}

.preference-result-card__swatch {
  width: 0.68rem;
  height: 0.68rem;
  background: var(--preference-accent);
  border: 1px solid rgba(0, 0, 0, 0.28);
  border-radius: 50%;
  box-shadow: 0 0 0 3px var(--ui-surface);
}

.preference-result-card__identity,
.preference-result-card__price {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.preference-result-card__identity {
  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 0.86rem;
  }

  small {
    color: var(--ui-text-muted);
    font-size: 0.67rem;
  }
}

.preference-result-card__bid {
  padding: 0.18rem 0.35rem;
  color: var(--ui-text-muted);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  font-size: 0.59rem;
  font-weight: 700;
  white-space: nowrap;
}

.preference-result-card__price {
  align-items: flex-end;
  padding-left: 0.5rem;
  border-left: 1px solid var(--ui-border);

  strong {
    font-size: 1rem;
    line-height: 1;
  }

  small {
    margin-top: 0.12rem;
    color: var(--ui-text-subtle);
    font-size: 0.58rem;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
}

.preference-rule-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, auto));
  justify-content: center;
  gap: 0.4rem 1.25rem;
  margin-top: 0.65rem;
  color: var(--ui-text-muted);
  font-size: 0.64rem;

  span {
    display: flex;
    align-items: center;
    gap: 0.34rem;
  }

  strong {
    display: grid;
    place-items: center;
    width: 1.12rem;
    height: 1.12rem;
    flex: 0 0 auto;
    color: var(--ui-text-subtle);
    background: var(--ui-surface-muted);
    border-radius: 50%;
    font-size: 0.57rem;
  }
}

.preference-details-grid {
  display: grid;
  grid-template-columns: minmax(16rem, 0.72fr) minmax(30rem, 1.28fr);
  border-top: 1px solid var(--ui-border);
}

.preference-details-grid > .preference-section + .preference-section {
  border-left: 1px solid var(--ui-border);
}

.preference-ranking__list {
  display: grid;
  gap: 0.35rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.preference-ranking__row {
  display: grid;
  grid-template-columns: auto minmax(4.8rem, 1fr) auto auto;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.42rem 0.5rem;
  background: var(--ui-surface-muted);
  border-radius: 0.42rem;
}

.preference-ranking__rank {
  display: grid;
  place-items: center;
  width: 1.35rem;
  height: 1.35rem;
  color: var(--ui-text-subtle);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: 50%;
  font-size: 0.62rem;
  font-weight: 800;
}

.preference-ranking__faction {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;

  > span {
    width: 0.48rem;
    height: 0.48rem;
    flex: 0 0 auto;
    background: var(--preference-accent);
    border: 1px solid rgba(0, 0, 0, 0.25);
    border-radius: 50%;
  }

  strong {
    overflow: hidden;
    font-size: 0.74rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.preference-ranking__stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;

  small {
    color: var(--ui-text-subtle);
    font-size: 0.52rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  strong {
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
  }
}

.preference-ranking__tiebreak {
  grid-column: 2 / -1;
  color: var(--ui-warning);
  font-size: 0.57rem;
  font-weight: 700;
}

.preference-bids__scroll {
  overflow-x: auto;
  border: 1px solid var(--ui-border);
  border-radius: 0.45rem;
}

.preference-bids table {
  width: 100%;
  min-width: 34rem;
  margin: 0;
  color: var(--ui-text);
  border-collapse: collapse;
  font-size: 0.7rem;

  th,
  td {
    padding: 0.4rem 0.42rem;
    border-bottom: 1px solid var(--ui-border);
  }

  thead th {
    color: var(--ui-text-muted);
    background: var(--ui-surface-muted);
    font-size: 0.61rem;
    font-weight: 750;
    text-align: center;
  }

  thead th:first-child,
  tbody th {
    text-align: left;
  }

  tbody tr:last-child th,
  tbody tr:last-child td {
    border-bottom: 0;
  }

  tbody th {
    font-weight: 700;
  }

  td {
    min-width: 3.3rem;
    color: var(--ui-text-muted);
    text-align: center;
  }
}

.preference-bids__faction {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;

  > span {
    width: 0.48rem;
    height: 0.48rem;
    flex: 0 0 auto;
    background: var(--preference-accent);
    border: 1px solid rgba(0, 0, 0, 0.25);
    border-radius: 50%;
  }
}

.preference-bids td.preference-bids__winner {
  color: var(--ui-success-text);
  background: var(--ui-success-bg);
  font-weight: 800;

  span {
    margin-left: 0.22rem;
    color: var(--ui-success);
    font-size: 0.62rem;
  }
}

.preference-bids td.preference-bids__summary {
  color: var(--ui-text);
  font-weight: 700;
}

.preference-bids td.preference-bids__paid {
  color: var(--ui-text);
  font-weight: 800;
  white-space: nowrap;
}

.preference-resolution {
  border-top: 1px solid var(--ui-border);
}

.preference-split-log__timeline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: 0.45rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.preference-resolution__step {
  min-width: 0;
  padding: 0.48rem 0.55rem;
  background: var(--ui-surface-muted);
  border: 1px solid var(--ui-border);
  border-radius: 0.45rem;
  box-shadow: inset 2px 0 0 var(--preference-accent);
}

.preference-resolution__headline {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 0.3rem;
  font-size: 0.69rem;

  > strong {
    font-size: 0.75rem;
  }

  span {
    color: var(--ui-text-muted);
  }
}

.preference-resolution__detail {
  margin-top: 0.24rem;
  color: var(--ui-text-subtle);
  font-size: 0.6rem;
  line-height: 1.35;
}

.preference-resolution__tiebreak {
  margin-top: 0.2rem;
  color: var(--ui-warning);
  font-size: 0.58rem;
  font-weight: 700;
}

@media (max-width: 920px) {
  .preference-details-grid {
    grid-template-columns: 1fr;
  }

  .preference-details-grid > .preference-section + .preference-section {
    border-top: 1px solid var(--ui-border);
    border-left: 0;
  }
}

@media (max-width: 640px) {
  .preference-split-log__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .preference-split-log__metrics {
    width: 100%;

    span {
      flex: 1 1 0;
      justify-content: center;
      text-align: center;
    }
  }

  .preference-section {
    padding: 0.78rem;
  }

  .preference-section__hint {
    display: none;
  }

  .preference-results,
  .preference-split-log__timeline {
    grid-template-columns: 1fr;
  }

  .preference-rule-strip {
    grid-template-columns: 1fr;
    justify-content: stretch;
    gap: 0.3rem;
  }
}
</style>
