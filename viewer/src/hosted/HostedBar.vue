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
});
</script>

<style lang="scss" scoped>
.hosted-bar {
  align-items: stretch;
  min-height: 66px;
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

::v-deep(.hosted-bar__turn-order .turn-order) {
  display: flex;
  align-items: center;
  height: 100%;
}

::v-deep(.hosted-bar__turn-order .turn-order > svg) {
  width: auto !important;
  height: 100% !important;
  max-height: 60px;
}

@media (max-width: 767px) {
  .hosted-bar {
    gap: 0.5rem !important;
    padding-left: 0.75rem !important;
    padding-right: 2.9rem !important;
  }
}
</style>

