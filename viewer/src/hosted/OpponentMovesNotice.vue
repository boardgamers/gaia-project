<template>
  <div v-if="showNotice" class="opponent-moves-notice">
    <div class="alert alert-info opponent-moves-notice__container" role="status">
      <div class="opponent-moves-notice__content">
        <strong>Since your last turn:</strong>
        <ul class="opponent-moves-notice__moves">
          <li v-for="move in opponentMoves" :key="move.raw">{{ move.summary }}</li>
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
import { MovesSlice, opponentMovesSinceLastTurn, recentMoves } from "../logic/recent";
import { latestMoveSummary } from "./host";

type OpponentMove = { raw: string; summary: string };

export default Vue.extend({
  name: "OpponentMovesNotice",
  data() {
    return {
      dismissedSignature: "",
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
    opponentMoves(): OpponentMove[] {
      // recentMoves intentionally includes this player's own previous turn as its first item so
      // the board can highlight from that point onward. The recap starts immediately AFTER it,
      // then drops leech/income-only interruptions: those are decisions, not opponents' turns.
      return opponentMovesSinceLastTurn(this.recentMoveSlice)
        .map((move) => ({ raw: move.move, summary: latestMoveSummary(this.engine, move.move) }))
        .filter((move): move is OpponentMove => move.summary !== null);
    },
    noticeSignature(): string {
      // The last OWN turn, not the growing opponent-move list, identifies one recap cycle. Once
      // dismissed, later opponents in the same four-player rotation must not make it reappear.
      return `${this.mySeat ?? "none"}:${this.recentMoveSlice.index}`;
    },
    showNotice(): boolean {
      const seat = this.mySeat;
      return (
        seat !== undefined &&
        this.engine.phase !== Phase.EndGame &&
        this.engine.newTurn &&
        !this.engine.passedPlayers?.includes(seat) &&
        this.opponentMoves.length > 0 &&
        this.dismissedSignature !== this.noticeSignature
      );
    },
  },
  methods: {
    dismiss() {
      this.dismissedSignature = this.noticeSignature;
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
