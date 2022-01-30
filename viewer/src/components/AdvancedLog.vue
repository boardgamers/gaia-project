<template>
  <div v-if="engine.phase !== 'setupInit'">
    <div class="d-flex" style="justify-content: center">
      <b-checkbox :checked="scope === 'all'" @change="toggleScope">Show ever<u>y</u>thing</b-checkbox>
      <b-checkbox :checked="hideLog" @change="toggleLog"><u>H</u>ide log until next turn</b-checkbox>
    </div>
    <table class="table table-hover table-striped table-sm">
      <thead v-if="!hideLog" class="table-bordered">
        <td>Turn</td>
        <td>Moves</td>
        <td colspan="2">Changes</td>
        <td v-for="(h, i) in rowHeaders" :key="i" :title="h.title" :style="cellStyle(h)">
          {{ h.shortcut.toUpperCase() }}
        </td>
      </thead>
      <tbody>
        <tr class="major-event" v-if="engine.phase === 'endGame'">
          <td colspan="4">Game Ended</td>
        </tr>
        <template v-for="(event, i) in history">
          <tr
            v-for="j in rowSpan(event)"
            :key="`${i}-${j}`"
            :class="{ 'border-top': j == 0 }"
            :style="`background-color: ${event.color}; color: ${event.textColor}`"
            :role="event.moveIndex ? 'button' : ''"
            @click="event.moveIndex ? replayTo(event.moveIndex) : null"
          >
            <td
              v-if="j === 1 && !['setupInit', 'moves-skipped', 'roundStart'].includes(event.phase)"
              :rowspan="rowSpan(event)"
              class="border-left turn"
            >
              {{ event.round }}.{{ event.turn }}
            </td>
            <td v-if="event.phase === 'roundStart'" colspan="4" class="major-event">Round {{ event.round }}</td>
            <td v-else-if="event.phase === 'setupInit'" colspan="4" class="major-event border-left border-bottom">
              Game Started
            </td>
            <td v-else-if="event.phase === 'moves-skipped'" colspan="4" class="major-event border-left border-bottom">
              Click "Show everything" to expand
            </td>
            <td v-else-if="event.phase === 'roundIncome'" colspan="3" class="phase-change">Income phase</td>
            <td v-else-if="event.phase === 'roundGaia'" colspan="3" class="phase-change">Gaia phase</td>
            <td v-else-if="event.phase === 'roundMove'" colspan="3" class="phase-change">Move phase</td>
            <td v-else-if="event.phase === 'endGame'" colspan="3" class="phase-change">End scoring</td>
            <td v-else-if="j === 1" :rowspan="rowSpan(event)" class="move border-left">
              <div>{{ event.move }}</div>
            </td>
            <td v-if="event.changes.length > 0" :class="[j === 1 ? 'first-change' : 'changes', 'border-left']">
              {{ event.changes[j - 1].source }}
            </td>
            <td v-else-if="event.phase == null" class="border-left" />
            <td v-if="event.changes.length > 0" :class="[j === 1 ? 'first-change' : 'changes']">
              <ResourcesText :content="[parseRewards(event.changes[j - 1].changes)]" />
            </td>
            <td v-else-if="event.phase == null" class="border-right" />
            <td
              v-for="(value, k) in rowValues(event, j)"
              :rowspan="rowSpan(event)"
              :key="k"
              :class="{
                'extended-log': true,
                'border-left': value.leftBorder,
                'border-right': k === rowValues(event, j).length - 1,
                'border-bottom': ['moves-skipped', 'setupInit'].includes(event.phase),
              }"
            >
              {{ value.value }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, { Resource, Reward } from "@gaia-project/engine";
import { HistoryEntry, makeHistory } from "../data/log";
import { cellStyle, logPlayerTables, PlayerColumn } from "../logic/info-table";
import ResourcesText from "./Resources/ResourcesText.vue";
import { parseRewardsForLog } from "../logic/utils";

type LogScope = "recent" | "all";
@Component({
  components: { ResourcesText },
})
export default class AdvancedLog extends Vue {
  private scope: LogScope = "recent";

  @Prop()
  currentMove?: string;

  @Prop()
  hideLog?: boolean;

  mounted() {
    const keyListener = (e) => {
      switch (e.key) {
        case "h":
          this.toggleLog();
          break;
        case "y":
          this.toggleScope();
          break;
      }
    };
    window.addEventListener("keydown", keyListener);
    this.$on("hook:beforeDestroy", () => window.removeEventListener("keydown", keyListener));
  }

  toggleLog() {
    this.$emit("update:hideLog", !this.hideLog);
  }

  toggleScope() {
    this.scope = this.scope == "all" ? "recent" : "all";
  }

  replayTo(moveIndex: number) {
    this.$store.dispatch("replayTo", moveIndex + 1);
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get extendedLog(): boolean {
    return this.$store.state.preferences.extendedLog;
  }

  get history(): HistoryEntry[] {
    if (this.hideLog) return [];

    return makeHistory(this.engine, this.$store.getters.recentMoves, this.scope == "recent", this.currentMove, this.extendedLog);
  }

  rowSpan(entry: HistoryEntry): number {
    return entry.changes.length > 0 ? entry.changes.length : 1;
  }

  get rowHeaders(): PlayerColumn[] {
    return this.extendedLog ? logPlayerTables(this.engine).flatMap(t => t.columns) : [];
  }

  cellStyle(c: PlayerColumn): string {
    return `${cellStyle(c.color)} border: 1px`;
  }

  parseRewards(s: string): Reward[] {
    return parseRewardsForLog(s);
  }

  rowValues(entry: HistoryEntry, change: number): { value: string; leftBorder: boolean }[] {
    if (!this.extendedLog || change > 1) {
      return [];
    }

    return entry.rows ? entry.rows.flatMap(r => r.map((value, i) => ({
        value,
        leftBorder: i == 0,
      })))
      : logPlayerTables(this.engine).flatMap(t => t.columns.map((c, i) => ({
        value: "",
        leftBorder: i == 0,
      })));
  }
}
</script>

<style lang="scss" scoped>
.table thead td,
.extended-log,
.turn {
  text-align: center;
}

.major-event {
  font-weight: bold;
  color: black;
}

.phase-change {
  font-style: italic;
}

.move {
  word-break: break-word;
}

td {
  vertical-align: middle !important;
}

.first-change {
  border-bottom: none !important;
}

.changes {
  border-top: none !important;
}

.custom-checkbox {
  margin-right: 1em;
  margin-left: 1em;
}
</style>
