<template>
  <div
    class="gaia-viewer-game hosted-bar d-flex px-3 py-1 mb-2 border-bottom bg-light position-relative"
    style="gap: 0.75rem; flex-wrap: nowrap; padding-right: 3rem"
  >
    <span class="hosted-bar__title text-truncate">
      <a href="?lobby=1" aria-label="Back to lobby" class="hosted-bar__back">&larr;</a>
      <strong class="ml-2">{{ gameName || "Unnamed game" }}</strong>
    </span>
    <template v-if="finished">
      <b-badge variant="secondary">Game finished</b-badge>
    </template>
    <template v-else>
      <b-badge :variant="myTurn ? 'success' : 'info'" class="hosted-bar__turn-pill">
        {{ myTurn ? "Your turn" : `${turnPlayerName} to move` }}
      </b-badge>
      <div class="hosted-bar__turn-order">
        <TurnOrder compact />
      </div>
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
        &#128276;
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
        &#128276;
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

<style lang="scss" scoped>
.hosted-bar {
  align-items: stretch;
  min-height: 58px;
}

.hosted-bar__title {
  display: flex;
  align-items: center;
  min-width: 0;
}

.hosted-bar__back {
  text-decoration: none;
}

.hosted-bar__turn-order {
  display: flex;
  align-items: center;
  align-self: stretch;
  min-height: 0;
}

.hosted-bar__turn-pill {
  align-self: center;
  white-space: nowrap;
}

::v-deep(.hosted-bar__turn-order .turn-order) {
  display: flex;
  align-items: center;
  height: 100%;
}

::v-deep(.hosted-bar__turn-order .turn-order > svg) {
  width: auto !important;
  height: 100% !important;
  max-height: 52px;
}

@media (max-width: 767px) {
  .hosted-bar {
    gap: 0.5rem !important;
    padding-left: 0.75rem !important;
    padding-right: 2.9rem !important;
  }

  .hosted-bar__turn-pill {
    font-size: 0.68rem;
    padding: 0.22rem 0.42rem;
  }
}
</style>

