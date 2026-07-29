<template>
  <div
    class="gaia-viewer-game hosted-bar d-flex px-3 py-1 mb-2 border-bottom bg-light position-relative"
    style="gap: 0.75rem; flex-wrap: nowrap; padding-right: 3rem"
  >
    <span class="hosted-bar__title text-truncate">
      <a href="?lobby=1&amp;tab=mine" aria-label="Back to my games" class="hosted-bar__back">&larr;</a>
      <span class="d-flex flex-column ml-2 hosted-bar__name-col">
        <strong class="text-truncate">{{ gameName || "Unnamed game" }}</strong>
        <span v-if="isLive" class="game-bar__live"> <span class="game-bar__live-dot"></span>Live </span>
      </span>
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
        size="sm"
        :variant="pushEnabled ? 'success' : 'outline-secondary'"
        class="hosted-bar__push-toggle"
        :disabled="pushBusy"
        v-b-tooltip.hover
        title="Notification settings"
        aria-label="Notification settings"
        @click="$emit('open-notification-settings')"
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
        <b-dropdown-item-button @click="toggleOfflineCopy">{{
          offlineMirror ? "Stop offline copy" : "Convert to offline game"
        }}</b-dropdown-item-button>
        <b-dropdown-text v-if="offlineMirror" class="hosted-bar__offline-status small text-muted">
          {{ offlineMirrorStatus || "Offline copy up to date" }}
        </b-dropdown-text>
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
    // "Live" = every player in this game is online right now (see GameBar.vue's `isLive`, the
    // reference implementation this mirrors for the lobby's own game list) - computed in hosted.ts
    // from the same presence roster/player list, since HostedBar has no direct store access to
    // `host.players` itself.
    isLive: { type: Boolean, default: false },
    pushBusy: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: false },
    abandoned: { type: Boolean, default: false },
    // Reflect ChatNotesPanel.vue's/GameNavPanel.vue's own `open` state so the menu item's label
    // ("Hide"/"Show") stays accurate - hosted.ts watches those panels' instances directly and
    // updates these props, same pattern as `gameName`/`finished` above.
    chatPanelOpen: { type: Boolean, default: false },
    gameNavPanelOpen: { type: Boolean, default: false },
    // "Convert to offline game" (hosted/offline-mirror.ts) - whether this device is keeping a
    // playable offline copy of this game in sync, and a one-line status for it (last sync time, or
    // whatever went wrong), both owned by hosted.ts since the copy lives outside this component.
    offlineMirror: { type: Boolean, default: false },
    offlineMirrorStatus: { type: String, default: "" },
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
    /**
     * Both directions are confirmed because both have a consequence the wording has to be honest
     * about: switching on copies the whole game onto this device (and keeps doing so), and
     * switching off leaves the copy behind at whatever move it last synced rather than deleting it.
     */
    toggleOfflineCopy() {
      const message = this.offlineMirror
        ? "Stop copying this game to your offline games? The copy already on this device stays there, frozen at the last move it synced - delete it from the offline lobby if you don't want it."
        : "Add this game to your offline games on this device? Every move played online is copied there automatically, and moves you play in the copy while offline are sent up to the online game as soon as you are back - they are real moves, not practice. The copy is never overwritten by an older online state. You can only play your own seats in it, since nobody can move for another player.";
      if (window.confirm(message)) {
        this.$emit("toggle-offline-mirror");
      }
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

.hosted-bar__name-col {
  min-width: 0;
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
  box-shadow: 0 1px 3px var(--ui-shadow);

  &:hover:not(:disabled) {
    box-shadow: 0 1px 5px var(--ui-shadow);
  }

  &:active:not(:disabled) {
    box-shadow: inset 0 1px 3px var(--ui-shadow);
  }
}

// A status line, not a menu item: it wraps instead of stretching the menu, and never looks clickable.
.hosted-bar__offline-status {
  max-width: 15rem;
  margin-bottom: 0;
  white-space: normal;
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
