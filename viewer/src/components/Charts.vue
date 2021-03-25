<template>
  <div class="gaia-viewer-modal">
    <div class="d-flex" style="justify-content: center">
      <div
        style="width: 70px; height: 80px"
        @click="selectFamily('vp')"
        :class="['vp-family-icon', 'pointer', { selected: chartFamily === 'vp' }]"
      />
      <div
        style="width: 70px; height: 80px"
        @click="selectFamily('resources')"
        :class="['resource-family-icon', 'pointer', { selected: chartFamily === 'resources' }]"
      />
      <div class="divider" />
      <div
        style="width: 70px; height: 80px"
        @click="selectKind('bar')"
        :class="['bar-chart-icon', 'pointer', { selected: chartKind === 'bar' }]"
      />
      <div
        style="width: 70px; height: 80px"
        @click="selectKind('line')"
        :class="['line-chart-icon', 'pointer', { selected: chartKind === 'line' }]"
      />
      <svg
        width="80"
        height="80"
        viewBox="-1.5 -1.5 4 4"
        v-for="index in players"
        :key="index"
        class="pointer"
        @click="selectKind(index)"
      >
        <PlayerCircle
          :player="gameData.player(index)"
          :index="index"
          :class="['chart-player', { selected: chartKind === index }]"
          chart
        />
      </svg>
      <svg
        v-for="res in resourceKinds"
        :key="res"
        height="80"
        viewBox="-1.5 -1.5 4 4"
        width="80"
        class="pointer"
        @click="selectKind(res)"
      >
        <Resource
          transform="scale(0.1)"
          :kind="res"
          :count="1"
          :class="['chart-resource', 'pointer', { selected: chartKind === res }]"
        />
      </svg>
    </div>
    <div id="tooltip" />
    <canvas id="graphs" />
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from "vue-property-decorator";
import {
  chartPlayerOrder,
  newVictoryPointsBarChart,
  newVictoryPointsLineChart,
  newResourcesBarChart,
  newResourcesLineChart, resourceSources, ResourceKind,
} from "../logic/charts";
import PlayerCircle from "./PlayerCircle.vue";
import Engine, { PlayerEnum, Resource } from "@gaia-project/engine";
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

type ChartFamily = "vp" | "resources"
type ChartKind = "line" | "bar" | PlayerEnum | ResourceKind;

@Component({
  components: { PlayerCircle },
})
export default class Charts extends Vue {
  private chartFamily: ChartFamily = "vp";
  private chartKind: ChartKind = "bar";
  private chart: Chart;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get players(): PlayerEnum[] {
    return chartPlayerOrder(this.gameData);
  }

  get resourceKinds(): ResourceKind[] {
    if (this.chartFamily == "vp") {
      return [];
    }
    return resourceSources.map(s => s.type);
  }

  mounted() {
    this.loadChart();
  }

  selectFamily(family: ChartFamily) {
    this.chartFamily = family;
  }

  selectKind(kind: ChartKind) {
    this.chartKind = kind;
  }

  @Watch("chartFamily")
  @Watch("chartKind")
  loadChart() {
    if (this.chart) {
      this.chart.destroy();
    }

    const data = this.gameData;
    const canvas = document.getElementById("graphs") as HTMLCanvasElement;
    if (this.chartFamily === "vp") {
      if (this.chartKind === "bar") {
        this.chart = new Chart(canvas, newVictoryPointsBarChart(data, canvas));
      } else if (this.chartKind === "line") {
        this.chart = new Chart(canvas, newVictoryPointsLineChart(data, canvas, PlayerEnum.All));
      } else {
        this.chart = new Chart(canvas, newVictoryPointsLineChart(data, canvas, this.chartKind as PlayerEnum));
      }
    } else {
      if (this.chartKind === "bar") {
        this.chart = new Chart(canvas, newResourcesBarChart(data, canvas));
      } else if (this.chartKind === "line") {
        this.chart = new Chart(canvas, newResourcesLineChart(data, canvas, PlayerEnum.All));
      } else {
        this.chart = new Chart(canvas, newResourcesLineChart(data, canvas, this.chartKind));
      }
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
.chart-resource.selected > text {
  fill: var(--highlighted) !important;
}

.vp-family-icon,
.resource-family-icon,
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

.vp-family-icon {
  mask-image: url("../assets/resources/victory-points.svg");
}

.resource-family-icon {
  mask-image: url("../assets/resources/qic.svg");
}

.divider {
  border-right: 1px solid black;
  margin: 16px 4px;
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
