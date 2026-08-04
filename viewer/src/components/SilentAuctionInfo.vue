<template>
  <b-modal id="silent-auction-info" size="lg" title="How the Silent Auction works" ok-only>
    <div class="silent-auction-info">
      <p>
        Every faction here is auctioned. <b>Your bid is the most Victory Points you will pay to play that faction</b> -
        highest on the one you want most, <b>0</b> on one you'd only take for free. The winner's price comes off their
        final score.
      </p>
      <ol class="mb-3">
        <li><b>Ban</b> &mdash; one ban each, in seat order. Banned factions are out for the game.</li>
        <li>
          <b>Pick</b> &mdash; one pick each, in seat order. Those are the only factions in the game, one per player. A
          pick nominates a faction, it doesn't reserve it.
        </li>
        <li>
          <b>Bid</b> &mdash; a secret max bid (0&ndash;40 VP) on <i>every</i> picked faction, your own included. Nothing
          is revealed until all bids are in.
        </li>
      </ol>

      <div class="deal-box">
        <div class="deal-box__title">
          Your <i>deal</i> on a faction = your bid &minus; what it would cost you right now
        </div>
        <p class="mb-1">A faction nobody holds costs <b>0</b>. One another player holds costs its <b>price + 1</b>.</p>
        <p class="mb-0">
          You bid 6 on Itars, 4 on Taklons. Unheld, Itars costs 0 &mdash; a deal of <b>6</b>. Once B holds it at 3,
          taking it costs 4, so your deal there is only <b>2</b>, while free Taklons is still a deal of <b>4</b>, and
          now your best.
        </p>
      </div>

      <p>
        The rest follows from that. Players take turns in seat order, and
        <b>you always take the faction giving you your best deal</b>, paying that cost and bumping whoever held it - or
        you pass, if you already hold it. When everyone passes in a row the auction ends and each holder keeps their
        faction at the price reached. <b>You never pay more than you bid</b>, and usually much less.
      </p>
      <p class="text-muted small">
        Equally good deals are broken by (1) a faction someone already holds over an untouched one, (2) the faction you
        picked yourself, (3) at random. Turn order follows pick order: whoever ends up with the first-picked faction
        plays first.
      </p>

      <h6 class="example-heading">The whole thing, start to finish</h6>
      <p class="small mb-2">A, B and C pick Itars, Taklons and Xenos, in that order. Their secret bids:</p>
      <b-table small bordered class="small" :items="exampleBids" :fields="bidFields" />
      <p class="small mb-2">Every step that follows:</p>
      <b-table small bordered responsive class="small" :items="exampleSteps" :fields="stepFields" />
      <b-table small bordered class="small mb-0" :items="exampleResult" :fields="resultFields" />
    </div>
  </b-modal>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class SilentAuctionInfo extends Vue {
  bidFields = [{ key: "faction", label: "Faction" }, "A", "B", "C"];

  // Bids, steps and prices below are the real output of resolveSilentAuction() for these bids with
  // seat order A, B, C - keep them in sync if the algorithm's tie-breaks or costs ever change.
  exampleBids = [
    { faction: "Itars", A: 6, B: 7, C: 3 },
    { faction: "Taklons", A: 4, B: 3, C: 0 },
    { faction: "Xenos", A: 0, B: 2, C: 0 },
  ];

  stepFields = [
    { key: "step", label: "#" },
    { key: "player", label: "Player" },
    { key: "faction", label: "Faction" },
    { key: "action", label: "Action" },
    { key: "why", label: "Why" },
  ];

  exampleSteps = [
    { step: 1, player: "A", faction: "Itars", action: "takes at 0", why: "unowned, and Itars is A's biggest bid" },
    {
      step: 2,
      player: "B",
      faction: "Itars",
      action: "takes at 1",
      why: "deal of 6, vs 3 for Taklons and 2 for Xenos",
    },
    { step: 3, player: "C", faction: "Itars", action: "takes at 2", why: "deal of 1, and C's other bids are 0" },
    {
      step: 4,
      player: "A",
      faction: "Taklons",
      action: "takes at 0",
      why: "Itars now costs 3 (deal 3), free Taklons is a deal of 4",
    },
    {
      step: 5,
      player: "B",
      faction: "Itars",
      action: "takes at 3",
      why: "deal of 4, still better than Taklons or Xenos at 2",
    },
    {
      step: 6,
      player: "C",
      faction: "Xenos",
      action: "takes at 0",
      why: "Itars would cost 4 and Taklons 1, both worse than free Xenos",
    },
    { step: 7, player: "A", faction: "Taklons", action: "passes", why: "already holds their best deal" },
    { step: 8, player: "B", faction: "Itars", action: "passes", why: "already holds their best deal" },
    { step: 9, player: "C", faction: "Xenos", action: "passes", why: "everyone passed in a row, so the auction ends" },
  ];

  resultFields = [
    { key: "faction", label: "Faction" },
    { key: "winner", label: "Winner" },
    { key: "pays", label: "Pays (VP)" },
    { key: "turnOrder", label: "Turn order" },
  ];

  exampleResult = [
    { faction: "Itars", winner: "B", pays: 3, turnOrder: "1st" },
    { faction: "Taklons", winner: "A", pays: 0, turnOrder: "2nd" },
    { faction: "Xenos", winner: "C", pays: 0, turnOrder: "3rd" },
  ];
}
</script>

<style lang="scss" scoped>
.deal-box {
  margin-bottom: 1rem;
  padding: 0.6rem 0.85rem;
  border: 1px solid rgba(23, 162, 184, 0.45);
  border-left-width: 4px;
  border-radius: 0.25rem;
  background: rgba(23, 162, 184, 0.1);
}

.deal-box__title {
  margin-bottom: 0.4rem;
  font-weight: 600;
}

.deal-box p {
  font-size: 0.9rem;
}

// Hairline break between the explanation and the worked example - a bare h6 renders at body size
// here, so nothing else marks where one ends and the other begins.
.example-heading {
  margin-top: 1.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(128, 128, 128, 0.35);
  font-weight: 600;
}
</style>
