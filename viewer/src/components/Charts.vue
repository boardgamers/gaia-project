<template>
  <div class="gaia-viewer-modal">
    <div class="d-flex" style="justify-content: center">
      <b-dropdown size="sm" class="mr-2 mb-2" text="Style">
        <b-dropdown-item v-for="(s, i) in chartStyles" :key="`style${i}`" @click="selectStyle(s)"
          >{{ s.label }}
        </b-dropdown-item>
      </b-dropdown>
      <b-dropdown size="sm" class="mr-2 mb-2" text="Type">
        <b-dropdown-item v-for="i in selects" :key="`select${i}`" @click="selectSelect(i)">{{ i }} </b-dropdown-item>
      </b-dropdown>
      <b-dropdown v-if="types.length > 0" size="sm" class="mr-2 mb-2" text="Sub-Type">
        <b-dropdown-item v-for="i in types" :key="`select${i}`" @click="selectType(i)">{{ i }} </b-dropdown-item>
      </b-dropdown>
      <b-dropdown v-if="setup != null" size="sm" class="mr-2 mb-2" right text="Details">
        <template v-for="(group, index) in chartKinds">
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
      :key="tableKey"
      striped
      bordered
      small
      responsive="true"
      hover
      :class="{ compact: chartStyle.compact, 'chart-table': true }"
      v-if="table != null"
      :items="table.items"
      :fields="table.header"
      :caption="table.title"
    >
      <template #cell()="data">
        <span
          v-b-tooltip.hover
          :title="table.descriptions ? table.descriptions[data.index] : null"
          v-html="data.value"
        ></span>
      </template>
    </b-table>
  </div>
</template>

<script lang="ts">
import {Component, Vue} from "vue-property-decorator";
import {ChartGroup, ChartSelect, ChartStyleDisplay, ChartType} from "../logic/charts/charts";
import PlayerCircle from "./PlayerCircle.vue";
import BuildingImage from "./Building.vue";
import SpecialAction from "./SpecialAction.vue";
import Engine, {PlayerEnum} from "@gaia-project/engine";
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
import {barChartKind, ChartKind, ChartKindDisplay, ChartSetup, lineChartKind, TableMeta,} from "../logic/charts/chart-factory";
import {tableHeader, tableItems} from "../logic/charts/table";
import {StatisticsDisplay} from "../data";

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

type Table = { title: string; header: any[]; items: any[]; descriptions: any[] };

@Component({
  components: { PlayerCircle, BuildingImage, SpecialAction },
})
export default class Charts extends Vue {
  private setup: ChartSetup;
  // eslint-disable-next-line no-invalid-this
  private chartStyle: ChartStyleDisplay = this.chartStyles[0];
  private chartSelect: ChartSelect = null;
  private chartType: ChartType | null;
  private chartKinds: ChartKindDisplay[][] = [];
  private chartKind: ChartKind = barChartKind;
  private tableKey = 0;
  private chart: Chart = null;
  private table: Table = null;

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

  get selects(): ChartSelect[] {
    return this.setup.selects;
  }

  get types(): ChartType[] {
    return this.setup == null ? [] : this.setup.types(this.chartSelect);
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
    this.selectSelect(ChartGroup.vp);
  }

  isCommonKind() {
    return typeof this.chartKind == "number" || this.chartKind == barChartKind || this.chartKind == lineChartKind;
  }

  selectStyle(display: ChartStyleDisplay) {
    this.chartStyle = display;
    this.loadChart();
  }

    selectSelect(s: ChartSelect) {
    if (this.chartSelect != s) {
      this.chartSelect = s;
      this.selectType(this.setup.types(s)?.[0] ?? null, true);
    }
  }

  selectType(type: ChartType | null, force = false) {
    if (this.chartType != type || force) {
      if (!this.isCommonKind()) {
        this.chartKind = barChartKind;
      }

      this.chartType = type;
      this.loadChart();
    }
  }

  selectKind(kind: ChartKind) {
    this.chartKind = kind;
    this.loadChart();
  }

  loadChart() {
    const factory = this.setup.factory(this.chartSelect, this.chartType);
    this.chartKinds = this.setup.kinds(this.gameData, factory);

    const data = this.gameData;
    const isChart = this.chartStyle.type == "chart";
    const colorLookup = (color: string): string => {
      const canvas =  this.canvas();
      return color.startsWith("--") && isChart
        ? window.getComputedStyle(canvas).getPropertyValue(color)
        : color;
    };

    if (this.chartKind === barChartKind) {
      const config = this.setup.newBarChart(this.chartStyle, factory, data, colorLookup);
      this.newChart(config.chart, config.table);
    } else if (this.chartKind === lineChartKind) {
      this.newChart(this.setup.newLineChart(this.chartStyle, factory, data, PlayerEnum.All, colorLookup));
    } else {
      this.newChart(this.setup.newLineChart(this.chartStyle, factory, data, this.chartKind, colorLookup));
    }
  }

  private canvas(): HTMLCanvasElement {
    return document.getElementById("graphs") as HTMLCanvasElement;
  }

  private newChart(config: ChartConfiguration<any>, tableMeta?: TableMeta) {
    if (this.chartStyle.type == "chart") {
      this.destroyChart();
      this.chart = new Chart(this.canvas(), config);
      this.table = null;
    } else {
      this.table = {
        title: config.options.plugins.title.text,
        header: tableHeader(this.chartStyle, config, tableMeta),
        items: tableItems(config, tableMeta),
        descriptions: tableMeta?.descriptions,
      };
      this.tableKey++;
      this.destroyChart();
    }
  }

  private destroyChart() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
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
