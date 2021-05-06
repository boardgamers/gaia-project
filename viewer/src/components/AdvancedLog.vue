<template>
  <div v-if="gameData.phase !== 'setupInit'">
    <div class="d-flex" style="justify-content: center">
      <b-checkbox :checked="scope == 'all'" @change="toggleScope">Show ever<u>y</u>thing</b-checkbox>
      <b-checkbox :checked="hideLog" @change="toggleLog"><u>H</u>ide log until next turn</b-checkbox>
    </div>
    <table class="table table-hover table-striped table-sm">
      <tbody>
        <tr class="major-event" v-if="gameData.phase === 'endGame'">
          <td colspan="4">Game Ended</td>
        </tr>
        <template v-for="(event, i) in history">
          <tr
            v-for="j in rowSpan(event)"
            :key="`${i}-${j}`"
            :style="`background-color: ${event.color}; color: ${event.textColor}`"
          >
            <td
              v-if="j === 1 && !['setupInit', 'moves-skipped', 'roundStart'].includes(event.phase)"
              :rowspan="rowSpan(event)"
            >
              {{ event.round }}.{{ event.turn }}
            </td>
            <td v-if="event.phase === 'roundStart'" colspan="2" class="major-event">Round {{ event.round }}</td>
            <td v-else-if="event.phase === 'setupInit'" colspan="2" class="major-event">Game Started</td>
            <td v-else-if="event.phase === 'moves-skipped'" colspan="2" class="major-event">
              Click "Show everything" to expand
            </td>
            <td v-else-if="event.phase === 'roundIncome'" class="phase-change">Income phase</td>
            <td v-else-if="event.phase === 'roundGaia'" class="phase-change">Gaia phase</td>
            <td v-else-if="event.phase === 'roundMove'" class="phase-change">Move phase</td>
            <td v-else-if="event.phase === 'endGame'" class="phase-change">End scoring</td>
            <td v-else-if="j === 1" :rowspan="rowSpan(event)" class="move">
              <div>{{ event.move }}</div>
            </td>
            <td v-if="event.changes.length > 0" :class="j === 1 ? 'first-change' : 'changes'">
              {{ event.changes[j - 1].source }}
            </td>
            <td v-else />
            <td v-if="event.changes.length > 0" :class="j === 1 ? 'first-change' : 'changes'">
              {{ event.changes[j - 1].changes }}
            </td>
            <td v-else />
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine from "@gaia-project/engine";
import { HistoryEntry, makeHistory } from "../data/log";

type LogScope = "recent" | "all"

@Component
export default class AdvancedLog extends Vue {
  private scope: LogScope = "recent"
  private keyListener = null;

  @Prop()
  currentMove?: string;

  @Prop()
  hideLog?: boolean;

  destroyed() {
    window.removeEventListener("keydown", this.keyListener);
  }

  mounted() {
    this.keyListener = (e) => {
      switch (e.key) {
        case "h":
          this.toggleLog();
          break;
        case "y":
          this.toggleScope();
          break;
      }
    };
    window.addEventListener("keydown", this.keyListener);
  }

  toggleLog() {
    this.$emit("update:hideLog", !this.hideLog);
  }

  toggleScope() {
    this.scope = this.scope == "all" ? "recent" : "all";
  }

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get history(): HistoryEntry[] {
    if (this.hideLog) return [];

    return makeHistory(
      this.gameData,
      this.$store.getters["gaiaViewer/recentMoves"],
      this.scope == "recent",
      this.currentMove
    );
  }

  rowSpan(entry: HistoryEntry): number {
    return entry.changes.length > 0 ? entry.changes.length : 1;
  }
};
</script>

<style lang="scss" scoped>
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
