<template>
  <div class="gaia-viewer-modal">
    <div class="d-flex" style="justify-content: center">
      <b-dropdown size="sm" class="mr-2 mb-2" text="Style">
        <b-dropdown-item v-for="(s, i) in chartStyles" :key="`style${i}`" @click="selectStyle(s)"
          >{{ s.label }}
        </b-dropdown-item>
      </b-dropdown>
      <b-dropdown size="sm" class="mr-2 mb-2" text="What">
        <b-dropdown-item v-for="i in families" :key="`family${i.name}`" @click="selectFamily(i.family)"
          >{{ i.name }}
        </b-dropdown-item>
      </b-dropdown>
      <b-dropdown size="sm" class="mr-2 mb-2" right text="Details">
        <template v-for="(group, index) in kinds">
          <b-dropdown-divider v-if="index > 0" />
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
      :class="{ compact: chartStyle.compact }"
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
import {Component, Vue, Watch} from "vue-property-decorator";
import {ChartFamily} from "../logic/charts";
import {simpleSourceFactory, SimpleSourceFactory,} from "../logic/simple-charts";
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
import {
  ChartKind,
  ChartKindDisplay,
  ChartStyleDisplay,
  kinds,
  newBarChart,
  newLineChart,
  TableMeta
} from "../logic/chart-factory";
import {tableHeader, tableItems} from "../logic/table";

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

type Table = { title: string; header: any[]; items: any[] }

@Component({
  components: {PlayerCircle, BuildingImage, SpecialAction},
})
export default class Charts extends Vue {
  private chartStyle: ChartStyleDisplay = this.chartStyles[0];
  private chartFamily: ChartFamily = ChartFamily.vp;
  private chartKind: ChartKind = "bar";
  private chart: Chart;
  private table: Table;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get chartStyles(): ChartStyleDisplay[] {
    return [
      {type: "chart", label: "Chart", compact: false},
      {type: "table", label: "Table", compact: false},
      {type: "chart", label: "Compact Chart", compact: true},
      {type: "table", label: "Compact Table", compact: true},
    ];
  }

  get families(): SimpleSourceFactory<any>[] {
    return Object.values(ChartFamily).map((f) =>
      f == ChartFamily.vp ? ({
        family: "vp",
        name: "Victory Points"
      } as SimpleSourceFactory<any>) : simpleSourceFactory(f)
    );
  }

  get kinds(): ChartKindDisplay[][] {
    return kinds(this.gameData, this.chartFamily);
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

  selectStyle(display: ChartStyleDisplay) {
    this.chartStyle = display;
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

  @Watch("chartStyle")
  @Watch("chartFamily")
  @Watch("chartKind")
  loadChart() {
    const data = this.gameData;
    const canvas = this.canvas();

    if (this.chartKind === "bar") {
      const config = newBarChart(this.chartStyle, this.chartFamily, data, canvas);
      this.newChart(canvas, config.chart, config.table);
    } else if (this.chartKind === "line") {
      this.newChart(canvas, newLineChart(this.chartStyle, this.chartFamily, data, canvas, PlayerEnum.All));
    } else {
      this.newChart(canvas, newLineChart(this.chartStyle, this.chartFamily, data, canvas, this.chartKind));
    }
  }

  private canvas(): HTMLCanvasElement {
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
        items: tableItems(canvas, this.chartStyle, config, tableMeta)
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

.table.b-table > caption {
  caption-side: top;
  text-align: center;
  font-weight: bold;
}

.table-sm th {
  padding: 0;
}

.table-sm th > span > span,
.table-sm th > div {
  padding: 0.3rem;
  display: block;
}

div.compact > .table-sm th > span > span,
div.compact > .table-sm th > div {
  padding: 0;
}

.table-sm td {
  text-align: right;
  vertical-align: middle;
  padding: 0 0.3rem 0 0.3rem;
}
</style>
