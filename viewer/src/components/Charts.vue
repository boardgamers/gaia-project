<template>
  <div class="gaia-viewer-modal">
    <div id="player-selection">
      <span
        v-for="index in players"
        :key="index"
        @click="
          $data.selected = index;
          selectPlayer(index);
        "
      >
        <svg :x="(index > 3 ? -1 : index) * 2" y="0" width="80" height="80" viewBox="-1.5 -1.5 4 4">
          <PlayerCircle
            :player="index > 3 ? null : gameData.player(index)"
            :index="index"
            :class="`chart-player ${index === $data.selected ? 'selected' : ''}`"
            translate=""
            chart="true"
          />
        </svg>
      </span>
    </div>

    <canvas id="graphs" />
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { makeChart, victoryPointDetails, victoryPointSummary } from "../logic/charts";
import PlayerCircle from "./PlayerCircle.vue";
import Engine, { PlayerEnum } from "@gaia-project/engine";
import Chart from "chart.js";


@Component({
  components: { PlayerCircle },
})
export default class Charts extends Vue {

  data() {
    return {
      selected: PlayerEnum.All,
    };
  }

  private chart: Chart;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get players(): PlayerEnum[] {
    return [PlayerEnum.All].concat(this.order());
  }

  private order() {
    return this.gameData.players.map(p => p.player);
  }

  mounted() {
    this.selectPlayer(PlayerEnum.All);
  }

  selectPlayer(player: PlayerEnum) {
    const numbers = player === PlayerEnum.All ? this.order() : [player];
    const data = this.gameData;

    const canvas = document.getElementById("graphs") as HTMLCanvasElement;
    const factories = numbers.length == 1 ?
      victoryPointDetails(data, numbers[0], canvas) :
      numbers.map(n => victoryPointSummary(data, n, canvas));

    if (this.chart) {
      this.chart.destroy();
    }
    this.chart = new Chart(canvas, makeChart(data, factories.filter(f => f != null), player != PlayerEnum.All));
  }
}
</script>

<style lang="scss">
@import "../stylesheets/planets.css";

.player-selection {
  min-height: 100px;
  min-width: 100px;
}

.chart-player.selected > circle {
  stroke-width: 0.16px !important;
  stroke: #2c4;
}

.chart-player > circle {
  stroke-width: 0.06px !important;
}
</style>