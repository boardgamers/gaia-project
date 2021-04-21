<template>
  <div v-if="gameData.phase !== 'setupInit'">
    <div class="d-flex" style="justify-content: center">
      <b-form-radio-group checked="recent" @change="setScope">
        <b-form-radio value="recent">Recent</b-form-radio>
        <b-form-radio value="all">Everything</b-form-radio>
      </b-form-radio-group>
    </div>
    <table class="table table-hover table-striped table-sm">
      <tbody>
        <tr class="major-event" v-if="gameData.phase === 'endGame'">
          <td colspan="4">Game Ended</td>
        </tr>
        <template v-for="(event, i) in history">
          <tr :key="history.length - i" :style="`background-color: ${event.color}; color: ${event.textColor}`">
            <td v-if="!['setupInit', 'moves-skipped', 'roundStart'].includes(event.phase)" :rowspan="rowSpan(event)">
              {{ event.round }}.{{ event.turn }}
            </td>
            <td v-if="event.phase === 'roundStart'" colspan="2" class="major-event">Round {{ event.round }}</td>
            <td v-else-if="event.phase === 'setupInit'" colspan="2" class="major-event">Game Started</td>
            <td v-else-if="event.phase === 'moves-skipped'" colspan="2" class="major-event">
              Change preferences to expand
            </td>
            <td v-else-if="event.phase === 'roundIncome'" class="phase-change">Income phase</td>
            <td v-else-if="event.phase === 'roundGaia'" class="phase-change">Gaia phase</td>
            <td v-else-if="event.phase === 'roundMove'" class="phase-change">Move phase</td>
            <td v-else-if="event.phase === 'endGame'" class="phase-change">End scoring</td>
            <td v-else :rowspan="rowSpan(event)">{{ event.move }}</td>
            <td v-if="event.changes.length === 0" />
            <td v-if="event.changes.length === 0" />
          </tr>
          <tr
            v-for="(change, j) in event.changes"
            :key="`change${i}-${j}`"
            :class="j === 0 ? 'first-change' : 'changes'"
            :style="`background-color: ${event.color}; color: ${event.textColor}`"
          >
            <td>{{ change.source }}</td>
            <td>{{ change.changes }}</td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
<script lang="ts">
import Vue from "vue";
import {Component, Prop} from "vue-property-decorator";
import Engine from "@gaia-project/engine";
import {HistoryEntry, makeHistory} from "../data/log";

type LogScope = "recent" | "all"

@Component
export default class AdvancedLog extends Vue {
  private scope: LogScope = "recent"

  @Prop()
  currentMove?: string;

  setScope(scope: LogScope) {
    this.scope = scope;
  }

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get history(): HistoryEntry[] {
    return makeHistory(this.gameData, this.$store.getters["gaiaViewer/recentMoves"], this.scope == "recent", this.currentMove);
  }

  rowSpan(entry: HistoryEntry): number {
    if (entry.changes.length > 0) {
      return entry.changes.length + 1;
    }
    return 1;
  }
};
</script>

<style lang="scss">
.major-event {
  font-weight: bold;
  color: black;
}

.phase-change {
  font-style: italic;
}

tr.first-change > td {
  border-bottom: none !important;
}

tr.changes > td {
  border-top: none !important;
}
</style>
