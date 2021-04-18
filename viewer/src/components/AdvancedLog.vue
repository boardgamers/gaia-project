<template>
  <div v-if="gameData.phase !== 'setupInit'">
    <div class="d-flex" style="justify-content: center">
      <b-form-radio-group checked="recent" @change="setScope">
        <b-form-radio value="recent">Recent</b-form-radio>
        <b-form-radio value="all">Everything</b-form-radio>
      </b-form-radio-group>
      <b-form-radio-group :checked="placement" @change="setPlacement">
        <b-form-radio value="top">Top</b-form-radio>
        <b-form-radio value="bottom">Bottom</b-form-radio>
        <b-form-radio value="off">Don't show log</b-form-radio>
      </b-form-radio-group>
    </div>
    <table class="table table-hover table-striped table-sm" v-if="placement !== 'off'">
      <tbody>
        <tr class="major-event" v-if="gameData.phase === 'endGame'">
          <td colspan="3">Game Ended</td>
        </tr>
        <tr
          v-for="(event, i) in history"
          :key="history.length - i"
          :style="`background-color: ${event.color}; color: ${event.textColor}`"
        >
          <td>{{ event.round }}.{{ event.turn }}</td>
          <td v-if="event.phase === 'roundStart'" class="major-event">Round {{ event.round }}</td>
          <td v-else-if="event.phase === 'roundIncome'" class="phase-change">Income phase</td>
          <td v-else-if="event.phase === 'roundGaia'" class="phase-change">Gaia phase</td>
          <td v-else-if="event.phase === 'roundMove'" class="phase-change">Move phase</td>
          <td v-else-if="event.phase === 'endGame'" class="phase-change">End scoring</td>
          <td v-else>{{ event.move }}</td>
          <td style="width: 1px; white-space: nowrap">
            <div v-for="(change, i) in event.changes" v-html="change.source" :key="i" />
          </td>
          <td style="width: 1px; white-space: nowrap">
            <div v-for="(change, i) in event.changes" v-html="change.changes" :key="i" />
          </td>
        </tr>
        <tr class="major-event">
          <td colspan="3" v-if="scope === 'recent'">Click "Everything" to expand</td>
          <td colspan="3" v-else>Game Started</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script lang="ts">
import Vue from "vue";
import {Component, Prop} from "vue-property-decorator";
import Engine from "@gaia-project/engine";
import {LogPlacement} from "../data";
import {HistoryEntry, LogScope, makeHistory} from "../data/log";

@Component
export default class AdvancedLog extends Vue {
  private scope: LogScope = "recent"

  @Prop()
  currentMove?: string;

  setScope(scope: LogScope) {
    this.scope = scope;
  }

  get placement(): LogPlacement {
    return this.$store.state.gaiaViewer.preferences.logPlacement;
  }

  setPlacement(placement: LogPlacement) {
    this.$store.state.gaiaViewer.preferences.logPlacement = placement;
  }

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get history(): HistoryEntry[] {
    return makeHistory(this.gameData, this.$store.getters["gaiaViewer/recentMoves"], this.scope, this.currentMove);
  }
};
</script>

<style lang="scss" scoped>
.major-event {
  font-weight: bold;
}

.phase-change {
  font-style: italic;
}
</style>
