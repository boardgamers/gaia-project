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
        <tr class="major-event" v-if="data.phase === 'endGame'">
          <td colspan="3">Game Ended</td>
        </tr>
        <tr v-for="(event, i) in history" :key="history.length - i" :style="`background-color: ${event.color}`">
          <td>{{ event.round }}.{{ event.turn }}</td>
          <td v-if="event.entry.round" class="major-event">Round {{ event.entry.round }}</td>
          <td v-else-if="event.entry.phase === 'roundIncome'" class="phase-change">Income phase</td>
          <td v-else-if="event.entry.phase === 'roundGaia'" class="phase-change">Gaia phase</td>
          <td v-else-if="event.entry.phase === 'endGame'" class="phase-change">End scoring</td>
          <td v-else>{{ event.move || data.players[event.entry.player].faction }}</td>
          <td style="width: 1px; white-space: nowrap">
            <div
              v-for="(changes, source, i) in event.entry.changes"
              v-html="source === 'undefined' ? '&nbsp;' : source"
              :key="i"
            />
          </td>
          <td style="width: 1px; white-space: nowrap">
            <div v-for="(changes, source, i) in event.entry.changes" :key="i">
              {{
                Object.keys(changes)
                  .map((key) => `${changes[key]}${key}`)
                  .join(", ")
              }}
            </div>
          </td>
        </tr>
        <tr class="major-event">
          <td colspan="3">Game Started</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script lang="ts">
import Vue from "vue";
import {replaceMove} from "../data/log";
import {Component, Prop} from "vue-property-decorator";
import {Faction, LogEntry} from "@gaia-project/engine";
import {factionLogColors, lightFactionLogColors} from "../graphics/utils";
import {ownTurn} from "../logic/recent";

@Component({
  computed: {
    data() {
      return this.$store.state.gaiaViewer.data;
    },
    history(): Array<{ move?: string; entry: LogEntry; round: number; turn: number; color: string }> {
      const ret = [];
      let round = 0;
      let turn = 1;
      let turnFactions: Faction[] = [];
      let advancedLogIndex = 0;
      let nextLogEntry = this.data.advancedLog[advancedLogIndex];

      const bumpLog = () => {
        advancedLogIndex += 1;
        nextLogEntry = this.data.advancedLog[advancedLogIndex];
        if (nextLogEntry?.round) {
          round = nextLogEntry.round;
          turn = 1;
          turnFactions = [];
        }
      };

      const newEntry = (move: string = null, entry: LogEntry = nextLogEntry) => {
        let color: string = null;
        let faction: Faction = null;
        let own = false;
        if (entry.player != null) {
          faction = this.data.players[entry.player].faction;
        } else if (move != null) {
          const command = move.split(" ", 3);
          faction = command[0] as Faction;
          own = ownTurn(move);
        }
        color = own ? factionLogColors[faction] : lightFactionLogColors[faction];
        if (own && faction != null) {
          if (turnFactions.includes(faction)) {
            turn++;
            turnFactions = [];
          }
          turnFactions.push(faction);
        }

        return ({move: move, round: round, turn: turn, entry: entry, color: color});
      };

      this.data.moveHistory.forEach((move, i) => {
        while (nextLogEntry && (nextLogEntry.move === undefined || nextLogEntry.move < i)) {
          if (nextLogEntry.player === undefined || !!nextLogEntry.changes) {
            ret.push(newEntry());
          }
          bumpLog();
        }
        const entry = newEntry(replaceMove(this.data, move), {} as LogEntry);
        if (nextLogEntry && nextLogEntry.move === i) {
          entry.entry = nextLogEntry;
          bumpLog();
        }
        ret.push(entry);
        while (nextLogEntry && nextLogEntry.move === undefined) {
          if (nextLogEntry.player === undefined || !!nextLogEntry.changes) {
            ret.push(newEntry());
          }
          bumpLog();
        }
      });

      if (nextLogEntry && this.currentMove) {
        ret.push(newEntry(replaceMove(this.data, this.currentMove)));
      }

      ret.reverse();
      return ret;
    },
  },
})
export default class AdvancedLog extends Vue {
  @Prop()
  currentMove?: string;
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
