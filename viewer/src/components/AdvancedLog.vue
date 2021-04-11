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
          <td colspan="3">Game Ended</td>
        </tr>
        <tr v-for="(event, i) in history" :key="history.length - i" :style="`background-color: ${event.color}`">
          <td>{{ event.round }}.{{ event.turn }}</td>
          <td v-if="event.entry.round" class="major-event">Round {{ event.entry.round }}</td>
          <td v-else-if="event.entry.phase === 'roundIncome'" class="phase-change">Income phase</td>
          <td v-else-if="event.entry.phase === 'roundGaia'" class="phase-change">Gaia phase</td>
          <td v-else-if="event.entry.phase === 'endGame'" class="phase-change">End scoring</td>
          <td v-else>{{ event.move || gameData.players[event.entry.player].faction }}</td>
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
          <td colspan="3" v-if="scope === 'recent'">Click "Everything" to expand</td>
          <td colspan="3" v-else>Game Started</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script lang="ts">
import Vue from "vue";
import {replaceMove} from "../data/log";
import {Component, Prop} from "vue-property-decorator";
import Engine, {Faction, LogEntry} from "@gaia-project/engine";
import {factionLogColors, lightFactionLogColors} from "../graphics/utils";
import {ownTurn} from "../logic/recent";


type ShowLog = "all" | "recent";

type HistoryEntry = { move?: string; entry: LogEntry; round: number; turn: number; color: string };

@Component
export default class AdvancedLog extends Vue {
  private scope: ShowLog = "recent"

  @Prop()
  currentMove?: string;

  setScope(scope: ShowLog) {
    this.scope = scope;
  }

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get history(): Array<HistoryEntry> {
    const offset = this.scope == "recent" ? this.$store.getters["gaiaViewer/recentMoves"].index : 0;

    const ret = [];
    let round = 0;
    let turn = 1;
    let turnFactions: Faction[] = [];
    let advancedLogIndex = 0;
    let nextLogEntry = this.gameData.advancedLog[advancedLogIndex];

    const bumpLog = () => {
      advancedLogIndex += 1;
      nextLogEntry = this.gameData.advancedLog[advancedLogIndex];
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
        faction = this.gameData.players[entry.player].faction;
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

    function addEntry(entry: HistoryEntry) {
      if (advancedLogIndex >= offset) {
        ret.push(entry);
      }
    }

    this.gameData.moveHistory.forEach((move, i) => {
      while (nextLogEntry && (nextLogEntry.move === undefined || nextLogEntry.move < i)) {
        if (nextLogEntry.player === undefined || !!nextLogEntry.changes) {
          addEntry(newEntry());
        }
        bumpLog();
      }
      const entry = newEntry(replaceMove(this.gameData, move), {} as LogEntry);
      if (nextLogEntry && nextLogEntry.move === i) {
        entry.entry = nextLogEntry;
        bumpLog();
      }
      addEntry(entry);
      while (nextLogEntry && nextLogEntry.move === undefined) {
        if (nextLogEntry.player === undefined || !!nextLogEntry.changes) {
          addEntry(newEntry());
        }
        bumpLog();
      }
    });

    if (nextLogEntry && this.currentMove) {
      addEntry(newEntry(replaceMove(this.gameData, this.currentMove)));
    }

    ret.reverse();
    return ret;
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
