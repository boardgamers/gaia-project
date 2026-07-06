<template>
  <div class="turn-order">
    <svg viewBox="-1.2 -1.2 12.5 4" width="250" height="80" style="max-width: 100%">
      <PlayerCircle
        v-for="(player, index) in turnOrder"
        :key="index"
        :player="player"
        :index="index"
        :transform="`translate(${index * 2.5})`"
        :presence-status="presenceFor(player)"
      />
      <PlayerCircle
        v-for="(player, index) in passedPlayers"
        :key="'p-' + index"
        :player="player"
        :index="index"
        :transform="`translate(${(index + 1 + turnOrder.length) * 2.5})`"
        style="opacity: 0.5"
        :presence-status="presenceFor(player)"
      />
    </svg>
  </div>
</template>
<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import Engine, { Player, Phase } from "@gaia-project/engine";
import PlayerCircle from "./PlayerCircle.vue";
import { phaseBeforeSetupBuilding } from "../logic/utils";
import { presenceStatus, PresenceStatus } from "../hosted/presence";

@Component({
  components: { PlayerCircle },
})
export default class TurnOrder extends Vue {
  get gameData(): Engine {
    return this.$store.state.data;
  }

  // Hosted mode only - self-contained/hot-seat play has no "?game=" URL and no accounts to have
  // presence for, so presenceFor() below returns null (no dot) there, unchanged from before.
  get gameId(): string | null {
    return typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("game") : null;
  }

  presenceFor(player: Player): PresenceStatus | null {
    if (!this.gameId || player == null) {
      return null;
    }
    const userId = this.$store.state.seatUsers?.[player.player] ?? null;
    return presenceStatus(this.$store.state.presence, userId, this.gameId);
  }

  get turnOrder(): Player[] {
    const data = this.gameData;
    if (phaseBeforeSetupBuilding(data)) {
      return data.players;
    }
    if (data.phase === Phase.SetupBuilding || data.phase === Phase.SetupBooster) {
      return data.setup.map((faction) => data.players.find((pl) => pl.faction === faction));
    }
    return data.turnOrder.map((player) => data.players[player]);
  }

  get passedPlayers(): Player[] {
    return (this.gameData.passedPlayers ?? []).map((player) => this.gameData.player(player));
  }
}
</script>
<style lang="scss">
.turn-order {
  & > svg {
    max-width: 250px;
  }
}

// The top-banner placement (Game.vue) wants this to read as a header strip, not a floating card.
.turn-order-banner {
  background: linear-gradient(135deg, #1c2b4a 0%, #2f4a7a 100%);
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  display: flex;
  justify-content: center;
}
</style>
