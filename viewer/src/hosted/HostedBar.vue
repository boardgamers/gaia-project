<template>
  <div
    class="d-flex justify-content-between align-items-center px-3 py-2 mb-2 border-bottom bg-light flex-wrap"
    style="gap: 0.5rem"
  >
    <span>
      <a href="?lobby=1">← Games</a>
      <strong class="ml-2">{{ gameName || "Unnamed game" }}</strong>
    </span>
    <span>
      <b-badge :variant="finished ? 'secondary' : myTurn ? 'success' : 'info'">
        {{ finished ? "Game finished" : myTurn ? "Your turn" : `${turnPlayerName} to move` }}
      </b-badge>
      <span v-if="mySeatName" class="text-muted small ml-2">You play {{ mySeatName }}</span>
      <span v-else class="text-muted small ml-2">Spectating</span>
    </span>
    <span>
      <b-button size="sm" variant="outline-secondary" :disabled="pushBusy" @click="$emit('enable-push')">
        Enable notifications
      </b-button>
    </span>
  </div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "HostedBar",
  props: {
    gameName: { type: String, default: "" },
    turnPlayerName: { type: String, default: "" },
    mySeatName: { type: String, default: "" },
    myTurn: { type: Boolean, default: false },
    finished: { type: Boolean, default: false },
    pushBusy: { type: Boolean, default: false },
  },
});
</script>
