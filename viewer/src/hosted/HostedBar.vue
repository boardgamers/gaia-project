<template>
  <div
    class="d-flex justify-content-between align-items-center px-3 py-2 mb-2 border-bottom bg-light flex-wrap"
    style="gap: 0.5rem"
  >
    <span>
      <a href="?lobby=1">← Games</a>
      <strong class="ml-2">{{ gameName || "Unnamed game" }}</strong>
    </span>
    <span class="d-flex align-items-center" style="gap: 0.5rem">
      <b-badge v-if="finished" variant="secondary">Game finished</b-badge>
      <TurnOrder v-else />
      <span v-if="mySeatName" class="text-muted small ml-2">You play {{ mySeatName }}</span>
      <span v-else class="text-muted small ml-2">Spectating</span>
    </span>
    <span>
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
    mySeatName: { type: String, default: "" },
    finished: { type: Boolean, default: false },
    pushBusy: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: false },
  },
});
</script>
