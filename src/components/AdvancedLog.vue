<template>
  <div v-if="data.phase !== 'setupInit'">
    <table class="table table-hover table-striped table-sm">
      <!-- <thead>
        <tr>
          <th scope="col">Log</th>
          <th scope="col">Victory points</th>
        </tr>
      </thead> -->
      <tbody>
        <tr class="major-event" v-if="data.phase === 'endGame'"><td colspan=3>Game Ended</td></tr>
        <tr v-for="event in history">
          <td v-if="event.entry.round" class="major-event">Round {{event.entry.round}}</td>
          <td v-else-if="event.entry.phase==='roundIncome'" class="phase-change">Income phase</td>
          <td v-else-if="event.entry.phase==='roundGaia'" class="phase-change">Gaia phase</td>
          <td v-else-if="event.entry.phase==='endGame'" class="phase-change">End scoring</td>
          <td v-else>{{event.move || data.players[event.entry.player].faction}}</td>
          <td style="width: 1px; white-space: nowrap;">
            <div v-for="(changes, source) in event.entry.changes" v-html="source === 'undefined' ? '&nbsp;' : source" />
          </td>
          <td style="width: 1px; white-space: nowrap;">
            <div v-for="(changes, source) in event.entry.changes">
              {{Object.keys(changes).map(key => `${changes[key]}${key}`).join(', ')}}
            </div>
          </td>
        </tr>
        <tr class="major-event"><td colspan=3>Game Started</td></tr>
      </tbody>
    </table>
  </div>
</template>
<script lang="ts">

import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import Engine, {LogEntry} from '@gaia-project/engine';

@Component({
  computed: {
    data() {
      return this.$store.state.gaiaViewer.data;
    },
    history(): Array<{move: string, entry: LogEntry}> {
      const ret = [];
      let advancedLogIndex = 0;
      let nextLogEntry = this.data.advancedLog[advancedLogIndex];

      const bumpLog = () => {
        advancedLogIndex += 1;
        nextLogEntry = this.data.advancedLog[advancedLogIndex];
      }

      this.data.moveHistory.forEach((move, i) => {
        while (nextLogEntry && (nextLogEntry.move === undefined || nextLogEntry.move < i)) {
          if (nextLogEntry.player === undefined || !!nextLogEntry.changes) {
            ret.push({entry: nextLogEntry});
          }
          bumpLog();
        }
        const entry = {move, entry: {} as LogEntry};
        if (nextLogEntry && nextLogEntry.move === i) {
          entry.entry = nextLogEntry;
          bumpLog();
        }
        ret.push(entry);
        while (nextLogEntry && nextLogEntry.move === undefined) {
          if (nextLogEntry.player === undefined || !!nextLogEntry.changes) {
            ret.push({entry: nextLogEntry});
          }
          bumpLog();
        }
      });
      
      ret.reverse();
      return ret;
    }
  }
})
export default class AdvancedLog extends Vue {
}

</script>

<style lang="scss" scoped>

.major-event {
  font-weight: bold;
}

.phase-change {
  font-style: italic;
}
</style>