<template>
  <div
    class="gaia-viewer-game d-flex align-items-center px-3 py-1 mb-2 border-bottom bg-light position-relative"
    style="gap: 0.75rem; min-height: 0; flex-wrap: nowrap; padding-right: 3rem"
  >
    <span class="text-truncate">
      <a href="?lobby=1">← Games</a>
      <strong class="ml-2">{{ gameName || "Unnamed game" }}</strong>
    </span>
    <b-badge v-if="finished" variant="secondary">Game finished</b-badge>
    <TurnOrder v-else compact />
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
});
</script>
