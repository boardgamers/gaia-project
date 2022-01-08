<template>
  <div class="gaia-viewer-modal">
    <div class="d-flex" style="justify-content: center">
      <b-dropdown size="sm" class="mr-2 mb-2" text="Style">
        <b-dropdown-item v-for="(s, i) in chartStyles" :key="`style${i}`" @click="selectStyle(s)"
          >{{ s.label }}
        </b-dropdown-item>
      </b-dropdown>
      <b-dropdown size="sm" class="mr-2 mb-2" text="What">
        <b-dropdown-item v-for="i in families" :key="`family${i}`" @click="selectFamily(i)">{{ i }} </b-dropdown-item>
      </b-dropdown>
      <b-dropdown size="sm" class="mr-2 mb-2" right text="Details">
        <template v-for="(group, index) in kinds">
          <b-dropdown-divider v-if="index > 0" :key="`divider${index}`" />
          <b-dropdown-item v-for="(g, i) in group" :key="`kind${index}${i}`" @click="selectKind(g.kind)"
            >{{ g.label }}
          </b-dropdown-item>
        </template>
      </b-dropdown>
    </div>
    <div id="tooltip" />
    <canvas id="graphs" v-show="chartStyle.type === 'chart'" />
    <!-- :key is necessary to force update -->
    <b-table
      :key="chartStyle.type + chartFamily + chartKind"
      striped
      bordered
      small
      responsive="true"
      hover
      :class="{ compact: chartStyle.compact, 'chart-table': true }"
      v-if="chartStyle.type === 'table'"
      :items="table.items"
      :fields="table.header"
      :caption="table.title"
    >
      <template #cell()="data">
        <span v-html="data.value"></span>
      </template>
    </b-table>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from "vue-property-decorator";
import { ChartFamily, ChartStyleDisplay, vpChartFamily } from "../logic/charts/charts";
import PlayerCircle from "./PlayerCircle.vue";
import BuildingImage from "./Building.vue";
import SpecialAction from "./SpecialAction.vue";
import Engine, { PlayerEnum } from "@gaia-project/engine";
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
import {
  barChartKind,
  ChartKind,
  ChartKindDisplay,
  lineChartKind,
  TableMeta,
  ChartSetup,
} from "../logic/charts/chart-factory";
import { tableHeader, tableItems } from "../logic/charts/table";
import { StatisticsDisplay } from "../data";

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

type Table = { title: string; header: any[]; items: any[] };

@Component({
  components: { PlayerCircle, BuildingImage, SpecialAction },
})
export default class Charts extends Vue {
  // eslint-disable-next-line no-invalid-this
  private chartStyle: ChartStyleDisplay = this.chartStyles[0];
  private chartFamily: ChartFamily = vpChartFamily;
  private chartKind: ChartKind = barChartKind;
  private chart: Chart;
  private table: Table;
  private setup: ChartSetup;

  get gameData(): Engine {
    return this.$store.state.data;
  }

  get chartStyles(): ChartStyleDisplay[] {
    return [
      { type: "chart", label: "Chart", compact: false },
      { type: "table", label: "Table", compact: false },
      { type: "chart", label: "Compact Chart", compact: true },
      { type: "table", label: "Compact Table", compact: true },
    ];
  }

  get families(): ChartFamily[] {
    return this.setup.families;
  }

  get kinds(): ChartKindDisplay[][] {
    return this.setup.kinds(this.gameData, this.chartFamily);
  }

  get flat() {
    return this.$store.state.preferences.flatBuildings;
  }

  created() {
    this.setup = new ChartSetup(this.gameData);
  }

  mounted() {
    const pref = this.$store.state.preferences.statistics as StatisticsDisplay;
    let style = pref === "table" ? 1 : 0;
    if (window.innerWidth < 500) {
      if (pref === "auto") {
        style = 3;
      } else {
        style += 2;
      }
    }
    this.chartStyle = this.chartStyles[style];
    this.loadChart();
  }

  isCommonKind() {
    return typeof this.chartKind == "number" || this.chartKind == barChartKind || this.chartKind == lineChartKind;
  }

  selectStyle(display: ChartStyleDisplay) {
    this.chartStyle = display;
  }

  selectFamily(family: ChartFamily) {
    if (this.chartFamily != family) {
      if (!this.isCommonKind()) {
        this.chartKind = barChartKind;
      }

      this.chartFamily = family;
    }
  }

  selectKind(kind: ChartKind) {
    this.chartKind = kind;
  }

  @Watch("chartStyle")
  @Watch("chartFamily")
  @Watch("chartKind")
  loadChart() {
    const data = this.gameData;
    const canvas = Charts.canvas();

    if (this.chartKind === barChartKind) {
      const config = this.setup.newBarChart(this.chartStyle, this.chartFamily, data, canvas);
      this.newChart(canvas, config.chart, config.table);
    } else if (this.chartKind === lineChartKind) {
      this.newChart(canvas, this.setup.newLineChart(this.chartStyle, this.chartFamily, data, canvas, PlayerEnum.All));
    } else {
      this.newChart(canvas, this.setup.newLineChart(this.chartStyle, this.chartFamily, data, canvas, this.chartKind));
    }
  }

  private static canvas(): HTMLCanvasElement {
    return document.getElementById("graphs") as HTMLCanvasElement;
  }

  private newChart(canvas: HTMLCanvasElement, config: ChartConfiguration<any>, tableMeta?: TableMeta) {
    if (this.chartStyle.type == "chart") {
      if (this.chart) {
        this.chart.destroy();
      }
      this.chart = new Chart(canvas, config);
    } else {
      this.table = {
        title: config.options.plugins.title.text,
        header: tableHeader(canvas, this.chartStyle, config, tableMeta),
        items: tableItems(canvas, config, tableMeta),
      };
    }
  }
}
</script>

<style lang="scss">
@media (min-width: 992px) {
  .modal-xl {
    max-width: 1500px;
  }
}

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

#tooltip {
  background-color: #000;
  color: #fff;
  position: absolute;
}

.chart-table .table.b-table > caption {
  caption-side: top;
  text-align: center;
  font-weight: bold;
}

.chart-table th {
  padding: 0;
}

.chart-table th > span > span,
.chart-table th > div {
  padding: 0.3rem;
  display: block;
}

.chart-table.compact th > span > span,
.chart-table.compact th > div {
  padding: 0;
}

.chart-table td {
  text-align: right;
  vertical-align: middle;
  padding: 0 0.3rem 0 0.3rem;
}

.chart-table td span.totals {
  font-weight: bold;
}
</style>
