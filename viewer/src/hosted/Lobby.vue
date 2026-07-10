<template>
  <div class="container py-4" style="max-width: 46rem">
    <div class="lobby-header">
      <h3 class="mb-0">GP: Fight Club</h3>
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
          <b-dropdown-item-button @click="openNicknameModal">Edit nickname</b-dropdown-item-button>
          <b-dropdown-item-button @click="toggleDarkMode">{{
            isDarkMode ? "Light mode" : "Dark mode"
          }}</b-dropdown-item-button>
          <b-dropdown-item-button @click="showCredits = true">Credits</b-dropdown-item-button>
          <b-dropdown-item-button @click="signOut">Sign out</b-dropdown-item-button>
        </b-dropdown>
      </div>
    </div>

    <div class="lobby-meta text-muted small mb-3">
      <span class="font-weight-bold">Version {{ currentRelease.version }}</span>
      <span class="lobby-meta__sep">&middot;</span>
      <a href="" class="lobby-meta__toggle-link" @click.prevent="showReleaseNotes = true">View changelog</a>
    </div>

    <InfoModal :open="showReleaseNotes" title="Hosted changelog" @close="showReleaseNotes = false">
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
    </InfoModal>

    <InfoModal :open="showNicknameModal" title="Edit nickname" @close="closeNicknameModal">
      <p class="text-muted small">
        This is the name other players see in the lobby and in games, instead of your account name or email.
      </p>
      <b-form @submit.prevent="saveNickname">
        <b-form-input v-model="nicknameInput" maxlength="40" placeholder="Nickname" autofocus />
        <div class="d-flex justify-content-end mt-3" style="gap: 0.5rem">
          <b-button variant="outline-secondary" type="button" @click="closeNicknameModal">Cancel</b-button>
          <b-button type="submit" variant="primary" :disabled="nicknameSaving || !nicknameInput.trim()">Save</b-button>
        </div>
      </b-form>
    </InfoModal>

    <InfoModal :open="showCredits" title="Credits" @close="showCredits = false">
      <CreditsContent />
    </InfoModal>

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
        <span class="lobby-online d-md-none" :title="`${onlineCount} online`">
          <span class="lobby-online__dot"></span>
          {{ onlineCount }} online
        </span>
      </div>
    </div>

    <b-list-group v-if="loading || visibleGames.length === 0" class="mb-3">
      <b-list-group-item v-if="loading">Loading games...</b-list-group-item>
      <b-list-group-item v-else-if="loadFailed" class="d-flex justify-content-between align-items-center">
        {{ emptyStateText }}
        <b-button size="sm" variant="outline-secondary" @click="refresh">Retry</b-button>
      </b-list-group-item>
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
        <b-list-group-item
          class="game-bar"
          :class="{ 'game-bar--my-turn': isMyTurn(game) }"
          :style="{ transform: `translateX(${swipeOffset(game.id)}px)` }"
        >
          <a
            :href="game.status === 'open' ? `?preview=${game.id}` : `?game=${game.id}`"
            class="text-body text-decoration-none flex-grow-1 game-bar__link"
            @click="handleGameClick(game.id, $event)"
          >
            <span class="game-bar__identity">
              <span class="game-bar__round-slot">
                <span v-if="game.current_round != null" class="game-bar__round">R{{ game.current_round }}</span>
                <span
                  v-else-if="game.status === 'open'"
                  class="game-bar__seats"
                  :title="`${claimedSeats(game)} of ${game.player_count} seats joined`"
                  >{{ claimedSeats(game) }}/{{ game.player_count }}</span
                >
              </span>
              <span class="game-bar__copy">
                <span class="game-bar__title">
                  <strong>{{ game.name || "Unnamed game" }}</strong>
                  <span v-if="auctionLabel(game)" class="game-bar__tag">{{ auctionLabel(game) }}</span>
                  <span v-if="game.options && game.options.banPhase" class="game-bar__tag">Ban Phase</span>
                  <span v-if="game.options && game.options.officialCenterSectors" class="game-bar__tag"
                    >Sector 1-4</span
                  >
                  <span v-if="isTestGame(game)" class="game-bar__tag">Test game</span>
                  <span v-if="game.abandoned_at" class="game-bar__tag game-bar__tag--abandoned">Abandoned</span>
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
                    <span
                      class="game-bar__presence"
                      :class="`game-bar__presence--${playerPresence(game, player)}`"
                    ></span>
                    <span
                      class="game-bar__score"
                      :class="{ 'game-bar__score--active': player.seat === game.current_seat }"
                    >
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
import CreditsContent from "../components/CreditsContent.vue";
import { factionName } from "../data/factions";
import { isAdminEmail } from "./admin";
import InfoModal from "./InfoModal.vue";
import { fetchMyNickname, setMyNickname } from "./profile";
import releaseData from "./release.json";
import { getTheme, toggleTheme } from "./theme";

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

// Same set as the engine's Command.ChargePower/BrainStone/ChooseIncome/Decline (logic/recent.ts's
// `outOfTurn`) - kept as raw string literals here since this fallback path deliberately has no
// @gaia-project/engine dependency (parses the raw move text only).
const OUT_OF_TURN_COMMANDS = ["charge", "brainstone", "income", "decline"];

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
  // A move made up entirely of leech/income decisions isn't a "turn" for lobby-summary purposes -
  // skip it so the previously shown main-action summary stays put instead of being overwritten.
  if (commands.every((tokens) => OUT_OF_TURN_COMMANDS.includes(tokens[1]))) {
    return null;
  }
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
  const rawMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(rawMs)) {
    return null;
  }
  // A slightly-behind client clock (or a move committed within the same second as this render)
  // can make the delta briefly negative - clamp to 0 ("just now") instead of hiding the age
  // entirely, which previously made the whole age display vanish for any client with even a few
  // seconds of clock skew relative to the server.
  const ms = Math.max(0, rawMs);
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

function lobbyPresenceStatus(
  state: PresenceState,
  userId: string | null,
  gameId: string,
  lastActiveAt: string | null
): "green" | "yellow" | "grey" {
  return presenceStatus(state, userId, gameId, lastActiveAt);
}

export default Vue.extend({
  name: "HostedLobby",
  components: { Token, InfoModal, CreditsContent },
  props: {
    client: { type: Object, required: true },
    session: { type: Object, required: true },
  },
  data() {
    return {
      games: [] as any[],
      loading: true,
      loadFailed: false,
      pushBusy: false,
      pushEnabled: false,
      message: "",
      gamesChannel: null as any,
      showReleaseNotes: false,
      showNicknameModal: false,
      showCredits: false,
      myNickname: "" as string,
      nicknameInput: "" as string,
      nicknameSaving: false,
      activeTab: "open" as "mine" | "open" | "active" | "finished",
      revealedGameId: "" as string,
      swipeGameId: "" as string,
      swipeStartX: 0,
      swipeDeltaX: 0,
      documentPointerDownHandler: null as ((event: PointerEvent) => void) | null,
      stopPresenceTracking: null as (() => void) | null,
      presenceState: {} as PresenceState,
      isDarkMode: getTheme() === "dark",
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
      return this.sortGames((this.games as any[]).filter((game) => game.status === "open"));
    },
    activeGames(): any[] {
      return this.sortGames((this.games as any[]).filter((game) => game.status === "active" && !this.isMyGame(game)));
    },
    myGames(): any[] {
      return this.sortGames((this.games as any[]).filter((game) => this.isMyGame(game)));
    },
    finishedGames(): any[] {
      return this.sortGames((this.games as any[]).filter((game) => game.status === "finished"));
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
    onlineCount(): number {
      return Object.keys(this.presenceState).filter((userId) => (this.presenceState[userId] ?? []).length > 0).length;
    },
    emptyStateText(): string {
      if (this.loadFailed) {
        return this.message || "Could not load games.";
      }
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
    fetchMyNickname(this.client as any, this.myUserId).then((nickname) => {
      this.myNickname = nickname;
      if (/^Player \d{4}$/.test(nickname)) {
        this.openNicknameModal();
      }
    });
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
      this.loadFailed = false;
      try {
        // Fire-and-forget: no pg_cron dependency for pruning week-old abandoned games, any lobby
        // visit nudges it along instead. Wrapped in Promise.resolve() because the query builder
        // returned by .rpc() is only thenable (implements .then()), not a real Promise - calling
        // .catch() directly on it throws synchronously instead of catching a rejection.
        Promise.resolve((this.client as any).rpc("prune_abandoned_games")).catch(() => undefined);
        // Race against a timeout too, not just try/catch: a genuinely hung request (dead
        // connection, no response ever) never rejects on its own, so try/catch alone still leaves
        // `loading` stuck forever on a bad network.
        const { data, error } = await Promise.race([
          (this.client as any).from("games").select("*, players(*)").order("created_at", { ascending: false }),
          new Promise<never>((_resolve, reject) =>
            setTimeout(() => reject(new Error("Timed out - check your connection")), 15000)
          ),
        ]);
        if (error) {
          throw new Error(error.message);
        }
        const games = (data ?? []).map((game: any) => ({ ...game }));
        // Only games missing their cached summary/timestamp (pre-existing rows from before those
        // columns existed, or a genuinely new row commit_turn hasn't touched yet) need this
        // fallback - deliberately NOT every game's id. An earlier version queried every game's
        // moves unconditionally with no cap; this project has 1500+ move rows total, well past
        // PostgREST's default row cap, so that cross-game query silently truncated and some
        // games' "time since last move" vanished (while latest_move_summary, cached separately at
        // commit time, kept working) - exactly the "summary shows, age doesn't" bug reported live.
        // latest_move_committed_at (migration 0026) now covers age directly with no query at all
        // for the common case; this fallback path is only for the increasingly rare gap.
        const fallbackIds = games
          .filter((game: any) => !game.latest_move_summary || !game.latest_move_committed_at)
          .map((game: any) => game.id);
        if (fallbackIds.length > 0) {
          const latestMoves = await (this.client as any)
            .from("moves")
            .select("game_id,seq,move,committed_at")
            .in("game_id", fallbackIds)
            .order("seq", { ascending: false });
          if (!latestMoves.error) {
            // "Time since last move" should reflect the literal latest row (even a leech/income
            // decision); the summary text should skip past any out-of-turn-only rows to the most
            // recent actual main action - the two are independent, so track them separately rather
            // than assuming the newest row has both.
            const summaries = new Map<string, { summary: string | null; createdAt: string | null }>();
            for (const row of latestMoves.data ?? []) {
              const existing = summaries.get(row.game_id);
              if (!existing) {
                summaries.set(row.game_id, {
                  summary: compactMoveSummary(row.move),
                  createdAt: row.committed_at ?? null,
                });
              } else if (existing.summary === null) {
                existing.summary = compactMoveSummary(row.move);
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
      } catch (err) {
        // A rejected fetch (a real network failure, not a server-returned error object) used to
        // leave `loading` stuck true forever - "Loading games..." with no way out and no error
        // shown, reported live as "no games show". Always land back in a recoverable state now.
        this.message = `Could not load games: ${err instanceof Error ? err.message : err}`;
        this.loadFailed = true;
      } finally {
        this.loading = false;
      }
    },
    subscribeGames() {
      const channel = (this.client as any)
        .channel("lobby-games")
        .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => this.refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => this.refresh())
        .subscribe();
      this.gamesChannel = channel;
    },
    isMyGame(game: any): boolean {
      if (game.created_by === this.myUserId) {
        return true;
      }
      const email = this.userEmail.toLowerCase();
      return (game.players ?? []).some(
        (player: any) => player.user_id === this.myUserId || (player.invited_email ?? "").toLowerCase() === email
      );
    },
    playerAtSeat(game: any, seat: number | null): any {
      return (game.players ?? []).find((p: any) => p.seat === seat);
    },
    isMyTurn(game: any): boolean {
      if (game.status !== "active" || game.current_seat == null) {
        return false;
      }
      const seat = this.playerAtSeat(game, game.current_seat);
      if (!seat) {
        return false;
      }
      const email = this.userEmail.toLowerCase();
      return seat.user_id === this.myUserId || (seat.invited_email ?? "").toLowerCase() === email;
    },
    lastMoveTimestamp(game: any): string | null {
      return game.latest_move_committed_at ?? game._latest_move_created_at ?? null;
    },
    lastMoveTime(game: any): number {
      const value = this.lastMoveTimestamp(game);
      return value ? new Date(value).getTime() : 0;
    },
    // Ordering (owner request): your-turn games first, then by most-recent-move-first; finished
    // games sort separately by most-recently-finished first, using the same "last move" timestamp
    // as a finish-time proxy. Both non-finished tiers and the finished tier all sort the same
    // direction (newest activity first) - only "is it my turn" ever takes priority over recency.
    sortGames(games: any[]): any[] {
      return [...games].sort((a, b) => {
        const aFinished = a.status === "finished";
        const bFinished = b.status === "finished";
        if (aFinished !== bFinished) {
          return aFinished ? 1 : -1;
        }
        if (aFinished) {
          return this.lastMoveTime(b) - this.lastMoveTime(a);
        }
        const aTurn = this.isMyTurn(a);
        const bTurn = this.isMyTurn(b);
        if (aTurn !== bTurn) {
          return aTurn ? -1 : 1;
        }
        return this.lastMoveTime(b) - this.lastMoveTime(a);
      });
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
      const name = player.display_name || "Unknown player";
      const vp = player.score != null ? `${player.score} VP` : "no score yet";
      return `${name} - ${factionName(player.faction)} - ${vp}`;
    },
    playerPresence(game: any, player: any): "green" | "yellow" | "grey" {
      return lobbyPresenceStatus(this.presenceState, player.user_id ?? null, game.id, player.last_active_at ?? null);
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
      switch (game.options?.auction) {
        case "silent":
          return "Silent Auction";
        case "choose-bid":
          return "Choose, Then Bid";
        case "bid-while-choosing":
          return "Bid While Choosing";
        default:
          return "Standard";
      }
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
      return formatMoveAge(this.lastMoveTimestamp(game));
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
    toggleDarkMode() {
      this.isDarkMode = toggleTheme() === "dark";
    },
    async signOut() {
      await (this.client as any).auth.signOut();
      window.location.reload();
    },
    openNicknameModal() {
      this.nicknameInput = this.myNickname;
      this.showNicknameModal = true;
    },
    closeNicknameModal() {
      this.showNicknameModal = false;
    },
    async saveNickname() {
      this.nicknameSaving = true;
      const error = await setMyNickname(this.client as any, this.nicknameInput);
      this.nicknameSaving = false;
      if (error) {
        this.message = error;
        return;
      }
      this.myNickname = this.nicknameInput.trim();
      this.showNicknameModal = false;
      await this.refresh();
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

.lobby-online {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #495057;
}

.lobby-online__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #28a745;
  box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.65);
  animation: lobby-online-pulse 1.8s infinite;
}

@keyframes lobby-online-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.55);
  }
  70% {
    box-shadow: 0 0 0 0.45rem rgba(40, 167, 69, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(40, 167, 69, 0);
  }
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

.game-bar--my-turn {
  animation: game-bar-my-turn-pulse 2s infinite;
}

// `inset`, not an outward ring: this bar's direct parent (.game-swipe, for the swipe-to-delete
// interaction) has `overflow: hidden`, which silently clipped an earlier outward box-shadow ring
// to nothing - the class/animation was applying correctly the whole time, it just had nowhere
// visible to render. An inset shadow stays within the bar's own box, so it can't be clipped.
@keyframes game-bar-my-turn-pulse {
  0% {
    box-shadow: inset 0 0 0 0 rgba(var(--highlighted-rgb, 32, 204, 68), 0.65);
  }
  50% {
    box-shadow: inset 0 0 0 3px rgba(var(--highlighted-rgb, 32, 204, 68), 0.65);
  }
  100% {
    box-shadow: inset 0 0 0 0 rgba(var(--highlighted-rgb, 32, 204, 68), 0.65);
  }
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

// Same slot/shape as .game-bar__round (open games have no round yet, so that slot was just
// empty) - shows claimed/total seats instead, in the same green used for "it's this seat's turn"
// elsewhere in this bar (.game-bar__score--active), so a glance at the left edge tells you
// "in progress, round N" vs "still filling up, X of Y joined" consistently.
.game-bar__seats {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  background: #28a745;
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

  &--abandoned {
    background: #f8d7da;
    color: #842029;
  }
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
    margin-left: 0.35rem;
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
  right: -0.2rem;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  background: #495057;
  border-radius: 0.6rem;
  padding: 0.15rem 0.25rem;
  min-width: 0.9rem;
  max-width: 1.5rem;
  text-align: center;
  white-space: nowrap;
  box-shadow: 0 0 0 1px #fff;
  z-index: 1;

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
