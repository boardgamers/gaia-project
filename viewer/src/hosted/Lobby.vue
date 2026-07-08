<template>
  <div class="container py-4" style="max-width: 46rem">
    <div class="lobby-header">
      <h3 class="mb-0">The Lost Fleet - Games</h3>
      <div class="lobby-header__actions">
        <b-button
          size="sm"
          :variant="pushEnabled ? 'success' : 'outline-secondary'"
          :disabled="pushBusy"
          v-b-tooltip.hover
          :title="
            pushEnabled
              ? 'This device is registered for turn notifications. Enable it separately on any other device you play from. Click to turn off.'
              : 'Enable turn notifications on this device'
          "
          @click="pushEnabled ? disablePush() : enablePush()"
        >
          &#128276; {{ pushEnabled ? "Notifications on" : "Enable notifications" }}
        </b-button>
        <b-button size="sm" variant="outline-secondary" @click="signOut">Sign out</b-button>
      </div>
    </div>

    <div class="lobby-meta text-muted small mb-3">
      <span>{{ userEmail }}</span>
      <span class="lobby-meta__sep">&middot;</span>
      <span class="font-weight-bold">Version {{ currentRelease.version }}</span>
      <span class="lobby-meta__sep">&middot;</span>
      <span>{{ currentRelease.releasedAt }}</span>
      <span class="lobby-meta__sep">&middot;</span>
      <a href="" class="lobby-meta__toggle-link" @click.prevent="showReleaseNotes = true">View changelog</a>
    </div>

    <div v-if="showReleaseNotes" class="release-modal-backdrop" @click.self="showReleaseNotes = false">
      <div class="release-modal shadow-lg" role="dialog" aria-modal="true" aria-label="Changelog">
        <div class="release-modal__header">
          <div>
            <div class="release-notes__eyebrow text-uppercase text-muted small">Recent changes</div>
            <h4 class="release-modal__title mb-0">Hosted changelog</h4>
          </div>
          <button type="button" class="release-modal__close" aria-label="Close changelog" @click="showReleaseNotes = false">
            &times;
          </button>
        </div>
        <div class="release-modal__body">
          <div v-for="entry in releaseEntries" :key="`${entry.version}-${entry.releasedAt}`" class="release-notes__entry">
            <div class="release-notes__heading">
              <span class="release-notes__kind">{{ entry.kind }}</span>
              <strong>v{{ entry.version }}</strong>
              <span class="text-muted">&middot; {{ entry.releasedAt }}</span>
            </div>
            <div class="release-notes__title">{{ entry.title }}</div>
            <div v-if="entry.impact" class="release-notes__impact text-muted small">Impact: {{ entry.impact }}</div>
            <ul class="release-notes__list mb-0">
              <li v-for="change in entry.changes" :key="change">{{ change }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <b-alert :show="!!message" variant="info" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <div class="lobby-toolbar mb-3">
      <div class="lobby-tabs" role="tablist" aria-label="Game status tabs">
        <button
          type="button"
          class="lobby-tab"
          :class="{ 'lobby-tab--active': activeTab === 'active' }"
          @click="activeTab = 'active'"
        >
          Active <span class="lobby-tab__count">{{ activeGames.length }}</span>
        </button>
        <button
          type="button"
          class="lobby-tab"
          :class="{ 'lobby-tab--active': activeTab === 'finished' }"
          @click="activeTab = 'finished'"
        >
          Finished <span class="lobby-tab__count">{{ finishedGames.length }}</span>
        </button>
      </div>
      <div class="lobby-toolbar__actions">
        <a href="?create=1" class="btn btn-primary">+ New game</a>
        <a v-if="isAdmin" href="?users=1" class="btn btn-outline-secondary">Manage users</a>
      </div>
    </div>

    <b-list-group class="mb-3">
      <b-list-group-item v-if="loading">Loading games...</b-list-group-item>
      <b-list-group-item v-else-if="visibleGames.length === 0">
        {{ activeTab === "active" ? "No active games yet." : "No finished games yet." }}
      </b-list-group-item>
      <b-list-group-item v-for="game in visibleGames" :key="game.id" class="game-bar d-flex align-items-center">
        <a :href="`?game=${game.id}`" class="text-body text-decoration-none flex-grow-1 game-bar__link">
          <span class="game-bar__identity">
            <span class="game-bar__round-slot">
              <span v-if="game.current_round != null" class="game-bar__round">R{{ game.current_round }}</span>
            </span>
            <span class="game-bar__title">
              <strong>{{ game.name || "Unnamed game" }}</strong>
              <span class="text-muted small">
                &middot; {{ game.player_count }}p &middot; {{ game.options && game.options.lostFleet ? "Lost Fleet" : "base game" }}
                <template v-if="isTestGame(game)"> &middot; Test game</template>
              </span>
            </span>
          </span>
          <span v-if="playersWithSummary(game).length > 0" class="game-bar__players gaia-viewer-game">
            <span
              v-for="player in playersWithSummary(game)"
              :key="player.seat"
              class="game-bar__player"
              :class="{ 'game-bar__player--active': player.seat === game.current_seat }"
              :title="playerBarTitle(game, player)"
            >
              <span class="game-bar__avatar">
                <svg viewBox="-22 -22 44 44"><Token :faction="player.faction" /></svg>
                <span class="game-bar__initial">{{ factionInitial(player) }}</span>
                <span class="game-bar__score">{{ player.score != null ? player.score : "-" }}</span>
              </span>
            </span>
          </span>
          <span v-else class="game-bar__players-spacer"></span>
          <b-badge :variant="badgeVariant(game)" class="game-bar__badge">{{ turnLabel(game) }}</b-badge>
        </a>
        <b-button v-if="isAdmin" size="sm" variant="outline-danger" class="ml-2" @click="deleteGame(game)">Delete</b-button>
      </b-list-group-item>
    </b-list-group>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { disablePushNotifications, enablePushNotifications, isPushEnabled } from "./push";
import Token from "../components/Token.vue";
import { factionName } from "../data/factions";
import { isAdminEmail } from "./admin";
import releaseData from "./release.json";

type ReleaseEntry = {
  version: string;
  releasedAt: string;
  kind: string;
  title: string;
  impact?: string;
  changes: string[];
};

export default Vue.extend({
  name: "HostedLobby",
  components: { Token },
  props: {
    client: { type: Object, required: true },
    session: { type: Object, required: true },
  },
  data() {
    return {
      games: [] as any[],
      loading: true,
      pushBusy: false,
      pushEnabled: false,
      message: "",
      gamesChannel: null as any,
      showReleaseNotes: false,
      activeTab: "active" as "active" | "finished",
    };
  },
  computed: {
    userEmail(): string {
      return (this.session as any).user?.email ?? "";
    },
    myUserId(): string {
      return (this.session as any).user?.id ?? "";
    },
    isAdmin(): boolean {
      return isAdminEmail(this.userEmail);
    },
    currentRelease(): { version: string; releasedAt: string } {
      return {
        version: (releaseData as any).version,
        releasedAt: (releaseData as any).releasedAt,
      };
    },
    releaseEntries(): ReleaseEntry[] {
      return ((releaseData as any).entries ?? []).slice(0, 6);
    },
    activeGames(): any[] {
      return (this.games as any[]).filter((game) => game.status !== "finished");
    },
    finishedGames(): any[] {
      return (this.games as any[]).filter((game) => game.status === "finished");
    },
    visibleGames(): any[] {
      return this.activeTab === "active" ? this.activeGames : this.finishedGames;
    },
  },
  created() {
    this.refresh();
    this.subscribeGames();
    isPushEnabled().then((enabled) => {
      this.pushEnabled = enabled;
    });
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
      if (error) {
        this.message = `Could not load games: ${error.message}`;
      } else {
        this.games = data ?? [];
      }
      this.loading = false;
    },
    subscribeGames() {
      const channel = (this.client as any)
        .channel("lobby-games")
        .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => this.refresh())
        .subscribe();
      this.gamesChannel = channel;
    },
    playerAtSeat(game: any, seat: number | null): any {
      return (game.players ?? []).find((p: any) => p.seat === seat);
    },
    playersWithSummary(game: any): any[] {
      return (game.players ?? [])
        .filter((p: any) => !!p.faction)
        .slice()
        .sort((a: any, b: any) => a.seat - b.seat);
    },
    factionInitial(player: any): string {
      return player.faction ? player.faction.substr(0, 1).toUpperCase() : "";
    },
    playerBarTitle(game: any, player: any): string {
      const name = player.display_name || player.invited_email;
      const vp = player.score != null ? `${player.score} VP` : "no score yet";
      return `${name} - ${factionName(player.faction)} - ${vp}`;
    },
    isTestGame(game: any): boolean {
      const players = game.players ?? [];
      const userIds = players.map((p: any) => p.user_id).filter((id: string | null) => !!id);
      return userIds.length > 0 && new Set(userIds).size < players.length;
    },
    turnLabel(game: any): string {
      if (game.status === "finished") {
        return "finished";
      }
      const player = this.playerAtSeat(game, game.current_seat);
      if (!player) {
        return "active";
      }
      const mine = player.user_id === this.myUserId;
      return mine ? "your turn" : `${player.display_name || player.invited_email} to move`;
    },
    badgeVariant(game: any): string {
      if (game.status === "finished") {
        return "secondary";
      }
      const player = this.playerAtSeat(game, game.current_seat);
      return player && player.user_id === this.myUserId ? "success" : "info";
    },
    async deleteGame(game: any) {
      if (!window.confirm(`Delete "${game.name || "this game"}"? This cannot be undone.`)) {
        return;
      }
      const { error } = await (this.client as any).rpc("delete_game", { p_game_id: game.id });
      if (error) {
        this.message = `Could not delete the game: ${error.message}`;
      } else {
        await this.refresh();
      }
    },
    async enablePush() {
      this.pushBusy = true;
      this.message = await enablePushNotifications(this.client, (this.session as any).user.id);
      this.pushEnabled = await isPushEnabled();
      this.pushBusy = false;
    },
    async disablePush() {
      this.pushBusy = true;
      this.message = await disablePushNotifications(this.client);
      this.pushEnabled = await isPushEnabled();
      this.pushBusy = false;
    },
    async signOut() {
      await (this.client as any).auth.signOut();
      window.location.reload();
    },
  },
});
</script>

<style lang="scss" scoped>
.lobby-header,
.lobby-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.lobby-header__actions,
.lobby-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.lobby-tabs {
  display: inline-flex;
  gap: 0.3rem;
  padding: 0.22rem;
  border-radius: 999px;
  background: #edf2f8;
}

.lobby-tab {
  border: 0;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  background: transparent;
  color: #44526a;
  font-size: 0.85rem;
  font-weight: 700;

  &--active {
    background: #343a40;
    color: #fff;
  }
}

.lobby-tab__count {
  opacity: 0.75;
}

.lobby-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.lobby-meta__sep {
  color: #adb5bd;
}

.lobby-meta__toggle-link {
  color: #0b5ed7;
  text-decoration: none;
}

.lobby-meta__toggle-link:hover {
  color: #084298;
  text-decoration: underline;
}

.release-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(15, 23, 42, 0.42);
}

.release-modal {
  width: min(100%, 42rem);
  overflow: hidden;
  border: 1px solid #dce6f0;
  border-radius: 0.85rem;
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
}

.release-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.1rem 0.85rem;
  border-bottom: 1px solid #e9ecef;
}

.release-modal__title {
  font-size: 1.05rem;
}

.release-modal__close {
  border: 0;
  background: transparent;
  color: #6c757d;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0;
}

.release-modal__close:hover {
  color: #212529;
}

.release-modal__body {
  padding: 1rem 1.1rem 1.15rem;
  max-height: min(68vh, 32rem);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.release-notes__eyebrow {
  letter-spacing: 0.08em;
  margin-bottom: 0.2rem;
}

.release-notes__entry + .release-notes__entry {
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid #e9ecef;
}

.release-notes__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  margin-bottom: 0.2rem;
}

.release-notes__kind {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #0b5ed7;
  background: #e7f1ff;
  border-radius: 999px;
  padding: 0.22rem 0.45rem;
}

.release-notes__title {
  font-weight: 600;
  color: #212529;
}

.release-notes__impact {
  margin-top: 0.15rem;
}

.release-notes__list {
  margin-top: 0.45rem;
  padding-left: 1.15rem;
}

.game-bar {
  min-height: 4.5rem;
}

.game-bar__link {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  min-height: 100%;
}

.game-bar__identity {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  flex: 1 1 auto;
}

.game-bar__round-slot {
  width: 2.35rem;
  flex-shrink: 0;
}

.game-bar__round {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: #495057;
  background: #e9ecef;
  border-radius: 0.25rem;
  padding: 0.1rem 0.4rem;
}

.game-bar__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-bar__players {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  margin-left: auto;
}

.game-bar__players-spacer {
  margin-left: auto;
}

.game-bar__badge {
  flex-shrink: 0;
  white-space: nowrap;
}

.game-bar__player {
  display: flex;
  align-items: center;
  padding: 0.15rem;
  border-radius: 50%;
  border: 2px solid transparent;

  &--active {
    border-color: var(--success, #28a745);
    background: rgba(40, 167, 69, 0.35);
    box-shadow: 0 0 0 1px var(--success, #28a745);
  }
}

.game-bar__avatar {
  position: relative;
  display: inline-flex;
  width: 1.9rem;
  height: 1.9rem;

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.game-bar__initial {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.85), 0 0 3px rgba(0, 0, 0, 0.85);
  pointer-events: none;
}

.game-bar__score {
  position: absolute;
  bottom: -0.3rem;
  right: -0.4rem;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  background: #495057;
  border-radius: 0.6rem;
  padding: 0.15rem 0.3rem;
  min-width: 0.9rem;
  text-align: center;
  box-shadow: 0 0 0 1px #fff;
}

@media (max-width: 767px) {
  .lobby-header,
  .lobby-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .lobby-header__actions,
  .lobby-toolbar__actions {
    display: grid;
  }

  .lobby-tabs {
    align-self: flex-start;
  }
}
</style>
