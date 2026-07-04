<template>
  <b-modal id="silent-auction-info" size="lg" title="How the Silent Auction works" ok-only>
    <div class="silent-auction-info">
      <p>
        Instead of just picking a faction, this game assigns factions through a 3-step process, then an automatic
        auction resolves who gets what:
      </p>
      <ol>
        <li><b>Ban</b> - each player, in turn, bans one faction. Banned factions are out for the rest of the game.</li>
        <li>
          <b>Pick</b> - each player, in turn, picks one of the remaining factions. This is just a starting point -
          the auction below can still hand it to someone else.
        </li>
        <li>
          <b>Bid</b> - every player privately enters the most Victory Points they're willing to lose to end up with
          each picked faction. Bid 0 on your favorite; bid higher numbers on factions you'd only accept at a
          discount. Nobody sees anyone else's bids.
        </li>
      </ol>
      <p>
        Once everyone has submitted, the game runs an automatic auction: think of it as everyone bidding out loud,
        one increment at a time, in turn order, forever raising their bid on whichever faction currently gives them
        the best deal (their bid minus the current price) - until nobody wants to move anymore. If you're ever
        outbid, you jump to bidding on your next-best option. You always end up with exactly the faction that gives
        you the best value <i>you</i> can still get, and you never pay more than the price needed to win it - which
        is usually far less than your maximum bid.
      </p>
      <p class="text-muted small">
        Ties (equally good options) are broken by: (1) raising a bid that's already contested rather than starting
        fresh on an untouched faction, (2) preferring the faction you personally picked, (3) otherwise at random.
        Turn order for the game itself follows pick order: whoever ends up with the first-picked faction goes
        first, and so on.
      </p>

      <h6 class="mt-4">Example</h6>
      <p>
        Three players pick Itars, Taklons, and Xenos. Here's what everyone secretly bid, and what actually happens:
      </p>
      <b-table small bordered :items="exampleBids" :fields="['faction', 'Player A', 'Player B', 'Player C']" />
      <p class="small">
        A's top choice is Itars (bids 15 for it) but is also fine with Taklons (bids 10) or Xenos for free (bids 0).
        B leans toward Itars too, with Taklons as a solid second choice. C only really wants Itars, worth a modest 7.
      </p>
      <b-table
        small
        bordered
        :items="exampleResult"
        :fields="['faction', 'winner', 'price', { key: 'why', label: 'Why' }]"
      />
      <p class="small text-muted">
        Notice A doesn't win Itars even after briefly being its top bidder - once B and C's bids passed what Itars
        was worth to A, A was happier taking Taklons for just 2 VP than paying more to keep Itars. That's the whole
        point: everyone ends up wherever gives <i>them</i> the best deal, automatically.
      </p>
    </div>
  </b-modal>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class SilentAuctionInfo extends Vue {
  exampleBids = [
    { faction: "Itars", "Player A": 15, "Player B": 15, "Player C": 7 },
    { faction: "Taklons", "Player A": 10, "Player B": 8, "Player C": 0 },
    { faction: "Xenos", "Player A": 0, "Player B": 5, "Player C": 0 },
  ];

  exampleResult = [
    { faction: "Itars", winner: "Player B", price: 8, why: "highest value once A backed off to Taklons" },
    { faction: "Taklons", winner: "Player A", price: 2, why: "better deal for A than paying more for Itars" },
    { faction: "Xenos", winner: "Player C", price: 0, why: "C's only remaining option worth taking" },
  ];
}
</script>
