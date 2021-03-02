<template>
  <div class="turn-order">
    <h5>Turn order</h5>
    <svg viewBox="-1.2 -1.2 12.5 4">
      <PlayerCircle
        v-for="(player, index) in turnOrder"
        :key="index"
        :player="player"
        :index="index"
        :on-click="() => {}"
        :transform="`translate(${index * 2.5})`"
      />
      <PlayerCircle
        v-for="(player, index) in passedPlayers"
        :key="'p-' + index"
        :player="player"
        :index="index"
        :on-click="() => {}"
        :transform="`translate(${(index + 1 + turnOrder.length) * 2.5})`"
        style="opacity: 0.5"
      />
    </svg>
  </div>
</template>
<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import Engine, { Player, Phase } from "@gaia-project/engine";
import PlayerCircle from "./PlayerCircle.vue";
import { phaseBeforeSetupBuilding } from "../logic/utils";

@Component({
  components: { PlayerCircle },
})
export default class TurnOrder extends Vue {
  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
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
</style>
