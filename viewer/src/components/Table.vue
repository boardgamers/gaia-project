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
        class="info-table-dropdown"
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
import { UiMode } from "../store";

@Component
export default class Table extends Vue {
  get engine(): Engine {
    return this.$store.state.data;
  }

  get orderedPlayers(): Player[] {
    return orderedPlayers(this.engine);
  }

  get infoTables(): InfoTable[] {
    return infoTables(this.engine, this.orderedPlayers, this.uiMode);
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

  get uiMode(): UiMode {
    return this.$store.state.preferences.uiMode;
  }
}
</script>
<style lang="scss">
.info-table {
  width: auto;
  margin: 2px !important;
  font-size: 17px;
  text-align: center !important;

  th,
  td,
  .cell {
    height: 27px !important;
    min-width: 16px;
  }
  th,
  td {
    padding: 0 !important;
  }
  .cell {
    padding: 2px;
  }
}

.info-table-dropdown {
  width: auto;
  height: 28px !important;
  padding: 1px !important;
  font-size: 18px !important;
}

.break {
  flex-basis: 100%;
  height: 0;
}
</style>
