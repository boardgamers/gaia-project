<template>
  <div class="silent-auction-log">
    <h5 v-if="!hideTitle">Silent Auction</h5>

    <h6>Bans</h6>
    <b-table small bordered :items="bans" :fields="['player', 'faction']" />

    <h6>Picks</h6>
    <b-table small bordered :items="picks" :fields="['player', 'faction']" />

    <h6>Bids</h6>
    <b-table small bordered :items="bidRows" :fields="bidFields" />

    <h6>Resolution</h6>
    <b-table small bordered :items="steps" :fields="['step', 'player', 'faction', 'result']" />

    <h6>Result</h6>
    <b-table small bordered :items="results" :fields="['faction', 'winner', 'price', 'turnOrder']" />
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import Engine, { Faction, PlayerEnum } from "@gaia-project/engine";
import { factionName } from "../data/factions";

@Component
export default class SilentAuctionLog extends Vue {
  /** The summary banner's modal is already titled "Silent Auction"; the statistics tab keeps the
   * heading, since a tab strip alone doesn't title the panel below it clearly enough. */
  @Prop({ default: false, type: Boolean })
  hideTitle: boolean;

  get gameData(): Engine {
    return this.$store.state.data;
  }

  private playerLabel(player: PlayerEnum): string {
    const pl = this.gameData.players[player];
    return pl?.name || `Player ${player + 1}`;
  }

  private factionLabel(faction: Faction): string {
    return faction ? factionName(faction) : "-";
  }

  get bans() {
    // The ban phase runs once per player, in seat order, with no skipping - bannedFactions[i] is
    // always the faction seat i banned.
    return this.gameData.bannedFactions.map((faction, i) => ({
      player: this.playerLabel(i as PlayerEnum),
      faction: this.factionLabel(faction),
    }));
  }

  get picks() {
    // Likewise, setup[i] is the faction seat i originally picked (before the auction may have
    // reassigned it to someone else).
    return this.gameData.setup.map((faction, i) => ({
      player: this.playerLabel(i as PlayerEnum),
      faction: this.factionLabel(faction),
    }));
  }

  get bidFields() {
    return ["faction", ...this.gameData.players.map((pl) => this.playerLabel(pl.player as PlayerEnum))];
  }

  get bidRows() {
    return this.gameData.setup.map((faction) => {
      const row: Record<string, string> = { faction: this.factionLabel(faction) };
      for (const pl of this.gameData.players) {
        const bid = this.gameData.silentAuctionBids.find((b) => b.player === pl.player && b.faction === faction);
        row[this.playerLabel(pl.player as PlayerEnum)] = bid ? String(bid.max) : "-";
      }
      return row;
    });
  }

  get steps() {
    return this.gameData.silentAuctionLog.map((step, i) => ({
      step: i + 1,
      player: this.playerLabel(step.player),
      faction: this.factionLabel(step.faction),
      result: step.skipped
        ? "skipped (already leading)"
        : `bids ${step.price}${step.tiebreak ? ` (tiebreak: ${step.tiebreak})` : ""}`,
    }));
  }

  get results() {
    // turnOrderAfterSetupAuction is built by mapping `setup` in order to each faction's current
    // owner, so the Nth faction in `setup` always corresponds to the Nth turn-order slot.
    return this.gameData.setup.map((faction, i) => {
      const winner = this.gameData.players.find((pl) => pl.faction === faction);
      return {
        faction: this.factionLabel(faction),
        winner: winner ? this.playerLabel(winner.player as PlayerEnum) : "-",
        price: winner ? winner.data.bid : "-",
        turnOrder: i + 1,
      };
    });
  }
}
</script>
