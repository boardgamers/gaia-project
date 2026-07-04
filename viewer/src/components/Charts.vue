<template>
  <div class="gaia-viewer-modal stats-window">
    <b-tabs pills nav-class="stats-window__tabs" active-nav-item-class="stats-window__tab--active">
      <b-tab title="Statistics" active>
        <div class="stats-window__toolbar">
          <div class="stats-window__field" v-if="setup != null">
            <label class="stats-window__label">View</label>
            <b-dropdown size="sm" variant="outline-secondary" toggle-class="stats-window__dropdown-toggle" :text="chartSelect || 'Choose…'">
              <b-dropdown-item v-for="s in selects" :key="`select-${s}`" @click="selectSelect(s)" :active="s === chartSelect"
                >{{ s }}
              </b-dropdown-item>
            </b-dropdown>
          </div>
          <div class="stats-window__field" v-if="types.length > 0">
            <label class="stats-window__label">Breakdown</label>
            <b-dropdown size="sm" variant="outline-secondary" toggle-class="stats-window__dropdown-toggle" :text="chartType || 'Choose…'">
              <b-dropdown-item v-for="i in types" :key="`type-${i}`" @click="selectType(i)" :active="i === chartType"
                >{{ i }}
              </b-dropdown-item>
            </b-dropdown>
          </div>
          <div class="stats-window__field" v-if="chartKinds.length > 0">
            <label class="stats-window__label">Details</label>
            <b-dropdown size="sm" variant="outline-secondary" toggle-class="stats-window__dropdown-toggle" :text="chartKindLabel">
              <template v-for="(group, index) in chartKinds">
                <b-dropdown-divider v-if="index > 0" :key="`divider-${index}`" />
                <b-dropdown-item
                  v-for="(g, i) in group"
                  :key="`kind-${index}-${i}`"
                  @click="selectKind(g.kind)"
                  :active="g.kind === chartKind"
                  >{{ g.label }}
                </b-dropdown-item>
              </template>
            </b-dropdown>
          </div>
          <div class="stats-window__spacer" />
          <div class="stats-window__field">
            <label class="stats-window__label">Format</label>
            <div class="stats-window__segmented" role="group" aria-label="Chart or table view">
              <button
                type="button"
                class="stats-window__segment"
                :class="{ 'stats-window__segment--active': !isTable }"
                @click="setTable(false)"
              >
                Chart
              </button>
              <button
                type="button"
                class="stats-window__segment"
                :class="{ 'stats-window__segment--active': isTable }"
                @click="setTable(true)"
              >
                Table
              </button>
            </div>
          </div>
          <div class="stats-window__field stats-window__field--compact">
            <b-form-checkbox switch size="sm" v-model="compact" @change="loadChart">Compact</b-form-checkbox>
          </div>
        </div>
        <div id="tooltip" />
        <div class="stats-window__surface">
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
      </b-tab>
      <b-tab v-if="gameData.silentAuctionLog.length > 0" title="Silent Auction">
        <SilentAuctionLog />
      </b-tab>
    </b-tabs>
  </div>
</template>

<script lang="ts">
import {Component, Vue} from "vue-property-decorator";
import {ChartGroup, ChartSelect, ChartType} from "../logic/charts/charts";
import PlayerCircle from "./PlayerCircle.vue";
import BuildingImage from "./Building.vue";
import SpecialAction from "./SpecialAction.vue";
import SilentAuctionLog from "./SilentAuctionLog.vue";
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

// Global visual polish, applied once - a leaner line weight and a dot-style legend read as more
// current than Chart.js's own defaults (a 3px line and big color-swatch legend keys), without
// touching any dataset's actual data/labels (every chart JSON fixture only snapshots those, not
// styling, so this is safe against the fixture-comparison tests in chart.spec.ts). Left as
// close to Chart.js's own light-background defaults as possible - the surrounding modal is a
// plain white Bootstrap modal, not the game board's dark theme, so no color inversion here.
Chart.defaults.color = "#495057";
Chart.defaults.borderColor = "rgba(0, 0, 0, 0.06)";
Chart.defaults.elements.line.borderWidth = 2;
Chart.defaults.elements.point.radius = 3;
Chart.defaults.elements.point.hoverRadius = 5;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.padding = 12;

type Table = { title: string; header: any[]; items: any[]; descriptions: any[] };

@Component({
  components: { PlayerCircle, BuildingImage, SpecialAction, SilentAuctionLog },
})
export default class Charts extends Vue {
  private setup: ChartSetup;
  private isTable = false;
  private compact = false;
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

  get chartStyle() {
    return { type: this.isTable ? "table" : "chart", compact: this.compact, label: "" } as const;
  }

  get selects(): ChartSelect[] {
    return this.setup.selects;
  }

  get types(): ChartType[] {
    return this.setup == null ? [] : this.setup.types(this.chartSelect);
  }

  get chartKindLabel(): string {
    for (const group of this.chartKinds) {
      const found = group.find((g) => g.kind === this.chartKind);
      if (found) {
        return found.label;
      }
    }
    return "Choose…";
  }

  get flat() {
    return this.$store.state.preferences.flatBuildings;
  }

  created() {
    this.setup = new ChartSetup(this.gameData);
  }

  mounted() {
    const pref = this.$store.state.preferences.statistics as StatisticsDisplay;
    this.isTable = pref === "table";
    this.compact = window.innerWidth < 500;
    this.selectSelect(ChartGroup.vp);
  }

  isCommonKind() {
    return typeof this.chartKind == "number" || this.chartKind == barChartKind || this.chartKind == lineChartKind;
  }

  setTable(table: boolean) {
    if (this.isTable != table) {
      this.isTable = table;
      this.loadChart();
    }
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

.stats-window {
  .stats-window__tabs {
    margin-bottom: 0.75rem;
  }

  .stats-window__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.9rem;
    padding: 0.75rem 0.9rem;
    margin-bottom: 0.9rem;
    background: var(--systemGray6, #f2f2f7);
    border: 1px solid var(--systemGray5, #e5e5ea);
    border-radius: 0.5rem;
  }

  .stats-window__field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stats-window__field--compact {
    justify-content: flex-end;
    padding-bottom: 0.25rem;
  }

  .stats-window__label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--systemGray1, #8e8e93);
    margin-bottom: 0;
  }

  .stats-window__dropdown-toggle {
    min-width: 9rem;
    text-align: left;
  }

  .stats-window__spacer {
    flex: 1 1 auto;
  }

  .stats-window__segmented {
    display: inline-flex;
    border: 1px solid #ced4da;
    border-radius: 0.25rem;
    overflow: hidden;
  }

  .stats-window__segment {
    border: none;
    background: white;
    padding: 0.25rem 0.75rem;
    font-size: 0.8rem;
    line-height: 1.5;
    color: #495057;
    cursor: pointer;

    &:not(:first-child) {
      border-left: 1px solid #ced4da;
    }

    &--active {
      background: #495057;
      color: white;
    }
  }

  .stats-window__surface {
    background: white;
    border: 1px solid var(--systemGray5, #e5e5ea);
    border-radius: 0.5rem;
    padding: 0.75rem;
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

.chart-table {
  margin-bottom: 0;

  .table.b-table > caption {
    caption-side: top;
    text-align: center;
    font-weight: bold;
    color: #495057;
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--systemGray6, #f2f2f7);
    z-index: 1;
  }

  th {
    padding: 0;
  }

  th > span > span,
  th > div {
    padding: 0.3rem;
    display: block;
  }

  &.compact th > span > span,
  &.compact th > div {
    padding: 0;
  }

  td {
    text-align: right;
    vertical-align: middle;
    padding: 0 0.3rem 0 0.3rem;
  }

  td span.totals {
    font-weight: bold;
  }
}
</style>
