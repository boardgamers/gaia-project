<template>
  <div class="d-flex flex-wrap">
    <template v-for="(table, i) in infoTables">
      <b-table
        :key="i"
        bordered
        small
        responsive="true"
        hover
        class="info-table"
        :items="table.rows"
        :fields="table.fields"
        :caption="table.caption"
        caption-top
      >
        <template #thead-top>
          <b-tr v-if="table.additionalHeader">
            <b-th
              v-for="(h, j) in table.additionalHeader"
              :key="j"
              :title="h.title"
              v-html="h.label"
              :colspan="h.colspan"
            ></b-th>
          </b-tr>
        </template>
        <template #cell()="data">
          <span v-html="data.value" v-b-tooltip.hover :title="data.title"></span>
        </template>
      </b-table>
      <div v-if="table.break" :key="`${i}break`" class="break" />
    </template>
    <div class="d-flex flex-column align-items-end">
      <div class="mt-auto" />
      <b-form-select
        v-for="p in orderedPlayers"
        :key="`sel${p.player}`"
        :value="selectedMapMode(p.player)"
        :options="mapModeTypeOptions"
        @change="(mode) => toggleMapMode(p.player, mode)"
        style="width: auto; height: 4vmin; font-size: 1.6vmin"
      />
    </div>
  </div>
</template>
<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import Engine, { Player, PlayerEnum } from "@gaia-project/engine";
import { InfoTable, infoTables } from "../logic/info-table";
import { orderedPlayers } from "../data/player";
import { MapMode, MapModeType } from "../data/actions";
import { mapModeTypeOptions } from "../data/stats";

@Component
export default class Table extends Vue {
  get engine(): Engine {
    return this.$store.state.data;
  }

  get orderedPlayers(): Player[] {
    return orderedPlayers(this.engine);
  }

  get infoTables(): InfoTable[] {
    const element = document.getElementById("root") as HTMLCanvasElement;
    return infoTables(element, this.engine, this.orderedPlayers);
  }

  get mapModeTypeOptions() {
    return mapModeTypeOptions;
  }

  selectedMapMode(player: PlayerEnum): MapModeType {
    return this.$store.getters.mapModes.find(m => m.player === player)?.type ?? MapModeType.default;
  }

  toggleMapMode(player: PlayerEnum, mode: MapModeType) {
    this.$store.commit("toggleMapMode", { type: mode, player: player } as MapMode);
  }
}
</script>
<style lang="scss">
.info-table {
  width: auto;
  margin: 2px;
  font-size: 2vmin;
  text-align: center;
}

.info-table th,
.info-table td {
  padding: 0;
  height: 3vmin;
}

.info-table .cell {
  padding: 2px;
}

.break {
  flex-basis: 100%;
  height: 0;
}
</style>
