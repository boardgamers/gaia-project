<template>
  <div v-if="showNotice" class="opponent-moves-notice">
    <div class="alert alert-info opponent-moves-notice__container" role="status">
      <div class="opponent-moves-notice__content">
        <strong>Since your last turn:</strong>
        <ul class="opponent-moves-notice__moves">
          <li v-for="move in opponentMoves" :key="move.index">{{ move.summary }}</li>
        </ul>
      </div>
      <button
        type="button"
        class="close opponent-moves-notice__dismiss"
        aria-label="Dismiss opponents' moves"
        @click="dismiss"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import Engine, { Phase, PlayerEnum } from "@gaia-project/engine";
import Vue from "vue";
import { MovesSlice, opponentTurnsSinceLastTurn, recentMoves } from "../logic/recent";
import { latestMoveSummary } from "./host";
import {
  clearLegacyDismissal,
  legacyDismissalSignature,
  loadLegacyDismissal,
  loadSeenRecaps,
  SeenRecap,
  SeenRecaps,
  storeSeenRecap,
  unseenRecapLines,
} from "./turn-recap-seen";

/** One line of the recap: a summary plus the `moveHistory` index that identifies it (see
 * turn-recap-seen.ts - the index is what "already read" is remembered against). */
type OpponentMove = { index: number; raw: string; summary: string };

export default Vue.extend({
  name: "OpponentMovesNotice",
  data() {
    return {
      // Read from storage rather than starting empty, so a remount - minimizing the tab and
      // reopening it, a reconnect refetch, a full page reload, re-entering the game tomorrow -
      // does not resurrect a recap this device has already shown.
      seenRecaps: loadSeenRecaps() as SeenRecaps,
      legacyDismissal: loadLegacyDismissal(),
    };
  },
  computed: {
    engine(): Engine {
      return this.$store.state.data;
    },
    mySeat(): PlayerEnum | undefined {
      const seat = this.$store.state.player?.index;
      return seat !== undefined && seat >= 0 && seat < this.engine.players.length ? seat : undefined;
    },
    recentMoveSlice(): MovesSlice {
      if (this.mySeat === undefined) {
        return { index: -1, moves: [], allMoves: [] };
      }
      return recentMoves(this.mySeat, this.engine.advancedLog, this.engine.moveHistory);
    },
    /** Every opponent turn in the current recap window, read or not. */
    recapLines(): OpponentMove[] {
      // recentMoves intentionally includes this player's own previous turn as its first item so
      // the board can highlight from that point onward. The recap starts immediately AFTER it,
      // then drops leech/income-only interruptions: those are decisions, not opponents' turns.
      return opponentTurnsSinceLastTurn(this.recentMoveSlice)
        .map((entry) => ({
          index: entry.index,
          raw: entry.move.move,
          summary: latestMoveSummary(this.engine, entry.move.move),
        }))
        .filter((line): line is OpponentMove => line.summary !== null);
    },
    seenRecap(): SeenRecap | null {
      return this.mySeat === undefined ? null : this.seenRecaps[String(this.mySeat)] ?? null;
    },
    /** What the notice actually lists: only what this device has not shown-and-dismissed yet. */
    opponentMoves(): OpponentMove[] {
      return unseenRecapLines(this.recapLines, this.seenRecap, this.engine.moveHistory);
    },
    showNotice(): boolean {
      const seat = this.mySeat;
      return (
        seat !== undefined &&
        this.engine.phase !== Phase.EndGame &&
        this.engine.newTurn &&
        !this.engine.passedPlayers?.includes(seat) &&
        this.opponentMoves.length > 0
      );
    },
  },
  watch: {
    // Runs once the store has a real position (and again as it changes, where it is a no-op) rather
    // than in created(), where the seat and the move history are typically not loaded yet.
    recapLines: {
      immediate: true,
      handler() {
        this.adoptLegacyDismissal();
      },
    },
  },
  methods: {
    /** Marks everything currently listed as read. Deliberately only the lines on screen: an
     * opponent turn that arrives afterwards is unread, gets its own line, and brings the notice
     * back - which is the whole point of tracking this per move rather than per turn cycle. */
    dismiss() {
      const seat = this.mySeat;
      const lines = this.opponentMoves;
      if (seat === undefined || lines.length === 0) {
        return;
      }
      const last = lines[lines.length - 1];
      const recap: SeenRecap = { through: last.index, move: last.raw };
      this.$set(this.seenRecaps, String(seat), recap);
      storeSeenRecap(seat, recap);
    },
    /**
     * The one-off bridge from the previous all-or-nothing dismissal (one signature per own-turn
     * cycle, no per-move detail): a recap the player had already dismissed under that build is
     * converted into a mark covering the window as it stands, so updating to this build does not
     * show it one more time. Only fires while the stored signature still describes the CURRENT
     * cycle - an older one says nothing about what is on screen now.
     */
    adoptLegacyDismissal() {
      const seat = this.mySeat;
      if (seat === undefined || this.seenRecap || this.recapLines.length === 0) {
        return;
      }
      if (this.legacyDismissal !== legacyDismissalSignature(seat, this.recentMoveSlice.index)) {
        return;
      }
      const last = this.recapLines[this.recapLines.length - 1];
      const recap: SeenRecap = { through: last.index, move: last.raw };
      this.$set(this.seenRecaps, String(seat), recap);
      storeSeenRecap(seat, recap);
      this.legacyDismissal = "";
      clearLegacyDismissal();
    },
  },
});
</script>

<style lang="scss" scoped>
.opponent-moves-notice {
  padding: 0 0.75rem;
}

.opponent-moves-notice__container {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
  padding: 0.45rem 0.75rem;
  font-size: 0.9rem;
}

.opponent-moves-notice__content {
  min-width: 0;
}

.opponent-moves-notice__moves {
  margin: 0.15rem 0 0;
  padding-left: 1.1rem;
}

.opponent-moves-notice__dismiss {
  flex: 0 0 auto;
  font-size: 1.2rem;
  line-height: 1;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
}
</style>
