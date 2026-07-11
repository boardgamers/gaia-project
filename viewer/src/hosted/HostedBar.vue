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
      <b-dropdown
        size="sm"
        right
        no-caret
        variant="outline-secondary"
        toggle-class="hosted-bar__settings-toggle"
        @shown="onSettingsOpened"
      >
        <template #button-content>
          <span aria-hidden="true">&#9881;</span>
          <span class="sr-only">Settings</span>
          <span v-if="showNewSettingsBadge" class="hosted-bar__settings-badge" aria-hidden="true"></span>
        </template>
        <SettingsToggle label="Dark mode" :checked="isDarkMode" @change="toggleDarkMode" />
        <SettingsToggle label="Chat panel" :checked="chatOpen" @change="$emit('toggle-chat')" />
        <SettingsToggle label="Game menu" :checked="gameNavOpen" @change="$emit('toggle-game-nav')" />
        <b-dropdown-divider></b-dropdown-divider>
        <b-dropdown-item-button v-if="!abandoned" @click="confirmAbandon">Abandon game</b-dropdown-item-button>
      </b-dropdown>
    </span>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import TurnOrder from "../components/TurnOrder.vue";
import SettingsToggle from "./SettingsToggle.vue";
import { hasUnseenSettings, markSettingsSeen } from "./settings-notice";
import { getTheme, toggleTheme } from "./theme";

export default Vue.extend({
  name: "HostedBar",
  components: { TurnOrder, SettingsToggle },
  props: {
    gameName: { type: String, default: "" },
    finished: { type: Boolean, default: false },
    pushBusy: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: false },
    abandoned: { type: Boolean, default: false },
    // The left game-menu's own persisted open/closed state (GameNavPanel.vue) - a global
    // preference toggled here (owner request), not a per-game setting, so this just mirrors
    // whatever hosted.ts already knows rather than owning the value itself.
    gameNavOpen: { type: Boolean, default: false },
    // Same idea, mirroring ChatNotesPanel.vue's own persisted `open` state.
    chatOpen: { type: Boolean, default: false },
  },
  data() {
    return {
      isDarkMode: getTheme() === "dark",
      // A small badge on the gear icon the first time a new settings option ships after this was
      // last opened (owner request: "prompted... once they have seen it once... should not fire
      // again") - see settings-notice.ts's own doc comment for how "new" is tracked.
      showNewSettingsBadge: hasUnseenSettings(),
    };
  },
  methods: {
    toggleDarkMode() {
      this.isDarkMode = toggleTheme() === "dark";
    },
    onSettingsOpened() {
      markSettingsSeen();
      this.showNewSettingsBadge = false;
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
  position: relative;
  min-width: 2.2rem;
  padding-left: 0.45rem;
  padding-right: 0.45rem;
}

.hosted-bar__settings-badge {
  position: absolute;
  top: 0.1rem;
  right: 0.1rem;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #dc3545;
  border: 2px solid #fff;
  animation: hosted-bar-settings-pulse 1.8s infinite;
}

@keyframes hosted-bar-settings-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.6);
  }
  70% {
    box-shadow: 0 0 0 5px rgba(220, 53, 69, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0);
  }
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
