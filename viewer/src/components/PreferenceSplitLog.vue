<template>
  <!-- The reveal screen. Only ever rendered from a resolved auction (`preferenceSplitResult` is
       written in one go, when the last submission lands), so there is no state here in which some
       bids are shown and others are not. -->
  <div v-if="result" class="preference-split-log">
    <h5 v-if="!hideTitle">Preference Split Auction</h5>

    <p class="text-muted small mb-2">
      Everyone split {{ result.budget }} bid points across the four factions, in secret and at the same time. Factions
      were then ranked by their total, awarded top-first to the highest bidder still without one, and priced at the
      faction's average - never above the winner's own bid.
    </p>

    <h6>Every bid</h6>
    <b-table small bordered :items="bidRows" :fields="bidFields" />

    <h6>Totals, averages and the resolved ranking</h6>
    <b-table small bordered :items="rankRows" :fields="rankFields" />

    <h6>How each faction was awarded</h6>
    <ol class="preference-split-log__timeline">
      <li v-for="step in timeline" :key="step.faction">
        <b>{{ step.faction }}</b> &mdash; {{ step.headline }}
        <div class="small text-muted">{{ step.detail }}</div>
        <div v-if="step.tiebreak" class="small text-warning">{{ step.tiebreak }}</div>
      </li>
    </ol>

    <h6>Result</h6>
    <b-table small bordered :items="resultRows" :fields="resultFields" />
  </div>
</template>

<script lang="ts">
import Engine, { Faction, PlayerEnum, PreferenceSplitResult } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";

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

  get bidFields() {
    return ["faction", ...this.result.players.map((player) => this.playerLabel(player)), "total", "average"];
  }

  get bidRows() {
    // In the game's own pick order rather than the resolved ranking - this table is the raw
    // submissions, and the ranking gets its own table right below it.
    return (this.gameData.setup ?? []).map((faction: Faction) => {
      const summary = this.result.factions.find((f) => f.faction === faction);
      const row: Record<string, string> = { faction: this.factionLabel(faction) };
      for (const bid of summary?.bids ?? []) {
        row[this.playerLabel(bid.player)] = String(bid.points);
      }
      row.total = String(summary?.total ?? "-");
      row.average = formatPrice(summary?.average ?? 0);
      return row;
    });
  }

  rankFields = [
    { key: "rank", label: "#" },
    { key: "faction", label: "Faction" },
    { key: "total", label: "Total bid" },
    { key: "average", label: "Average price" },
    { key: "tiebreak", label: "Tiebreak" },
  ];

  get rankRows() {
    return this.result.factions.map((summary) => ({
      rank: summary.rank,
      faction: this.factionLabel(summary.faction),
      total: summary.total,
      average: formatPrice(summary.average),
      tiebreak:
        summary.tiedWith.length > 0
          ? `random, tied on ${summary.total} with ${summary.tiedWith.map((f) => this.factionLabel(f)).join(", ")}`
          : "-",
    }));
  }

  /** The step-by-step story of the resolution: who was still in the running, who won, and exactly
   * how the price was arrived at - including the cap when it actually bit. */
  get timeline() {
    return this.result.allocations.map((allocation) => {
      const capped = allocation.winnerBid < allocation.basePrice;
      const price = formatPrice(allocation.basePrice);
      return {
        faction: this.factionLabel(allocation.faction),
        headline: `${this.playerLabel(allocation.winner)} wins it with a bid of ${allocation.winnerBid}, and pays ${
          allocation.payment
        } VP`,
        detail: capped
          ? `Still in the running: ${allocation.eligible.map((p) => this.playerLabel(p)).join(", ")}. ` +
            `The average price was ${price}, but nobody pays more than they bid, so it was capped at ` +
            `${allocation.winnerBid} and rounded to ${allocation.payment}.`
          : `Still in the running: ${allocation.eligible.map((p) => this.playerLabel(p)).join(", ")}. ` +
            `The average of all four bids was ${price}, under the winner's own ${allocation.winnerBid}, ` +
            `so that is the price - rounded to ${allocation.payment}.`,
        tiebreak:
          allocation.tiedPlayers.length > 0
            ? `Random tiebreak: ${allocation.tiedPlayers.map((p) => this.playerLabel(p)).join(" and ")} all bid ${
                allocation.winnerBid
              }.`
            : "",
      };
    });
  }

  resultFields = [
    { key: "faction", label: "Faction" },
    { key: "winner", label: "Winner" },
    { key: "bid", label: "Their bid" },
    { key: "base", label: "Average" },
    { key: "raw", label: "Capped price" },
    { key: "payment", label: "Pays (VP)" },
  ];

  get resultRows() {
    return this.result.allocations.map((allocation) => ({
      faction: this.factionLabel(allocation.faction),
      winner: this.playerLabel(allocation.winner),
      bid: allocation.winnerBid,
      base: formatPrice(allocation.basePrice),
      raw: formatPrice(allocation.rawPayment),
      payment: allocation.payment,
    }));
  }
}
</script>

<style lang="scss" scoped>
.preference-split-log__timeline {
  padding-left: 1.2rem;
  margin-bottom: 1rem;

  li {
    margin-bottom: 0.4rem;
  }
}
</style>
