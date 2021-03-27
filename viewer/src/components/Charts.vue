<template>
  <div class="gaia-viewer-modal">
    <div>
      <div class="d-flex" style="justify-content: center">
        <svg
          v-for="family in families"
          :key="`family${family.family}`"
          height="40"
          viewBox="-1.5 -1.5 4 4"
          width="40"
          class="pointer"
          @click="selectFamily(family.family)"
        >
          <Resource
            transform="scale(0.1)"
            :kind="family.resourceIcon"
            :count="family.resourceIconQuantity != null ? family.resourceIconQuantity : 1"
            :class="['chart-resource', 'pointer', { selected: chartFamily === family.family }]"
          />
        </svg>
      </div>
      <div class="d-flex" style="justify-content: center">
        <div
          style="width: 40px; height: 40px"
          @click="selectKind('bar')"
          :class="['bar-chart-icon', 'pointer', { selected: chartKind === 'bar' }]"
        />
        <div
          style="width: 40px; height: 40px"
          @click="selectKind('line')"
          :class="['line-chart-icon', 'pointer', { selected: chartKind === 'line' }]"
        />
        <svg
          width="40"
          height="40"
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
          height="40"
          viewBox="-1.5 -1.5 4 4"
          width="40"
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
          height="40"
          viewBox="-1.5 -1.5 4 4"
          width="40"
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
          v-for="planet in planets"
          :key="planet"
          height="40"
          viewBox="-1.5 -1.5 4 4"
          width="40"
          :class="['pointer', 'chart-circle', { selected: chartKind === planet }]"
          @click="selectKind(planet)"
        >
          <circle :r="1" :class="['player-token', 'planet-fill', planet]" />
        </svg>
        <svg
          v-for="steps in terraformingSteps"
          :key="steps"
          height="40"
          viewBox="-1.5 -1.5 4 4"
          width="40"
          :class="['pointer', 'chart-circle', { selected: chartKind === steps }]"
          @click="selectKind(steps)"
        >
          <circle :r="1" :class="['player-token', 'planet-fill', terraformingStepsPlanet(steps)]" />
        </svg>
        <svg
          v-for="researchField in researchFields"
          :key="researchField"
          height="40"
          viewBox="-1.5 -1.5 4 4"
          width="40"
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
    </div>
    <div id="tooltip" />
    <canvas id="graphs" />
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from "vue-property-decorator";
import { ChartFamily, chartPlayerOrder } from "../logic/charts";
import {
  newSimpleBarChart,
  newSimpleLineChart,
  planetsForSteps,
  simpleChartFactory,
  SimpleChartKind,
  simpleChartTypes,
  SimpleSourceFactory,
  TerraformingSteps,
} from "../logic/simple-charts";
import { newVictoryPointsBarChart, newVictoryPointsLineChart } from "../logic/victory-point-charts";
import PlayerCircle from "./PlayerCircle.vue";
import BuildingImage from "./Building.vue";
import Engine, { Building, Planet, PlayerEnum, ResearchField, Resource } from "@gaia-project/engine";
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

type ChartKind = "line" | "bar" | PlayerEnum | SimpleChartKind;

@Component({
  components: { PlayerCircle, BuildingImage },
})
export default class Charts extends Vue {
  private chartFamily: ChartFamily = ChartFamily.vp;
  private chartKind: ChartKind = "bar";
  private chart: Chart;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get families(): SimpleSourceFactory<any>[] {
    return Object.values(ChartFamily)
      .map(f => f == ChartFamily.vp ? { family: "vp", resourceIcon: "vp" } as SimpleSourceFactory<any> : simpleChartFactory(f));
  }

  get players(): PlayerEnum[] {
    return chartPlayerOrder(this.gameData);
  }

  get resourceKinds(): Resource[] {
    return simpleChartTypes(this.chartFamily, ChartFamily.resources, ChartFamily.freeActions);
  }

  get buildings(): Building[] {
    return simpleChartTypes(this.chartFamily, ChartFamily.buildings);
  }

  get researchFields(): ResearchField[] {
    return simpleChartTypes(this.chartFamily, ChartFamily.research);
  }

  get planets(): Planet[] {
    return simpleChartTypes(this.chartFamily, ChartFamily.planets);
  }

  get terraformingSteps(): TerraformingSteps[] {
    return simpleChartTypes(this.chartFamily, ChartFamily.terraforming);
  }

  terraformingStepsPlanet(steps: TerraformingSteps): Planet {
    return planetsForSteps(steps, this.gameData.player(this.players[0]).planet)[0];
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
    if (this.chartFamily === ChartFamily.vp) {
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

.chart-resource.selected text {
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
