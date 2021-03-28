<template>
  <div class="gaia-viewer-modal">
    <div>
      <div class="d-flex" style="justify-content: center">
        <div
          style="width: 40px; height: 40px"
          @click="selectDisplay('chart')"
          :class="['bar-chart-icon', 'pointer', { selected: chartDisplay === 'chart' }]"
        />
        <div
          style="width: 40px; height: 40px"
          @click="selectDisplay('table')"
          :class="['table-icon', 'pointer', { selected: chartDisplay === 'table' }]"
        />
        <div class="divider" />
        <div class="d-flex align-items-center chart-top-controls" style="justify-content: center">
          <template v-for="family in families">
            <special-action
              v-if="family.family === 'board-actions'"
              :action="[]"
              :key="`family${family.family}`"
              :class="{ selected: chartFamily === family.family }"
              width="25"
              class="pointer mr-2 chart-resource"
              height="25"
              @click="selectFamily(family.family)"
            />
            <svg
              v-else
              :key="`family${family.family}`"
              viewBox="-2 -2 5 4"
              width="50"
              class="pointer"
              @click="selectFamily(family.family)"
            >
              <Resource
                transform="scale(0.15)"
                :kind="family.resourceIcon"
                :class="['chart-resource', { selected: chartFamily === family.family }]"
              />
            </svg>
          </template>
        </div>
      </div>
      <div class="d-flex align-items-center" style="justify-content: center">
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
          width="50"
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
          height="50"
          viewBox="-1.5 -1.5 4 4"
          width="50"
          class="pointer"
          @click="selectKind(res)"
        >
          <Resource
            transform="scale(0.11)"
            :kind="res"
            :class="['chart-resource', 'pointer', { selected: chartKind === res }]"
          />
        </svg>
        <svg
          v-for="building in buildings"
          :key="building"
          height="50"
          viewBox="-1.5 -1.5 4 4"
          width="50"
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
          height="50"
          viewBox="-1.5 -1.5 4 4"
          width="50"
          :class="['pointer']"
          @click="selectKind(researchField)"
        >
          <polygon
            points="-7.5,3 -3,7.5 3,7.5 7.5,3 7.5,-3 3,-7.5 -3,-7.5 -7.5,-3"
            transform="scale(0.11)"
            :class="['research-tile', researchField, { selected: chartKind === researchField }]"
          />
        </svg>
      </div>
    </div>
    <div id="tooltip" />
    <canvas id="graphs" v-show="chartDisplay === 'chart'" />
    <b-table
      striped
      bordered
      small
      responsive="true"
      hover
      v-if="chartDisplay === 'table'"
      :items="tableItems(tableData)"
      :fields="tableHeader(tableData)"
      :caption="tableData.options.plugins.title.text"
    >
    </b-table>
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
import SpecialAction from "./SpecialAction.vue";
import Engine, { Building, Planet, PlayerEnum, ResearchField, Resource } from "@gaia-project/engine";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
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

type ChartDisplay = "table" | "chart";
type ChartKind = "line" | "bar" | PlayerEnum | SimpleChartKind;

const rowHeader = {
  key: "Name",
  isRowHeader: true,
  sortable: true,
};

@Component({
  components: { PlayerCircle, BuildingImage, SpecialAction },
})
export default class Charts extends Vue {
  private chartDisplay: ChartDisplay = "chart";
  private chartFamily: ChartFamily = ChartFamily.vp;
  private chartKind: ChartKind = "bar";
  private chart: Chart;
  private tableData: ChartConfiguration<any>;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get families(): SimpleSourceFactory<any>[] {
    return Object.values(ChartFamily).map((f) =>
      f == ChartFamily.vp ? ({ family: "vp", resourceIcon: "vp" } as SimpleSourceFactory<any>) : simpleChartFactory(f)
    );
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

  selectDisplay(display: ChartDisplay) {
    this.chartDisplay = display;
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

  @Watch("chartDisplay")
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
        this.newChart(canvas, newVictoryPointsBarChart(data, canvas));
      } else if (this.chartKind === "line") {
        this.newChart(canvas, newVictoryPointsLineChart(data, canvas, PlayerEnum.All));
      } else {
        this.newChart(canvas, newVictoryPointsLineChart(data, canvas, this.chartKind as PlayerEnum));
      }
    } else {
      if (this.chartKind === "bar") {
        this.newChart(canvas, newSimpleBarChart(this.chartFamily, data, canvas));
      } else if (this.chartKind === "line") {
        this.newChart(canvas, newSimpleLineChart(this.chartFamily, data, canvas, PlayerEnum.All));
      } else {
        this.newChart(canvas, newSimpleLineChart(this.chartFamily, data, canvas, this.chartKind));
      }
    }
  }

  private newChart(canvas: HTMLCanvasElement, config: ChartConfiguration<any>) {
    if (this.chartDisplay == "chart") {
      this.chart = new Chart(canvas, config);
    } else {
      this.tableData = config;
    }
  }

  tableHeader(data: ChartConfiguration<any>): any[] {
    return [rowHeader as any].concat(...data.data.datasets.map(s => ({ key: s.label, sortable: true })));
  }

  tableItems(data: ChartConfiguration<any>): any[] {
    const rows = (data.data.datasets[0].data as number[]).map(() => ({}));
    (data.data.labels).forEach((s, index) => {
      rows[index][rowHeader.key] = s;
    });

    function cell(value: any) {
      const val = (typeof value == "number") ? value : value.y;
      if (isNaN(val)) {
        return "";
      }
      return val;
    }

    for (const s of data.data.datasets) {
      (s.data as number[]).forEach((value, index) => {
        rows[index][s.label] = cell(value);
      });
    }
    return rows;
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

.research-tile.selected {
  stroke-width: 0.86px !important;
  stroke: var(--highlighted);
}

.chart-resource.selected {
  filter: drop-shadow(0px 0px 4px rgba(var(--highlighted-rgb), 1));
}

.chart-building,
.table-icon,
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

.table-icon {
  mask-image: url("../assets/resources/table.svg");
}

.line-chart-icon {
  mask-image: url("../assets/resources/line-chart.svg");
}

.bar-chart-icon {
  mask-image: url("../assets/resources/bar-chart.svg");
}

.divider {
  border-right: 2px solid black;
  margin: 16px 4px;
}

#tooltip {
  background-color: #000;
  color: #fff;
  position: absolute;
}

.table.b-table > caption {
  caption-side: top;
  text-align: center;
  font-weight: bold;
}
</style>
