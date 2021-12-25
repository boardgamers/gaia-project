<template>
  <div class="d-flex flex-wrap align-items-end">
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
            <b-th v-for="(h, j) in table.additionalHeader" :key="j" :colspan="h.colspan">
              <TableCell :cells="h.cells" />
            </b-th>
          </b-tr>
        </template>
        <template #head()="data">
          <TableCell :cells="data.field.cells" />
        </template>
        <template #cell()="data">
          <TableCell :cells="data.value" />
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
import Engine, { Player, PlayerEnum, PowerArea, Resource as ResourceEnum } from "@gaia-project/engine";
import { InfoTable, infoTables } from "../logic/info-table";
import { orderedPlayers } from "../data/player";
import { MapMode, MapModeType } from "../data/actions";
import { mapModeTypeOptions } from "../data/stats";
import { UiMode } from "../store";
import { rotate } from "../logic/utils";
import TableCell from "./TableCell.vue";

@Component({
  components: {
    TableCell,
  },
})

export default class Table extends Vue {
  get engine(): Engine {
    return this.$store.state.data;
  }

  get orderedPlayers(): Player[] {
    const players = orderedPlayers(this.engine);
    const s = this.sessionPlayer;
    return s ? this.passedLast(rotate(players, s)) : players;
  }

  passedLast(players: Player[]): Player[] {
    const s = this.sessionPlayer;
    const e = this.engine;
    function passed(p: Player) {
      return (e.passedPlayers || []).includes(p.player);
    }

    if (s && !passed(s)) {
      return players.filter(p => !passed(p)).concat(...players.filter(p => passed(p)));
    }
    return players;
  }

  get sessionPlayer(): Player {
    const player = this.$store.state.player;
    if (player) {
      if (player.index !== undefined) {
        return this.engine.players[player.index];
      }
    }
  }

  get infoTables(): InfoTable[] {
    return infoTables(this.engine, this.orderedPlayers, this.uiMode,
      {
        convertTooltip: (resource, player) => this.convertTooltip(resource, player),
      });
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

  convertTooltip(resource: ResourceEnum | PowerArea, player: PlayerEnum): string | null {
    if (this.engine.currentPlayer == player) {
      return this.$store.state.context.fastConversionTooltips[resource];
    }
  }
}
</script>
<style lang="scss">
.info-table {
  width: auto;
  margin: 2px !important;
  font-size: 17px;

  th,
  td {
    padding: 0 !important;
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
