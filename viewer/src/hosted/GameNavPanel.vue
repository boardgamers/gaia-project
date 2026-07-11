<template>
  <div class="game-nav gaia-viewer-game">
    <div v-if="open" class="game-nav__panel">
      <div class="game-nav__header">
        <a href="?create=1" class="btn btn-primary btn-sm">+ New game</a>
        <button type="button" class="game-nav__close" @click="close" aria-label="Close">&times;</button>
      </div>

      <div class="game-nav__tabs" role="tablist" aria-label="Game status tabs">
        <button
          type="button"
          class="game-nav__tab"
          :class="{ 'game-nav__tab--active': tab === 'active' }"
          @click="tab = 'active'"
        >
          Active <span class="game-nav__tab-count">{{ myActiveGames.length }}</span>
        </button>
        <button
          type="button"
          class="game-nav__tab"
          :class="{ 'game-nav__tab--active': tab === 'open' }"
          @click="tab = 'open'"
        >
          Lobby <span class="game-nav__tab-count">{{ openGames.length }}</span>
        </button>
        <button
          type="button"
          class="game-nav__tab"
          :class="{ 'game-nav__tab--active': tab === 'finished' }"
          @click="tab = 'finished'"
        >
          Finished <span class="game-nav__tab-count">{{ myFinishedGames.length }}</span>
        </button>
      </div>

      <b-list-group v-if="loading || visibleGames.length === 0" class="game-nav__list">
        <b-list-group-item v-if="loading">Loading games...</b-list-group-item>
        <b-list-group-item v-else>{{ emptyText }}</b-list-group-item>
      </b-list-group>
      <b-list-group v-else class="game-nav__list">
        <b-list-group-item
          v-for="game in visibleGames"
          :key="game.id"
          class="game-bar"
          :class="{ 'game-bar--my-turn': isMyTurn(game), 'game-nav__row--current': game.id === currentGameId }"
        >
          <GameBar
            :game="game"
            :presence-state="presenceState"
            :my-user-id="myUserId"
            @click.native="onRowClick(game, $event)"
            @delete-test-game="deleteMyTestGame"
          />
        </b-list-group-item>
      </b-list-group>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import GameBar from "./GameBar.vue";
import { isMyGame, isMyTurn, sortGames } from "./game-bar";
import { PresenceState } from "./presence";

/** Collapsible left-side main menu (owner's brief: "browse my games, lobby active games, finished
 * games... basically just be that main menu"), and a global on/off preference toggled from the
 * settings menu (HostedBar.vue) rather than its own floating button - see `open`'s doc comment.
 * Deliberately a light, standalone query rather than reusing Lobby.vue wholesale - Lobby.vue
 * carries a lot of unrelated chrome (release notes, credits, nickname modal, admin delete-swipe)
 * that has no place in an in-game side menu. Every row renders through the same GameBar.vue
 * component Lobby.vue itself uses (owner request: the two must look and behave identically, and a
 * change to one must apply to both). Clicking an active/finished game emits `select-game` so
 * hosted.ts can swap the game in place (no reload); open-lobby rows and "+ New game" still do a
 * real navigation (join/create both have their own dedicated flows, no need to reproduce them
 * here). */
export default Vue.extend({
  name: "GameNavPanel",
  components: { GameBar },
  props: {
    client: { type: Object, required: true },
    session: { type: Object, required: true },
  },
  data() {
    return {
      // A persisted, global preference (owner request - "not to be a per game specific setting"),
      // not per-session UI state: read from localStorage at mount, toggled only from HostedBar.vue's
      // settings menu (`hosted.ts` calls `nav.open = !nav.open` and persists it), so it stays
      // consistently on/off across every game and every future visit instead of resetting.
      open: loadGameNavOpenPreference(),
      tab: "active" as "active" | "open" | "finished",
      games: [] as any[],
      loading: true,
      gamesChannel: null as any,
      presenceState: {} as PresenceState,
      // Not a prop - hosted.ts sets this directly on the mounted instance whenever the in-app game
      // switch lands (same "hold the instance, assign into it" pattern already used for
      // `chatNotes.presenceState` in launchGame), since there's no parent template re-passing it.
      currentGameId: "",
    };
  },
  computed: {
    myUserId(): string {
      return (this.session as any).user?.id ?? "";
    },
    userEmail(): string {
      return (this.session as any).user?.email ?? "";
    },
    openGames(): any[] {
      return sortGames(
        (this.games as any[]).filter((game) => game.status === "open"),
        this.myUserId,
        this.userEmail
      );
    },
    myActiveGames(): any[] {
      return sortGames(
        (this.games as any[]).filter((game) => game.status === "active" && isMyGame(game, this.myUserId, this.userEmail)),
        this.myUserId,
        this.userEmail
      );
    },
    myFinishedGames(): any[] {
      return sortGames(
        (this.games as any[]).filter(
          (game) => game.status === "finished" && isMyGame(game, this.myUserId, this.userEmail)
        ),
        this.myUserId,
        this.userEmail
      );
    },
    visibleGames(): any[] {
      if (this.tab === "open") {
        return this.openGames;
      }
      return this.tab === "active" ? this.myActiveGames : this.myFinishedGames;
    },
    emptyText(): string {
      if (this.tab === "open") {
        return "No open lobby games right now.";
      }
      return this.tab === "active" ? "No active games yet." : "No finished games yet.";
    },
  },
  created() {
    this.refresh();
    this.subscribeGames();
  },
  beforeDestroy() {
    if (this.gamesChannel) {
      (this.client as any).removeChannel(this.gamesChannel);
      this.gamesChannel = null;
    }
  },
  methods: {
    isMyTurn(game: any): boolean {
      return isMyTurn(game, this.myUserId, this.userEmail);
    },
    close() {
      this.open = false;
      saveGameNavOpenPreference(false);
    },
    async refresh() {
      this.loading = true;
      const { data, error } = await (this.client as any)
        .from("games")
        .select("*, players(*)")
        .order("created_at", { ascending: false });
      if (!error && data) {
        this.games = data;
      }
      this.loading = false;
    },
    subscribeGames() {
      this.gamesChannel = (this.client as any)
        .channel("game-nav-games")
        .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => this.refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => this.refresh())
        .subscribe();
    },
    async deleteMyTestGame(game: any) {
      if (!window.confirm(`Delete "${game.name || "this test game"}"? This cannot be undone.`)) {
        return;
      }
      const { error } = await (this.client as any).rpc("delete_my_test_game", { p_game_id: game.id });
      if (!error) {
        await this.refresh();
      }
    },
    onRowClick(game: any, event: MouseEvent) {
      // Active/finished games swap in place (no reload) - open-lobby rows still go through the
      // normal `?preview=` join flow, which has its own dedicated screen this menu doesn't
      // reproduce. A modifier-clicked link (open in new tab, etc.) must still behave like a real
      // link, so only intercept a plain left click.
      if (this.tab === "open" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      this.$emit("select-game", game.id);
    },
  },
});

const GAME_NAV_OPEN_KEY = "gp-fight-club-game-nav-open";

/** On by default on desktop (owner request); mobile still defaults closed - this becomes a
 * full-screen overlay there (see the scoped `@media (max-width: 767px)` below), which would
 * otherwise cover the board the instant a phone user opened the app. Same reasoning/pattern as
 * ChatNotesPanel.vue's own `loadChatOpenPreference`. */
function isDesktopViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth >= 768;
}

export function loadGameNavOpenPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const stored = window.localStorage.getItem(GAME_NAV_OPEN_KEY);
  return stored === null ? isDesktopViewport() : stored === "true";
}

export function saveGameNavOpenPreference(open: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(GAME_NAV_OPEN_KEY, open ? "true" : "false");
}
</script>

<style lang="scss" scoped>
.game-nav__panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 320px;
  max-width: 100vw;
  background: var(--bs-body-bg, #fff);
  border-right: 1px solid rgba(0, 0, 0, 0.15);
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.25);
  z-index: 1050;
  display: flex;
  flex-direction: column;

  @media (max-width: 767px) {
    right: 0;
    width: 100vw;
    border-right: none;
  }
}

.game-nav__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.game-nav__close {
  border: 0;
  background: transparent;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0.2rem 0.4rem;
}

.game-nav__tabs {
  display: flex;
  gap: 0.35rem;
  padding: 0.5rem 0.6rem 0;
}

.game-nav__tab {
  flex: 1;
  border: 0;
  border-radius: 999px;
  padding: 0.28rem 0.5rem;
  background: transparent;
  font-weight: 600;
  font-size: 0.85rem;
  color: inherit;
  opacity: 0.6;

  &--active {
    background: rgba(47, 111, 237, 0.15);
    opacity: 1;
  }
}

.game-nav__tab-count {
  opacity: 0.7;
  font-weight: 400;
}

.game-nav__list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

// GameBar.vue's own global `.game-bar`/`.game-bar--my-turn` styling handles everything else about
// how a row looks - this is only the one thing specific to being IN this menu (which game you're
// currently looking at).
.game-nav__row--current {
  outline: 2px solid rgba(47, 111, 237, 0.5);
}
</style>
