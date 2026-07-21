<template>
  <div class="gaia-viewer-modal stats-window">
    <b-tabs pills nav-class="stats-window__tabs" active-nav-item-class="stats-window__tab--active">
      <b-tab title="Statistics" active>
        <div class="stats-window__toolbar">
          <div class="stats-window__field" v-if="setup != null">
            <label class="stats-window__label">View</label>
            <b-dropdown
              size="sm"
              variant="outline-secondary"
              toggle-class="stats-window__dropdown-toggle"
              :text="chartSelect || 'Choose…'"
            >
              <b-dropdown-item
                v-for="s in selects"
                :key="`select-${s}`"
                @click="selectSelect(s)"
                :active="s === chartSelect"
                >{{ s }}
              </b-dropdown-item>
            </b-dropdown>
          </div>
          <div class="stats-window__field" v-if="types.length > 0">
            <label class="stats-window__label">Breakdown</label>
            <b-dropdown
              size="sm"
              variant="outline-secondary"
              toggle-class="stats-window__dropdown-toggle"
              :text="chartType || 'Choose…'"
            >
              <b-dropdown-item v-for="i in types" :key="`type-${i}`" @click="selectType(i)" :active="i === chartType"
                >{{ i }}
              </b-dropdown-item>
            </b-dropdown>
          </div>
          <div class="stats-window__field" v-if="chartKinds.length > 0">
            <label class="stats-window__label">Details</label>
            <b-dropdown
              size="sm"
              variant="outline-secondary"
              toggle-class="stats-window__dropdown-toggle"
              :text="chartKindLabel"
            >
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
        </div>
        <div id="tooltip" />
        <div class="stats-window__surface">
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
import { Component, Vue } from "vue-property-decorator";
import { ChartGroup, ChartSelect, ChartType } from "../logic/charts/charts";
import PlayerCircle from "./PlayerCircle.vue";
import BuildingImage from "./Building.vue";
import SpecialAction from "./SpecialAction.vue";
import SilentAuctionLog from "./SilentAuctionLog.vue";
import Engine, { PlayerEnum } from "@gaia-project/engine";
import type { ChartConfiguration } from "chart.js";
import {
  barChartKind,
  ChartKind,
  ChartKindDisplay,
  ChartSetup,
  lineChartKind,
  TableMeta,
} from "../logic/charts/chart-factory";
import { tableHeader, tableItems } from "../logic/charts/table";

type Table = { title: string; header: any[]; items: any[]; descriptions: any[] };

@Component({
  components: { PlayerCircle, BuildingImage, SpecialAction, SilentAuctionLog },
})
export default class Charts extends Vue {
  private setup: ChartSetup;
  private chartSelect: ChartSelect = null;
  private chartType: ChartType | null;
  private chartKinds: ChartKindDisplay[][] = [];
  private chartKind: ChartKind = barChartKind;
  private tableKey = 0;
  private table: Table = null;

  get gameData(): Engine {
    return this.$store.state.data;
  }

  // Statistics is table-only now (the chart view was removed) - `type` stays "table" so
  // chart-factory.ts/table.ts (which still build the underlying data both views used to share)
  // keep formatting for that branch.
  get chartStyle() {
    // Statistics is always shown compact now (the toggle was removed - owner request).
    return { type: "table", compact: true, label: "" } as const;
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
    this.selectSelect(ChartGroup.vp);
  }

  isCommonKind() {
    return typeof this.chartKind == "number" || this.chartKind == barChartKind || this.chartKind == lineChartKind;
  }

  selectSelect(s: ChartSelect) {
    if (this.chartSelect != s) {
      this.chartSelect = s;
      // Always open a newly-chosen view on its all-players "Overview" (owner report: picking a view
      // sometimes "did nothing"). Without this, a per-player/over-time Details selection from the
      // previous view would carry over - so the new view opened on a single player's drill-down
      // (e.g. "Victory Points of Gleens") instead of the overview, which looks blank when that
      // leftover player has little data for the new metric. The Details dropdown visibly resets to
      // Overview too.
      this.chartKind = barChartKind;
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
    // No canvas to resolve CSS custom properties against now that the chart view is gone - table
    // formatting never used raw "--foo" colors anyway, so passing colors through unchanged is enough.
    const colorLookup = (color: string): string => color;

    if (this.chartKind === barChartKind) {
      const config = this.setup.newBarChart(this.chartStyle, factory, data, colorLookup);
      this.buildTable(config.chart, config.table);
    } else if (this.chartKind === lineChartKind) {
      this.buildTable(this.setup.newLineChart(this.chartStyle, factory, data, PlayerEnum.All, colorLookup));
    } else {
      this.buildTable(this.setup.newLineChart(this.chartStyle, factory, data, this.chartKind, colorLookup));
    }
  }

  private buildTable(config: ChartConfiguration<any>, tableMeta?: TableMeta) {
    this.table = {
      title: config.options.plugins.title.text,
      header: tableHeader(this.chartStyle, config, tableMeta),
      items: tableItems(config, tableMeta),
      descriptions: tableMeta?.descriptions,
    };
    this.tableKey++;
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
    background: var(--ui-surface-muted);
    border: 1px solid var(--ui-border);
    border-radius: 0.5rem;
  }

  .stats-window__field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stats-window__label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ui-text-muted);
    margin-bottom: 0;
  }

  .stats-window__dropdown-toggle {
    min-width: 9rem;
    text-align: left;
  }

  .stats-window__surface {
    background: var(--ui-surface);
    border: 1px solid var(--ui-border);
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
  background-color: var(--ui-surface-raised);
  color: var(--ui-text);
  border: 1px solid var(--ui-border-strong);
  position: absolute;
}

.chart-table {
  margin-bottom: 0;

  .table.b-table > caption {
    caption-side: top;
    text-align: center;
    font-weight: bold;
    color: var(--ui-text);
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--ui-surface-muted);
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
