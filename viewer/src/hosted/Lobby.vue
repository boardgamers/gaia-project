<template>
  <div class="container py-4" style="max-width: 46rem">
    <div class="lobby-header">
      <h3 class="mb-0">Gaia Project: The Lost Fleet</h3>
      <div class="lobby-header__actions">
        <b-button
          size="sm"
          class="lobby-icon-button"
          :variant="pushEnabled ? 'success' : 'outline-secondary'"
          :disabled="pushBusy"
          v-b-tooltip.hover
          :title="
            pushEnabled
              ? 'This device is registered for turn notifications. Enable it separately on any other device you play from. Click to turn off.'
              : 'Enable turn notifications on this device'
          "
          aria-label="Toggle notifications"
          @click="pushEnabled ? disablePush() : enablePush()"
        >
          &#128276;
        </b-button>
        <b-dropdown
          size="sm"
          right
          no-caret
          variant="outline-secondary"
          toggle-class="lobby-icon-button"
          menu-class="lobby-settings-menu"
        >
          <template #button-content>
            <span aria-hidden="true">&#9881;</span>
            <span class="sr-only">Settings</span>
          </template>
          <template v-if="isAdmin">
            <b-dropdown-header>Admin only</b-dropdown-header>
            <b-dropdown-item href="?users=1">Manage users</b-dropdown-item>
            <b-dropdown-divider></b-dropdown-divider>
          </template>
          <b-dropdown-item-button @click="signOut">Sign out</b-dropdown-item-button>
        </b-dropdown>
      </div>
    </div>

    <div class="lobby-meta text-muted small mb-3">
      <span class="font-weight-bold">Version {{ currentRelease.version }}</span>
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
          :class="{ 'lobby-tab--active': activeTab === 'mine' }"
          @click="activeTab = 'mine'"
        >
          My games <span class="lobby-tab__count">{{ myGames.length }}</span>
        </button>
        <button
          type="button"
          class="lobby-tab"
          :class="{ 'lobby-tab--active': activeTab === 'open' }"
          @click="activeTab = 'open'"
        >
          Lobby <span class="lobby-tab__count">{{ openGames.length }}</span>
        </button>
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
      </div>
    </div>

    <b-list-group v-if="loading || visibleGames.length === 0" class="mb-3">
      <b-list-group-item v-if="loading">Loading games...</b-list-group-item>
      <b-list-group-item v-else>
        {{ emptyStateText }}
      </b-list-group-item>
    </b-list-group>

    <div v-else class="lobby-games">
      <div
        v-for="game in visibleGames"
        :key="game.id"
        class="game-swipe"
        @pointerdown="startSwipe(game.id, $event)"
        @pointermove="moveSwipe(game.id, $event)"
        @pointerup="endSwipe(game.id, $event)"
        @pointercancel="endSwipe(game.id, $event)"
      >
        <div v-if="isAdmin" class="game-swipe__actions">
          <button type="button" class="game-swipe__delete" @click.stop="deleteGame(game)">Delete</button>
        </div>
        <b-list-group-item class="game-bar" :style="{ transform: `translateX(${swipeOffset(game.id)}px)` }">
          <a
            :href="game.status === 'open' ? `?preview=${game.id}` : `?game=${game.id}`"
            class="text-body text-decoration-none flex-grow-1 game-bar__link"
            @click="handleGameClick(game.id, $event)"
          >
            <span class="game-bar__identity">
              <span class="game-bar__round-slot">
                <span v-if="game.current_round != null" class="game-bar__round">R{{ game.current_round }}</span>
              </span>
              <span class="game-bar__copy">
                <span class="game-bar__title">
                  <strong>{{ game.name || "Unnamed game" }}</strong>
                  <span v-if="game.status === 'open'" class="game-bar__tag">{{ claimedSeats(game) }}/{{ game.player_count }} joined</span>
                  <span v-if="auctionLabel(game)" class="game-bar__tag">{{ auctionLabel(game) }}</span>
                  <span v-if="isTestGame(game)" class="game-bar__tag">Test game</span>
                </span>
                <span v-if="summaryForGame(game)" class="game-bar__summary text-muted small">
                  <span v-if="moveAge(game)" class="game-bar__age">{{ moveAge(game) }}</span>
                  {{ summaryForGame(game) }}
                </span>
              </span>
            </span>
            <span
              v-if="playersWithSummary(game).length > 0"
              class="game-bar__players gaia-viewer-game"
              :class="{ 'game-bar__players--stacked': playersWithSummary(game).length >= 3 }"
            >
              <span v-for="(row, rowIndex) in playerRows(game)" :key="`row-${rowIndex}`" class="game-bar__player-row">
                <span
                  v-for="(player, index) in row"
                  :key="player.seat"
                  class="game-bar__player"
                  :style="{ zIndex: String(row.length - index) }"
                  :title="playerBarTitle(game, player)"
                >
                  <span class="game-bar__avatar">
                    <svg viewBox="-22 -22 44 44"><Token :faction="player.faction" /></svg>
                    <span class="game-bar__initial">{{ factionInitial(player) }}</span>
                    <span class="game-bar__presence" :class="`game-bar__presence--${playerPresence(game, player)}`"></span>
                    <span class="game-bar__score" :class="{ 'game-bar__score--active': player.seat === game.current_seat }">
                      {{ player.score != null ? player.score : "-" }}
                    </span>
                  </span>
                </span>
              </span>
            </span>
          </a>
        </b-list-group-item>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { presenceStatus, PresenceState, trackPresence } from "./presence";
import { disablePushNotifications, enablePushNotifications, isPushEnabled } from "./push";
import Token from "../components/Token.vue";
import { factionName } from "../data/factions";
import { isAdminEmail } from "./admin";
import releaseData from "./release.json";

const SWIPE_ACTION_WIDTH = 88;

function compactFactionLabel(raw: string): string {
  if (!raw) {
    return "";
  }
  if (raw.startsWith("p") && /^p\d+$/.test(raw)) {
    return raw.toUpperCase();
  }
  try {
    return factionName(raw as any);
  } catch {
    return raw
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}

function powerOrQicActionLabel(action: string): string | null {
  const match = action.match(/^(power|qic)(\d+)$/);
  return match ? `${match[1]} action ${match[2]}.` : null;
}

function compactMoveSummary(move: string): string | null {
  const trimmed = (move ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed
    .split(".")
    .map((part) => part.trim())
    .filter((part) => !!part);
  if (parts.length === 0) {
    return null;
  }
  const commands = parts.map((part) => part.split(/\s+/));
  const actor = compactFactionLabel(commands[0][0]);
  const primary =
    commands.find((tokens) =>
      ["build", "up", "explore", "federation", "action", "spaceshipAction", "pass", "banFaction", "faction"].includes(
        tokens[1]
      )
    ) ?? commands[0];
  let detail: string | null = null;

  switch (primary[1]) {
    case "build": {
      const kind = primary[2];
      if (kind === "m" && primary[3]) {
        const sector = primary[3].match(/^(\d+|DS\d+|IS\d+)/)?.[1];
        detail = sector ? `build mine sector ${sector}.` : "build mine.";
      } else if (kind === "t") {
        detail = "build ts.";
      } else if (kind === "l") {
        detail = "build lab.";
      } else if (kind === "i") {
        detail = "build PI.";
      } else {
        detail = `build ${kind ?? ""}.`.replace(/\s+\./, ".");
      }
      break;
    }
    case "up":
      detail = primary[2] ? `up ${primary[2]}.` : "up.";
      break;
    case "explore":
      detail = primary[2] ? `explore ${primary[2]}.` : "explore.";
      break;
    case "federation":
      detail = "form fed.";
      break;
    case "action":
      detail = primary[2] ? powerOrQicActionLabel(primary[2]) ?? `${primary[2]}.` : "action.";
      break;
    case "spaceshipAction":
      detail = primary[2] && primary[3] ? `${primary[2]} ${primary[3]}.` : "ship action.";
      break;
    case "pass":
      detail = primary[2] ? `pass ${primary[2]}.` : "pass.";
      break;
    case "banFaction":
      detail = primary[2] ? `ban ${compactFactionLabel(primary[2])}.` : "ban faction.";
      break;
    case "faction":
      detail = primary[2] ? `pick ${compactFactionLabel(primary[2])}.` : "pick faction.";
      break;
    default:
      detail = primary.slice(1).join(" ");
      if (detail && !detail.endsWith(".")) {
        detail += ".";
      }
      break;
  }

  return detail ? `${actor} ${detail}` : null;
}

function formatMoveAge(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return null;
  }
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type ReleaseEntry = {
  version: string;
  releasedAt: string;
  kind: string;
  title: string;
  visible?: boolean;
  changes: string[];
};

function lobbyPresenceStatus(state: PresenceState, userId: string | null, gameId: string): "green" | "yellow" | "grey" {
  return presenceStatus(state, userId, gameId);
}

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
      activeTab: "open" as "mine" | "open" | "active" | "finished",
      revealedGameId: "" as string,
      swipeGameId: "" as string,
      swipeStartX: 0,
      swipeDeltaX: 0,
      documentPointerDownHandler: null as ((event: PointerEvent) => void) | null,
      stopPresenceTracking: null as (() => void) | null,
      presenceState: {} as PresenceState,
    };
  },
  computed: {
    userEmail(): string {
      return (this.session as any).user?.email ?? "";
    },
    isAdmin(): boolean {
      return isAdminEmail(this.userEmail);
    },
    myUserId(): string {
      return (this.session as any).user?.id ?? "";
    },
    currentRelease(): { version: string; releasedAt: string } {
      return {
        version: (releaseData as any).version,
        releasedAt: (releaseData as any).releasedAt,
      };
    },
    releaseEntries(): ReleaseEntry[] {
      return ((releaseData as any).entries ?? []).filter((entry: ReleaseEntry) => entry.visible !== false).slice(0, 5);
    },
    openGames(): any[] {
      return (this.games as any[]).filter((game) => game.status === "open");
    },
    activeGames(): any[] {
      return (this.games as any[]).filter((game) => game.status === "active");
    },
    myGames(): any[] {
      const email = this.userEmail.toLowerCase();
      return (this.games as any[]).filter((game) => {
        if (game.created_by === this.myUserId) {
          return true;
        }
        return (game.players ?? []).some(
          (player: any) => player.user_id === this.myUserId || (player.invited_email ?? "").toLowerCase() === email
        );
      });
    },
    finishedGames(): any[] {
      return (this.games as any[]).filter((game) => game.status === "finished");
    },
    visibleGames(): any[] {
      if (this.activeTab === "mine") {
        return this.myGames;
      }
      if (this.activeTab === "open") {
        return this.openGames;
      }
      return this.activeTab === "active" ? this.activeGames : this.finishedGames;
    },
    emptyStateText(): string {
      if (this.activeTab === "mine") {
        return "No games with you in them yet.";
      }
      if (this.activeTab === "open") {
        return "No open lobby games right now.";
      }
      return this.activeTab === "active" ? "No active games yet." : "No finished games yet.";
    },
  },
  created() {
    this.refresh();
    this.subscribeGames();
    const userId = (this.session as any).user?.id;
    if (userId) {
      this.stopPresenceTracking = trackPresence(this.client as any, userId, { type: "lobby" }, (state) => {
        this.presenceState = state;
      });
    }
    isPushEnabled().then((enabled) => {
      this.pushEnabled = enabled;
    });
    this.activeTab = "open";
    if (typeof document !== "undefined") {
      this.documentPointerDownHandler = (event: PointerEvent) => this.onDocumentPointerDown(event);
      document.addEventListener("pointerdown", this.documentPointerDownHandler, true);
    }
  },
  beforeDestroy() {
    if (this.gamesChannel) {
      (this.client as any).removeChannel(this.gamesChannel);
      this.gamesChannel = null;
    }
    if (this.stopPresenceTracking) {
      this.stopPresenceTracking();
      this.stopPresenceTracking = null;
    }
    if (typeof document !== "undefined" && this.documentPointerDownHandler) {
      document.removeEventListener("pointerdown", this.documentPointerDownHandler, true);
    }
  },
  methods: {
    onDocumentPointerDown(event: PointerEvent) {
      if (!(event.target as HTMLElement | null)?.closest?.(".game-swipe")) {
        this.revealedGameId = "";
      }
    },
    async refresh() {
      this.loading = true;
      const { data, error } = await (this.client as any)
        .from("games")
        .select("*, players(*)")
        .order("created_at", { ascending: false });
      if (error) {
        this.message = `Could not load games: ${error.message}`;
      } else {
        const games = (data ?? []).map((game: any) => ({ ...game }));
        const gameIds = games.map((game: any) => game.id);
        if (gameIds.length > 0) {
          const latestMoves = await (this.client as any)
            .from("moves")
            .select("game_id,seq,move,committed_at")
            .in("game_id", gameIds)
            .order("seq", { ascending: false });
          if (!latestMoves.error) {
            const summaries = new Map<string, { summary: string | null; createdAt: string | null }>();
            for (const row of latestMoves.data ?? []) {
              if (!summaries.has(row.game_id)) {
                summaries.set(row.game_id, { summary: compactMoveSummary(row.move), createdAt: row.committed_at ?? null });
              }
            }
            for (const game of games) {
              const latest = summaries.get(game.id);
              game._fallback_latest_move_summary = latest?.summary ?? null;
              game._latest_move_created_at = latest?.createdAt ?? null;
            }
          }
        }
        this.games = games;
      }
      this.loading = false;
    },
    subscribeGames() {
      const channel = (this.client as any)
        .channel("lobby-games")
        .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => this.refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => this.refresh())
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
    playerRows(game: any): any[][] {
      const players = this.playersWithSummary(game);
      return players.length >= 3 ? [players.slice(0, 2), players.slice(2, 4)] : [players];
    },
    factionInitial(player: any): string {
      return player.faction ? player.faction.substr(0, 1).toUpperCase() : "";
    },
    playerBarTitle(game: any, player: any): string {
      const name = player.display_name || player.invited_email;
      const vp = player.score != null ? `${player.score} VP` : "no score yet";
      return `${name} - ${factionName(player.faction)} - ${vp}`;
    },
    playerPresence(game: any, player: any): "green" | "yellow" | "grey" {
      return lobbyPresenceStatus(this.presenceState, player.user_id ?? null, game.id);
    },
    isTestGame(game: any): boolean {
      if (game.status === "open") {
        return false;
      }
      const players = game.players ?? [];
      const userIds = players.map((p: any) => p.user_id).filter((id: string | null) => !!id);
      return userIds.length > 0 && new Set(userIds).size < players.length;
    },
    auctionLabel(game: any): string {
      return game.options?.auction === "silent" ? "Silent Auction" : "Standard";
    },
    summaryForGame(game: any): string | null {
      if (game.status === "open") {
        return null;
      }
      return game.latest_move_summary || game._fallback_latest_move_summary || null;
    },
    moveAge(game: any): string | null {
      if (game.status === "open") {
        return null;
      }
      return formatMoveAge(game._latest_move_created_at);
    },
    claimedSeats(game: any): number {
      return (game.players ?? []).filter((player: any) => !!player.user_id).length;
    },
    swipeOffset(gameId: string): number {
      if (!this.isAdmin) {
        return 0;
      }
      if (this.swipeGameId === gameId) {
        const base = this.revealedGameId === gameId ? -SWIPE_ACTION_WIDTH : 0;
        return Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, base + this.swipeDeltaX));
      }
      return this.revealedGameId === gameId ? -SWIPE_ACTION_WIDTH : 0;
    },
    startSwipe(gameId: string, event: PointerEvent) {
      if (!this.isAdmin || (event.target as HTMLElement | null)?.closest(".game-swipe__delete")) {
        return;
      }
      this.swipeGameId = gameId;
      this.swipeStartX = event.clientX;
      this.swipeDeltaX = 0;
      (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    },
    moveSwipe(gameId: string, event: PointerEvent) {
      if (this.swipeGameId !== gameId) {
        return;
      }
      this.swipeDeltaX = event.clientX - this.swipeStartX;
    },
    endSwipe(gameId: string, event: PointerEvent) {
      if (this.swipeGameId !== gameId) {
        return;
      }
      this.revealedGameId = this.swipeOffset(gameId) <= -(SWIPE_ACTION_WIDTH / 2) ? gameId : "";
      this.swipeGameId = "";
      this.swipeDeltaX = 0;
      (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
    },
    handleGameClick(gameId: string, event: MouseEvent) {
      if (this.revealedGameId === gameId) {
        event.preventDefault();
        this.revealedGameId = "";
      }
    },
    async deleteGame(game: any) {
      if (!window.confirm(`Delete "${game.name || "this game"}"? This cannot be undone.`)) {
        return;
      }
      const { error } = await (this.client as any).rpc("delete_game", { p_game_id: game.id });
      if (error) {
        this.message = `Could not delete the game: ${error.message}`;
      } else {
        this.revealedGameId = "";
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
  align-items: center;
  gap: 0.45rem;
}

.lobby-icon-button {
  min-width: 2.2rem;
  padding-left: 0.45rem;
  padding-right: 0.45rem;
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

.lobby-games {
  display: grid;
  gap: 0.55rem;
}

.game-swipe {
  position: relative;
  overflow: hidden;
  border-radius: 0.25rem;
}

.game-swipe__actions {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
  background: linear-gradient(180deg, #7a2020 0%, #541515 100%);
}

.game-swipe__delete {
  width: 88px;
  border: 0;
  background: transparent;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
}

.game-bar {
  min-height: 4.25rem;
  transition: transform 0.16s ease-out;
}

.game-bar__link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  min-height: 100%;
}

.game-bar__identity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-bar__copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.05rem;
  min-width: 0;
}

.game-bar__summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-bar__age {
  margin-right: 0.35rem;
  font-weight: 700;
  color: #6c757d;
}

.game-bar__tag {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 1.2rem;
  padding: 0.08rem 0.42rem;
  border-radius: 999px;
  background: #eef3f8;
  color: #55657a;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
}

.game-bar__players {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.18rem;
  flex-shrink: 0;
  margin-left: auto;
}

.game-bar__player-row {
  display: flex;
  align-items: center;
}

.game-bar__player {
  display: flex;
  align-items: center;
  padding: 0.1rem;
  position: relative;

  & + & {
    margin-left: -0.65rem;
  }
}

.game-bar__players--stacked {
  min-width: 3.35rem;
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

  &--active {
    background: #28a745;
  }
}

.game-bar__presence {
  position: absolute;
  top: -0.08rem;
  right: -0.02rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  border: 1px solid #fff;
  box-shadow: 0 0 0 1px rgba(73, 80, 87, 0.12);

  &--green {
    background: #28a745;
  }

  &--yellow {
    background: #f1c40f;
  }

  &--grey {
    background: #95a5a6;
  }
}

@media (max-width: 767px) {
  .lobby-header,
  .lobby-toolbar {
    align-items: center;
  }

  .lobby-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .lobby-tabs {
    align-self: flex-start;
  }

  .game-bar__title {
    white-space: normal;
  }

  .game-bar__summary {
    white-space: normal;
  }
}
</style>
