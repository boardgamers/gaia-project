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
        class="hosted-bar__push-toggle"
        :disabled="pushBusy"
        v-b-tooltip.hover
        title="Notifications are on for this device. Click to turn off."
        @click="$emit('disable-push')"
      >
        &#128276;
      </b-button>
      <b-button
        v-else
        size="sm"
        variant="outline-secondary"
        class="hosted-bar__push-toggle"
        :disabled="pushBusy"
        v-b-tooltip.hover
        title="Click to enable turn notifications on this device"
        @click="$emit('enable-push')"
      >
        &#128276;
      </b-button>
      <b-dropdown size="sm" right no-caret variant="outline-secondary" toggle-class="hosted-bar__settings-toggle">
        <template #button-content>
          <span aria-hidden="true">&#9881;</span>
          <span class="sr-only">Settings</span>
        </template>
        <b-dropdown-item-button @click="toggleDarkMode">{{
          isDarkMode ? "Light mode" : "Dark mode"
        }}</b-dropdown-item-button>
        <template v-if="isDesktop">
          <b-dropdown-divider></b-dropdown-divider>
          <b-dropdown-item-button @click="$emit('toggle-chat-panel')">{{
            chatPanelOpen ? "Hide chat panel" : "Show chat panel"
          }}</b-dropdown-item-button>
          <b-dropdown-item-button @click="$emit('toggle-game-nav-panel')">{{
            gameNavPanelOpen ? "Hide game menu panel" : "Show game menu panel"
          }}</b-dropdown-item-button>
        </template>
        <b-dropdown-divider></b-dropdown-divider>
        <b-dropdown-item-button v-if="!abandoned" @click="confirmAbandon">Abandon game</b-dropdown-item-button>
      </b-dropdown>
    </span>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import TurnOrder from "../components/TurnOrder.vue";
import { getTheme, toggleTheme } from "./theme";
import { isDesktopViewport, watchDesktopViewport } from "./viewport";

export default Vue.extend({
  name: "HostedBar",
  components: { TurnOrder },
  props: {
    gameName: { type: String, default: "" },
    finished: { type: Boolean, default: false },
    pushBusy: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: false },
    abandoned: { type: Boolean, default: false },
    // Reflect ChatNotesPanel.vue's/GameNavPanel.vue's own `open` state so the menu item's label
    // ("Hide"/"Show") stays accurate - hosted.ts watches those panels' instances directly and
    // updates these props, same pattern as `gameName`/`finished` above.
    chatPanelOpen: { type: Boolean, default: false },
    gameNavPanelOpen: { type: Boolean, default: false },
  },
  data() {
    return {
      isDarkMode: getTheme() === "dark",
      // Only desktop has docked, default-open side panels worth a settings-menu switch - mobile's
      // panels are always closed behind their own floating toggles, so a switch for them would
      // control a state mobile users never see. Re-evaluated on every breakpoint crossing so
      // resizing the browser window doesn't leave a stale entry showing.
      isDesktop: isDesktopViewport(),
      viewportUnwatch: null as (() => void) | null,
    };
  },
  mounted() {
    this.viewportUnwatch = watchDesktopViewport((isDesktop) => {
      this.isDesktop = isDesktop;
    });
  },
  beforeDestroy() {
    if (this.viewportUnwatch) {
      this.viewportUnwatch();
      this.viewportUnwatch = null;
    }
  },
  methods: {
    toggleDarkMode() {
      this.isDarkMode = toggleTheme() === "dark";
    },
    confirmAbandon() {
      if (window.confirm("Abandon this game? It will be unplayable and shown as abandoned to the other players.")) {
        this.$emit("abandon-game");
      }
    },
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

::v-deep(.hosted-bar__settings-toggle) {
  min-width: 2.2rem;
  padding-left: 0.45rem;
  padding-right: 0.45rem;
}

// The push-notification bell wasn't obviously clickable - in particular the "enabled" (green,
// solid-fill) state reads as a passive status badge more than an actionable toggle, and the
// "disabled" (outline-secondary) state's thin gray border nearly disappears against the bar's
// light background. A visible border + real shadow on both states, plus a hover/active press
// effect, makes it unambiguously a button regardless of which state it's in.
.hosted-bar__push-toggle {
  border-width: 1px !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);

  &:hover:not(:disabled) {
    box-shadow: 0 1px 5px rgba(0, 0, 0, 0.35);
  }

  &:active:not(:disabled) {
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
  }
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
