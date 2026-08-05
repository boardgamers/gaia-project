<template>
  <b-modal
    id="preference-split-info"
    size="lg"
    title="How the Preference Split Auction works"
    ok-only
    dialog-class="gaia-viewer-modal"
  >
    <div class="preference-split-info">
      <p>
        Four players, four factions, and one fixed pot of <b>{{ budget }} bid points</b> each.
        <b>You split your whole {{ budget }} across the four factions</b> - as lopsided or as even as you like - and
        everybody does it at the same time, in secret. Nothing at all is revealed until the last submission is in, and
        then the whole thing resolves on its own. There is no second round and nothing left to decide.
      </p>

      <ol class="mb-3">
        <li>
          <b>Split</b> &mdash; put your {{ budget }} points on the four factions. Whole numbers, 0 is allowed, and the
          four have to add up to exactly {{ budget }}. How much you put somewhere <i>is</i> how much you want it.
        </li>
        <li><b>Rank</b> &mdash; factions are sorted by the total everyone bid on them, most-wanted first.</li>
        <li>
          <b>Award</b> &mdash; going down that list, each faction goes to whoever bid most on it among the players who
          don't have one yet. Win a faction and you're out of the running for the rest.
        </li>
        <li>
          <b>Pay</b> &mdash; the price is the <b>average</b> of all four bids on that faction. Always. Your own bid
          decides <i>which</i> faction you get, never what it costs. The payment comes off your final score.
        </li>
        <li><b>Ties</b> &mdash; equal totals and equal bids are separated automatically, at random.</li>
      </ol>

      <div class="split-box">
        <div class="split-box__title">Why the price is always the average</div>
        <p class="mb-1">
          The average is what the <i>table</i> thought the faction was worth, not what you offered - so a faction
          everybody wants is expensive whoever ends up with it, and one nobody else rated is cheap even if you loved it.
        </p>
        <p class="mb-0">
          That means you <b>can</b> pay more than you bid. It is meant to: without it, rate two factions almost equally,
          lose the one you edged ahead on, and you would pick up the other for <b>nothing</b> - a faction the whole
          table valued, free, purely because your own number on it happened to be low. Your bids say which faction you
          want most, not how little you would like to pay.
        </p>
      </div>

      <p class="text-muted small">
        This is not a "highest bidder pays their bid" auction and not a sealed second-price one: nobody outbids anybody,
        nobody reacts to anybody, and the price never comes from any single player's number - not even the winner's.
      </p>

      <h6 class="example-heading">A worked example, start to finish</h6>
      <p class="small mb-2">Four players split 40 points each. Their secret splits:</p>
      <b-table small bordered class="small" :items="exampleBids" :fields="bidFields" />
      <p class="small mb-2">Totals and averages, from all four bids on each faction:</p>
      <b-table small bordered class="small" :items="exampleTotals" :fields="totalFields" />
      <p class="small mb-2">Awarded top-total first, always to the highest bidder still without a faction:</p>
      <b-table small bordered responsive class="small mb-0" :items="exampleSteps" :fields="stepFields" />
    </div>
  </b-modal>
</template>

<script lang="ts">
import { DEFAULT_PREFERENCE_SPLIT_BUDGET } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class PreferenceSplitInfo extends Vue {
  /** The game's actual budget, so the explanation matches the numbers on the bid form. */
  @Prop({ default: DEFAULT_PREFERENCE_SPLIT_BUDGET, type: Number })
  budget: number;

  bidFields = [{ key: "faction", label: "Faction" }, "A", "B", "C", "D"];

  // The same numbers as the deterministic fixture in
  // engine/src/algorithms/preference-split-auction.spec.ts - keep them in sync if the rules change.
  exampleBids = [
    { faction: "Itars", A: 20, B: 16, C: 2, D: 0 },
    { faction: "Taklons", A: 12, B: 14, C: 6, D: 4 },
    { faction: "Xenos", A: 6, B: 8, C: 10, D: 11 },
    { faction: "Terrans", A: 2, B: 2, C: 22, D: 25 },
  ];

  totalFields = [
    { key: "faction", label: "Faction" },
    { key: "total", label: "Total bid" },
    { key: "average", label: "Average price" },
    { key: "rank", label: "Rank" },
  ];

  exampleTotals = [
    { faction: "Terrans", total: 51, average: "12.75", rank: "1st" },
    { faction: "Itars", total: 38, average: "9.5", rank: "2nd" },
    { faction: "Taklons", total: 36, average: "9", rank: "3rd" },
    { faction: "Xenos", total: 35, average: "8.75", rank: "4th" },
  ];

  stepFields = [
    { key: "step", label: "#" },
    { key: "faction", label: "Faction" },
    { key: "winner", label: "Goes to" },
    { key: "why", label: "Why" },
    { key: "pays", label: "Pays" },
  ];

  exampleSteps = [
    {
      step: 1,
      faction: "Terrans",
      winner: "D",
      why: "highest bid on it (25), everyone still eligible",
      pays: "13 VP (12.75, its average)",
    },
    {
      step: 2,
      faction: "Itars",
      winner: "A",
      why: "20 beats B's 16 and C's 2; D is already out",
      pays: "10 VP (9.5, its average)",
    },
    {
      step: 3,
      faction: "Taklons",
      winner: "B",
      why: "14 beats C's 6; A and D are out",
      pays: "9 VP (9, its average)",
    },
    {
      step: 4,
      faction: "Xenos",
      winner: "C",
      why: "only C is left - D's 11 no longer counts for winning it",
      pays: "9 VP (8.75, its average)",
    },
  ];
}
</script>

<style lang="scss" scoped>
.split-box {
  margin-bottom: 1rem;
  padding: 0.6rem 0.85rem;
  border: 1px solid rgba(23, 162, 184, 0.45);
  border-left-width: 4px;
  border-radius: 0.25rem;
  background: rgba(23, 162, 184, 0.1);
}

.split-box__title {
  margin-bottom: 0.4rem;
  font-weight: 600;
}

.split-box p {
  font-size: 0.9rem;
}

// Same hairline separator SilentAuctionInfo uses between the explanation and the worked example.
.example-heading {
  margin-top: 1.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(128, 128, 128, 0.35);
  font-weight: 600;
}
</style>
