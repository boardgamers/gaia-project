<template>
  <div class="gaia-viewer-modal">
    <div style="flex-direction: row; display: flex">
      <div @click="toggleType">
        <svg viewBox="-10 0 90 60" width="70" height="80">
          <image
            v-if="lineChart"
            xlink:href="../assets/resources/bar-chart.svg"
            transform="translate(1.5, 1) scale(0.1)"
            class="pointer"
          />
          <image
            v-else
            xlink:href="../assets/resources/line-chart.svg"
            transform="translate(1.5, 1) scale(0.1)"
            class="pointer"
          />
        </svg>
      </div>
      <div id="player-selection" v-if="lineChart">
        <span v-for="index in players" :key="index" @click="selectPlayer(index)">
          <svg :x="(index > 3 ? -1 : index) * 2" y="0" width="80" height="80" viewBox="-1.5 -1.5 4 4">
            <PlayerCircle
              :player="index > 3 ? null : gameData.player(index)"
              :index="index"
              :class="`chart-player ${index === selected ? 'selected' : ''} pointer`"
              translate=""
              chart="true"
            />
          </svg>
        </span>
      </div>
    </div>
    <div id="tooltip" />
    <canvas id="graphs" />
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { chartPlayerOrder, newBarChart, newLineChart } from "../logic/charts";
import PlayerCircle from "./PlayerCircle.vue";
import Engine, { PlayerEnum } from "@gaia-project/engine";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
  LinearScale,
  PointElement,
  BarController,
  BarElement
);

@Component({
  components: { PlayerCircle },
})
export default class Charts extends Vue {
  private selected = PlayerEnum.All;
  private lineChart = false;
  private chart: Chart;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get players(): PlayerEnum[] {
    return [PlayerEnum.All].concat(chartPlayerOrder(this.gameData));
  }

  mounted() {
    this.selectPlayer(PlayerEnum.All);
  }

  toggleType() {
    this.lineChart = !this.lineChart;
    this.selectPlayer(this.selected);
  }

  selectPlayer(player: PlayerEnum) {
    this.selected = player;

    if (this.chart) {
      this.chart.destroy();
    }

    const data = this.gameData;
    const canvas = document.getElementById("graphs") as HTMLCanvasElement;
    if (this.lineChart) {
      this.chart = new Chart(canvas, newLineChart(data, canvas, player));
    } else {
      this.chart = new Chart(canvas, newBarChart(data, canvas));
    }
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

#tooltip {
  background-color: #000;
  color: #fff;
  position: absolute;
}
</style>
