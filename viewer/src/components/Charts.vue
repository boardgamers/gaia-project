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
      <div
        style="width: 70px; height: 80px"
        @click="selectFamily('buildings')"
        :class="['building-family-icon', 'pointer', { selected: chartFamily === 'buildings' }]"
      />
      <div
        style="width: 70px; height: 80px"
        @click="selectFamily('research')"
        :class="['research-family-icon', 'pointer', { selected: chartFamily === 'research' }]"
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
          :class="['chart-circle', { selected: chartKind === index }]"
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
      <svg
        v-for="building in buildings"
        :key="building"
        height="80"
        viewBox="-1.5 -1.5 4 4"
        width="80"
        :class="['pointer', 'chart-circle', { selected: chartKind === building }]"
        @click="selectKind(building)"
      >
        <circle :r="1.2" style="fill: var(--adv-tech-tile)" />
        <BuildingImage
          faction="gen"
          :building="building"
          :flat="flat"
          transform="scale(0.18)"
          :class="['chart-building']"
        />
      </svg>
      <svg
        v-for="researchField in researchFields"
        :key="researchField"
        height="80"
        viewBox="-1.5 -1.5 4 4"
        width="80"
        :class="['pointer']"
        @click="selectKind(researchField)"
      >
        <polygon
          points="-7.5,3 -3,7.5 3,7.5 7.5,3 7.5,-3 3,-7.5 -3,-7.5 -7.5,-3"
          transform="scale(0.1)"
          :class="['research-tile', researchField]"
        />
        <text
          :class="['research-text', researchField, { selected: chartKind === researchField }]"
          transform="scale(0.1)"
          x="-3"
          y="3"
        >
          1
        </text>
      </svg>
    </div>
    <div id="tooltip" />
    <canvas id="graphs" />
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from "vue-property-decorator";
import { chartPlayerOrder } from "../logic/charts";
import {
  buildingSources,
  newSimpleBarChart,
  newSimpleLineChart,
  researchSources,
  ResourceKind,
  resourceSources,
  SimpleChartFamily,
  SimpleChartKind,
} from "../logic/simple-charts";
import { newVictoryPointsBarChart, newVictoryPointsLineChart } from "../logic/victory-point-charts";
import PlayerCircle from "./PlayerCircle.vue";
import BuildingImage from "./Building.vue";
import Engine, { Building, PlayerEnum, ResearchField } from "@gaia-project/engine";
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
  BarElement,
);

type ChartFamily = "vp" | SimpleChartFamily;
type ChartKind = "line" | "bar" | PlayerEnum | SimpleChartKind;

@Component({
  components: { PlayerCircle, BuildingImage },
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
    if (this.chartFamily == "resources") {
      return resourceSources.sources.map(s => s.type);
    }
    return [];
  }

  get buildings(): Building[] {
    if (this.chartFamily == "buildings") {
      return buildingSources.sources.map(s => s.type);
    }
    return [];
  }

  get researchFields(): ResearchField[] {
    if (this.chartFamily == "research") {
      return researchSources.sources.map(s => s.type);
    }
    return [];
  }

  get flat() {
    return this.$store.state.gaiaViewer.preferences.flatBuildings;
  }

  mounted() {
    this.loadChart();
  }

  isCommonKind() {
    return typeof this.chartKind == "number" || this.chartKind == "bar" || this.chartKind == "line";
  }

  selectFamily(family: ChartFamily) {
    if (this.chartFamily != family) {
      if (!this.isCommonKind()) {
        this.chartKind = "bar";
      }

      this.chartFamily = family;
    }
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
        this.chart = new Chart(canvas, newSimpleBarChart(this.chartFamily, data, canvas));
      } else if (this.chartKind === "line") {
        this.chart = new Chart(canvas, newSimpleLineChart(this.chartFamily, data, canvas, PlayerEnum.All));
      } else {
        this.chart = new Chart(canvas, newSimpleLineChart(this.chartFamily, data, canvas, this.chartKind));
      }
    }
  }
}
</script>

<style lang="scss">
.chart-circle > circle {
  stroke-width: 0.06px !important;
}

.chart-circle.selected > circle {
  stroke-width: 0.16px !important;
  stroke: var(--highlighted);
}

.chart-resource.selected > text {
  fill: var(--highlighted) !important;
}

.research-text {
  &.int,
  &.terra,
  &.nav,
  &.gaia {
    fill: white;
  }
  &.selected {
    fill: var(--highlighted) !important;
  }
}

.vp-family-icon,
.resource-family-icon,
.building-family-icon,
.research-family-icon,
.chart-building,
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

.building-family-icon {
  mask-image: url("../assets/buildings/mine.svg");
}

.research-family-icon {
  mask-image: url("../assets/buildings/research-lab.svg");
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
