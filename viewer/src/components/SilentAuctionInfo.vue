<template>
  <b-modal id="silent-auction-info" size="lg" title="How the Silent Auction works" ok-only>
    <div class="silent-auction-info">
      <p>
        Factions are not simply picked here, they are auctioned.
        <b>A bid is the most Victory Points you are willing to pay to play that faction</b>, and the winner's price is
        subtracted from their final score. So bid <b>high on the faction you want most</b>, and <b>0</b> on one you
        would only take if it were free.
      </p>
      <ol class="mb-2">
        <li><b>Ban</b> &mdash; in seat order, every player bans one faction. Banned factions are out for the game.</li>
        <li>
          <b>Pick</b> &mdash; in seat order, every player picks one of the factions left. Those picks are the only
          factions in the game, one per player. A pick only nominates a faction, it does not reserve it.
        </li>
        <li>
          <b>Bid</b> &mdash; privately enter a max bid (0&ndash;40 VP) for <i>every</i> picked faction, including your
          own. Nothing is revealed until everyone has submitted.
        </li>
      </ol>
      <p class="mb-2">Then the auction resolves itself. Every faction starts unowned at price 0:</p>
      <ul class="mb-2">
        <li>Your <b>deal</b> on a faction is your bid for it minus what it would cost you right now.</li>
        <li>An unowned faction costs 0. One another player holds costs its current price + 1.</li>
        <li>
          Players take turns in seat order: if you already hold your best deal you pass, otherwise you take your best
          deal at that cost, and whoever you bumped off gets to respond on their next turn.
        </li>
        <li>Once every player passes in a row it is over, and each holder keeps their faction at the price reached.</li>
      </ul>
      <p>
        So you end up with the best deal still open to you, and you pay only enough to outbid the next player who wanted
        it &mdash; <b>never more than you bid</b>, and usually a lot less.
      </p>
      <p class="text-muted small">
        Equally good deals are broken by (1) a faction someone already holds over an untouched one, (2) the faction you
        picked yourself, (3) at random. Turn order follows pick order: whoever ends up with the first-picked faction
        plays first.
      </p>

      <h6 class="mt-4 mb-2">A full example</h6>
      <p class="small mb-2">
        Players A, B and C each ban a faction, then pick Itars, Taklons and Xenos in that order. Their secret bids:
      </p>
      <b-table small bordered class="small" :items="exampleBids" :fields="bidFields" />
      <p class="small mb-2">The auction then runs to the end &mdash; this is the whole log, nothing left out:</p>
      <b-table small bordered responsive class="small" :items="exampleSteps" :fields="stepFields" />
      <b-table small bordered class="small" :items="exampleResult" :fields="resultFields" />
      <p class="small text-muted mb-0">
        A picked Itars and bid 6 for it, yet ends up with Taklons: once Itars cost more than 3, free Taklons was the
        better deal for A. B wanted Itars most (7) and got it &mdash; for 3 VP, not 7. Nobody paid their maximum.
      </p>
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
