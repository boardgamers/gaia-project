<template>
  <div class="gaia-viewer-modal">
    <div class="d-flex" style="justify-content: center">
      <div
        style="width: 70px; height: 80px"
        @click="goTo('bar')"
        :class="['bar-chart-icon', 'pointer', { selected: chartKind === 'bar' }]"
      />
      <div
        style="width: 70px; height: 80px"
        @click="goTo('line')"
        :class="['line-chart-icon', 'pointer', { selected: chartKind === 'line' }]"
      />
      <svg
        width="80"
        height="80"
        viewBox="-1.5 -1.5 4 4"
        v-for="index in players"
        :key="index"
        class="pointer"
        @click="goTo(index)"
      >
        <PlayerCircle
          :player="gameData.player(index)"
          :index="index"
          :class="['chart-player', { selected: chartKind === index }]"
          chart
        />
      </svg>
    </div>
    <div id="tooltip" />
    <canvas id="graphs" />
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from "vue-property-decorator";
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

type ChartKind = "line" | "bar" | PlayerEnum;

@Component({
  components: { PlayerCircle },
})
export default class Charts extends Vue {
  private chartKind: ChartKind = "bar";
  private chart: Chart;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get players(): PlayerEnum[] {
    return chartPlayerOrder(this.gameData);
  }

  mounted() {
    this.loadChart();
  }

  goTo(kind: ChartKind) {
    this.chartKind = kind;
  }

  @Watch("chartKind")
  loadChart() {
    if (this.chart) {
      this.chart.destroy();
    }

    const data = this.gameData;
    const canvas = document.getElementById("graphs") as HTMLCanvasElement;
    if (this.chartKind === "bar") {
      this.chart = new Chart(canvas, newBarChart(data, canvas));
    } else if (this.chartKind === "line") {
      this.chart = new Chart(canvas, newLineChart(data, canvas, PlayerEnum.All));
    } else {
      this.chart = new Chart(canvas, newLineChart(data, canvas, this.chartKind));
    }
  }
}
</script>

<style lang="scss">
.chart-player > circle {
  stroke-width: 0.06px !important;
}

.chart-player.selected > circle {
  stroke-width: 0.16px !important;
  stroke: var(--highlighted);
}

.line-chart-icon,
.bar-chart-icon {
  background-color: black;
  mask-size: 50% 50%;
  mask-repeat: no-repeat;
  mask-position: center;

  transition: background-color 0.2s ease;

  &.selected {
    background-color: var(--highlighted);
  }
}

.line-chart-icon {
  mask-image: url("../assets/resources/line-chart.svg");
}

.bar-chart-icon {
  mask-image: url("../assets/resources/bar-chart.svg");
}

#tooltip {
  background-color: #000;
  color: #fff;
  position: absolute;
}
</style>
