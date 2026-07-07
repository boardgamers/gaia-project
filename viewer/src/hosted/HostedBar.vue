<template>
  <div
    class="gaia-viewer-game d-flex align-items-center px-3 py-1 mb-2 border-bottom bg-light position-relative"
    style="gap: 0.75rem; min-height: 0; flex-wrap: nowrap; padding-right: 3rem"
  >
    <span class="text-truncate">
      <a href="?lobby=1">← Games</a>
      <strong class="ml-2">{{ gameName || "Unnamed game" }}</strong>
    </span>
    <template v-if="finished">
      <b-badge variant="secondary">Game finished</b-badge>
    </template>
    <template v-else>
      <!-- Desktop only (PROGRESS.md Gaia 10 follow-up #2): the old "Your turn"/"X to move" text
           had nowhere left to show once it stopped being the local viewer's turn (Commands.vue,
           which carries the mobile sticky-bar equivalent, unmounts entirely when it isn't your
           turn) - on desktop there's room for it here; on mobile this banner stays circles-only
           (d-none d-md-*) so it doesn't compete with Commands.vue's own sticky bar for space. -->
      <b-badge :variant="myTurn ? 'success' : 'info'" class="d-none d-md-inline-block">
        {{ myTurn ? "Your turn" : `${turnPlayerName} to move` }}
      </b-badge>
      <TurnOrder compact />
    </template>
    <span
      class="d-flex align-items-center justify-content-center position-absolute"
      style="top: 0; right: 0.5rem; bottom: 0"
    >
      <b-button
        v-if="pushEnabled"
        size="sm"
        variant="success"
        :disabled="pushBusy"
        v-b-tooltip.hover
        title="This device is registered for turn notifications. Enable it separately on any other device you play from. Click to turn off."
        @click="$emit('disable-push')"
      >
        🔔
      </b-button>
      <b-button
        v-else
        size="sm"
        variant="outline-secondary"
        :disabled="pushBusy"
        v-b-tooltip.hover
        title="Enable turn notifications on this device"
        @click="$emit('enable-push')"
      >
        🔔
      </b-button>
    </span>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import TurnOrder from "../components/TurnOrder.vue";

export default Vue.extend({
  name: "HostedBar",
  components: { TurnOrder },
  props: {
    gameName: { type: String, default: "" },
    finished: { type: Boolean, default: false },
    pushBusy: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: false },
  },
  computed: {
    // $store.state.player is the seat this session is locked to act as right now (seatToLock in
    // hosted.ts already resolves "whichever of my seats must act now, leech interrupts included"
    // to a real index, or leaves it unset/placeholder otherwise) - the same signal Game.vue's own
    // canPlay already trusts, reused here instead of threading a separate prop through hosted.ts.
    myTurn(): boolean {
      const lockedSeat = this.$store.state.player?.index;
      const turnSeat = this.$store.state.data?.playerToMove;
      return lockedSeat != null && lockedSeat >= 0 && lockedSeat === turnSeat;
    },
    turnPlayerName(): string {
      const engine = this.$store.state.data;
      const seat = engine?.playerToMove;
      if (seat == null) {
        return "";
      }
      return engine.players?.[seat]?.name ?? `Player ${seat + 1}`;
    },
  },
});
</script>
