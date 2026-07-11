<template>
  <div class="game-nav gaia-viewer-game">
    <button
      type="button"
      class="game-nav__toggle"
      @click="open = !open"
      :aria-label="open ? 'Close game menu' : 'Open game menu'"
    >
      <span aria-hidden="true">&#9776;</span>
    </button>

    <div v-if="open" class="game-nav__panel">
      <div class="game-nav__header">
        <a href="?create=1" class="btn btn-primary btn-sm">+ New game</a>
        <button type="button" class="game-nav__close" @click="open = false" aria-label="Close">&times;</button>
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
          <a
            v-for="game in visibleGames"
            :key="game.id"
            :href="tab === 'open' ? `?preview=${game.id}` : `?game=${game.id}`"
            class="game-nav__row"
            :class="{ 'game-nav__row--turn': isMyTurn(game), 'game-nav__row--current': game.id === currentGameId }"
            @click="onRowClick(game, $event)"
          >
            <span class="game-nav__row-name">{{ game.name || "Unnamed game" }}</span>
            <span class="game-nav__row-meta text-muted small">
              <template v-if="game.status === 'open'">{{ claimedSeats(game) }}/{{ game.player_count }} seats</template>
              <template v-else-if="game.current_round != null">Round {{ game.current_round }}</template>
              <span v-if="isMyTurn(game)" class="game-nav__row-turn-dot" title="Your turn"></span>
            </span>
          </a>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";

/** Collapsible left-side main menu (owner's brief: "browse my games, lobby active games, finished
 * games... basically just be that main menu"), mirroring ChatNotesPanel.vue's own floating-toggle
 * + docked-panel shell on the opposite edge. Deliberately a light, standalone query rather than
 * reusing Lobby.vue wholesale - Lobby.vue carries a lot of unrelated chrome (release notes,
 * credits, nickname modal, admin delete-swipe) that has no place in an in-game side menu. Clicking
 * an active/finished game emits `select-game` so hosted.ts can swap the game in place (no reload);
 * open-lobby rows and "+ New game" still do a real navigation (join/create both have their own
 * dedicated flows, no need to reproduce them here). */
export default Vue.extend({
  name: "GameNavPanel",
  props: {
    client: { type: Object, required: true },
    session: { type: Object, required: true },
  },
  data() {
    return {
      open: false,
      tab: "active" as "active" | "open" | "finished",
      games: [] as any[],
      loading: true,
      gamesChannel: null as any,
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
      return ((this.session as any).user?.email ?? "").toLowerCase();
    },
    openGames(): any[] {
      return this.sortGames((this.games as any[]).filter((game) => game.status === "open"));
    },
    myActiveGames(): any[] {
      return this.sortGames(
        (this.games as any[]).filter((game) => game.status === "active" && this.isMyGame(game))
      );
    },
    myFinishedGames(): any[] {
      return this.sortGames(
        (this.games as any[]).filter((game) => game.status === "finished" && this.isMyGame(game))
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
    isMyGame(game: any): boolean {
      if (game.created_by === this.myUserId) {
        return true;
      }
      return (game.players ?? []).some(
        (player: any) =>
          player.user_id === this.myUserId || (player.invited_email ?? "").toLowerCase() === this.userEmail
      );
    },
    isMyTurn(game: any): boolean {
      if (game.status !== "active" || game.current_seat == null) {
        return false;
      }
      const seat = (game.players ?? []).find((p: any) => p.seat === game.current_seat);
      if (!seat) {
        return false;
      }
      return seat.user_id === this.myUserId || (seat.invited_email ?? "").toLowerCase() === this.userEmail;
    },
    claimedSeats(game: any): number {
      return (game.players ?? []).filter((p: any) => p.user_id != null).length;
    },
    sortGames(games: any[]): any[] {
      return [...games].sort((a, b) => {
        const aTurn = this.isMyTurn(a);
        const bTurn = this.isMyTurn(b);
        if (aTurn !== bTurn) {
          return aTurn ? -1 : 1;
        }
        const aTime = a.latest_move_committed_at ?? a.created_at ?? "";
        const bTime = b.latest_move_committed_at ?? b.created_at ?? "";
        return aTime < bTime ? 1 : aTime > bTime ? -1 : 0;
      });
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
      this.open = false;
      this.$emit("select-game", game.id);
    },
  },
});
</script>

<style lang="scss" scoped>
.game-nav__toggle {
  position: fixed;
  left: 1rem;
  bottom: 24px;
  z-index: 1040;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 0;
  background: #2f6fed;
  color: #fff;
  font-size: 1.35rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

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
  gap: 0.3rem;
}

.game-nav__row {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.4rem 0.55rem;
  border-radius: 0.4rem;
  background: rgba(0, 0, 0, 0.04);
  color: inherit;
  text-decoration: none;

  &:hover {
    background: rgba(0, 0, 0, 0.08);
  }

  &--turn {
    background: rgba(47, 111, 237, 0.12);
  }

  &--current {
    outline: 2px solid rgba(47, 111, 237, 0.5);
  }
}

.game-nav__row-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.game-nav__row-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.game-nav__row-turn-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #2f6fed;
}
</style>
