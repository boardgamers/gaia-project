<template>
  <div v-if="isDesktop" class="game-nav gaia-viewer-game">
    <div v-if="open" class="game-nav__panel">
      <div class="game-nav__header">
        <a href="?create=1" class="btn btn-primary btn-sm">+ New game</a>
        <button type="button" class="game-nav__close" @click="setOpen(false)" aria-label="Close">&times;</button>
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

      <div class="game-nav__list">
        <p v-if="loading" class="text-muted small px-2">Loading games...</p>
        <p v-else-if="visibleGames.length === 0" class="text-muted small px-2">{{ emptyText }}</p>
        <template v-else>
          <div
            v-for="game in visibleGames"
            :key="game.id"
            class="game-nav__row game-bar"
            :class="{
              'game-bar--my-turn': hasPendingTurn(game),
              'game-nav__row--current': game.id === currentGameId,
            }"
          >
            <GameBar
              :game="game"
              :presence-state="presenceState"
              :my-user-id="myUserId"
              :user-email="userEmail"
              @click.native="onRowClick(game, $event)"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import GameBar from "./GameBar.vue";
import { isMyGame, sortGames } from "./game-bar";
import { hasPendingTurn } from "./turn-kinds";
import { PresenceState } from "./presence";
import { isDesktopViewport, watchDesktopViewport } from "./viewport";

const OPEN_PREF_KEY = "game-nav-panel-open";

// Desktop-only preference (owner request: this is a desktop-only docked panel that defaults open,
// with a settings-menu switch to turn it off - mobile never gets this menu at all, see `isDesktop`
// below). Defaults to open (true) so a desktop user who never touched the setting still gets it.
function loadOpenPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  const stored = window.localStorage.getItem(OPEN_PREF_KEY);
  return stored === null ? true : stored === "1";
}

function saveOpenPreference(open: boolean): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OPEN_PREF_KEY, open ? "1" : "0");
  }
}

/** Desktop-only left-side main menu (owner's brief: "browse my games, lobby active games, finished
 * games... basically just be that main menu", and later: mobile should not have this at all, only
 * desktop has room for a persistent docked panel). Deliberately a light, standalone query rather
 * than reusing Lobby.vue wholesale - Lobby.vue carries a lot of unrelated chrome (release notes,
 * credits, nickname modal, admin delete-swipe) that has no place in an in-game side menu. Every
 * row renders through the same GameBar.vue component Lobby.vue itself uses (owner request: the two
 * must look and behave identically, and a change to one must apply to both). Clicking an active/
 * finished game emits `select-game` so hosted.ts can swap the game in place (no reload); open-
 * lobby rows and "+ New game" still do a real navigation (join/create both have their own
 * dedicated flows, no need to reproduce them here).
 *
 * This component renders NOTHING at all on mobile (`v-if="isDesktop"` on the template root) - not
 * a hidden panel, not a floating toggle, nothing - it's docked, default-open, and toggled from
 * HostedBar.vue's settings menu (`toggleOpen`, called externally via the mounted instance - same
 * "hold the instance, assign into it" pattern `hosted.ts` already uses). `isDesktop` is
 * re-evaluated on every breakpoint crossing (`watchDesktopViewport`) so resizing a browser window
 * or rotating a tablet doesn't leave it stuck in the wrong mode. */
export default Vue.extend({
  name: "GameNavPanel",
  components: { GameBar },
  props: {
    client: { type: Object, required: true },
    session: { type: Object, required: true },
  },
  data() {
    const isDesktop = isDesktopViewport();
    return {
      isDesktop,
      open: isDesktop && loadOpenPreference(),
      tab: "active" as "active" | "open" | "finished",
      games: [] as any[],
      loading: true,
      gamesChannel: null as any,
      viewportUnwatch: null as (() => void) | null,
      // Set directly from outside (hosted.ts, via emitter.store.watch) rather than tracked here -
      // this game already tracks its own presence (hosted.ts's own `trackPresence(..., {type:
      // "game", gameId}, ...)` call feeds the shared Vuex store's `state.presence`), so reading
      // that directly avoids opening yet another Realtime Presence channel (see LobbyChatPanel's
      // own history of exactly that bug, PROGRESS.md).
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
        (this.games as any[]).filter(
          (game) => game.status === "active" && isMyGame(game, this.myUserId, this.userEmail)
        ),
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
    this.viewportUnwatch = watchDesktopViewport((isDesktop) => {
      this.isDesktop = isDesktop;
      this.open = isDesktop && loadOpenPreference();
    });
  },
  beforeDestroy() {
    if (this.gamesChannel) {
      (this.client as any).removeChannel(this.gamesChannel);
      this.gamesChannel = null;
    }
    if (this.viewportUnwatch) {
      this.viewportUnwatch();
      this.viewportUnwatch = null;
    }
  },
  methods: {
    // Any of this game's sub-games (Gaia, chess, renju, ...) waiting on me - the same predicate
    // GameBar labels with its tiny turn-kind glyphs.
    hasPendingTurn(game: any): boolean {
      return hasPendingTurn(game, this.myUserId, this.userEmail);
    },
    setOpen(open: boolean) {
      this.open = open;
      if (this.isDesktop) {
        saveOpenPreference(open);
      }
    },
    toggleOpen() {
      this.setOpen(!this.open);
    },
    async refresh() {
      this.loading = true;
      const { data, error } = await (this.client as any)
        .from("games")
        .select("*, players(*), chess_board(*), renju_board(*)")
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
        .on("postgres_changes", { event: "*", schema: "public", table: "chess_board" }, () => this.refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "renju_board" }, () => this.refresh())
        .subscribe();
    },
    onRowClick(game: any, event: MouseEvent) {
      // Active/finished games swap in place (no reload) - open-lobby rows still go through the
      // normal `?preview=` join flow, which has its own dedicated screen this menu doesn't
      // reproduce. A modifier-clicked link (open in new tab, etc.) must still behave like a real
      // link, so only intercept a plain left click.
      if (
        this.tab === "open" ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      // This is a docked desktop panel - it doesn't cover the board, so picking a game leaves it
      // open, matching a typical persistent app-shell side menu (unlike the mobile overlay this
      // used to also be, which had to close to reveal the board underneath).
      this.$emit("select-game", game.id);
    },
  },
});
</script>

<style lang="scss" scoped>
// Wide enough that a GameBar.vue row (round/seats badge + name/tags + move summary + up to 4
// stacked player avatars) never needs to truncate anything - this panel is desktop-only (see the
// component doc comment), so there's no phone-width constraint to design around like Lobby.vue's
// own page column has to. Widened from an earlier, avatar-less 320px design; keep in sync with
// frontend.scss's `#app.game-nav-open` reservation, which must match this width exactly.
.game-nav__panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 420px;
  max-width: 100vw;
  background: var(--ui-surface);
  border-right: 1px solid var(--ui-border);
  box-shadow: 4px 0 16px var(--ui-shadow);
  z-index: 1050;
  display: flex;
  flex-direction: column;
}

.game-nav__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--ui-border);
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
    background: var(--ui-accent-soft);
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
  gap: 0.3rem;
}

// The GameBar.vue row itself supplies `.game-bar`'s own background/spacing/pulse styling
// (global, see that component's doc comment) - this wrapper only adds the "currently open game"
// outline, a row-level hover, and (below) forces this panel's narrower GameBar rows to wrap their
// title/summary instead of truncating, since GameBar.vue's own wrap rule only kicks in below a
// phone-width viewport and this panel can be narrower than that without the *window* being.
.game-nav__row {
  border-radius: 0.4rem;
  overflow: hidden;

  &:hover {
    background: var(--ui-surface-hover);
  }

  &--current {
    outline: 2px solid var(--ui-link);
  }
}
</style>

<style lang="scss">
.game-nav__row .game-bar__title,
.game-nav__row .game-bar__summary {
  white-space: normal;
}
</style>
