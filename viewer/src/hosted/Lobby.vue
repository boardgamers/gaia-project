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
          title="Notification settings"
          aria-label="Notification settings"
          @click="showNotifSettings = true"
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
          <b-dropdown-item href="?offline=1">Offline games</b-dropdown-item>
          <b-dropdown-divider></b-dropdown-divider>
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

    <InfoModal :open="showReleaseNotes" title="Changelog" @close="showReleaseNotes = false">
      <div class="release-notes__tabs" role="tablist">
        <button
          type="button"
          class="release-notes__tab"
          :class="{ 'release-notes__tab--active': changelogTab === 'user' }"
          @click="changelogTab = 'user'"
        >
          What's new
        </button>
        <button
          type="button"
          class="release-notes__tab"
          :class="{ 'release-notes__tab--active': changelogTab === 'dev' }"
          @click="changelogTab = 'dev'"
        >
          Developer
        </button>
      </div>

      <div v-if="changelogTab === 'user'">
        <div
          v-for="entry in userReleaseEntries"
          :key="`${entry.version}-${entry.releasedAt}`"
          class="release-notes__entry"
        >
          <div class="release-notes__heading">
            <strong>v{{ entry.version }}</strong>
            <span class="text-muted">&middot; {{ entry.releasedAt }}</span>
          </div>
          <div class="release-notes__title">{{ entry.title }}</div>
          <ul class="release-notes__list mb-0">
            <li v-for="change in entry.changes" :key="change">{{ change }}</li>
          </ul>
        </div>
      </div>
      <div v-else>
        <div
          v-for="entry in devReleaseEntries"
          :key="`${entry.version}-${entry.releasedAt}`"
          class="release-notes__entry"
        >
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

    <NotificationSettings
      :open="showNotifSettings"
      :client="client"
      :user-id="myUserId"
      :push-enabled="pushEnabled"
      @close="showNotifSettings = false"
      @push-changed="onPushChanged"
    />

    <b-alert :show="!!message" variant="info" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <div class="lobby-toolbar mb-3">
      <div class="lobby-tabs" role="tablist" aria-label="Game status tabs">
        <button
          type="button"
          class="lobby-tab"
          :class="{ 'lobby-tab--active': activeTab === 'mine' }"
          @click="setActiveTab('mine')"
        >
          My games <span class="lobby-tab__count">{{ myGames.length }}</span>
        </button>
        <button
          type="button"
          class="lobby-tab"
          :class="{ 'lobby-tab--active': activeTab === 'open' }"
          @click="setActiveTab('open')"
        >
          Lobby <span class="lobby-tab__count">{{ openGames.length }}</span>
        </button>
        <button
          type="button"
          class="lobby-tab"
          :class="{ 'lobby-tab--active': activeTab === 'active' }"
          @click="setActiveTab('active')"
        >
          Active <span class="lobby-tab__count">{{ activeGames.length }}</span>
        </button>
        <button
          type="button"
          class="lobby-tab"
          :class="{ 'lobby-tab--active': activeTab === 'finished' }"
          @click="setActiveTab('finished')"
        >
          Finished <span class="lobby-tab__count">{{ finishedGames.length }}</span>
        </button>
      </div>
      <div class="lobby-toolbar__actions">
        <a href="?create=1" class="btn btn-primary">+ New game</a>
        <span class="lobby-online-wrap d-md-none">
          <button
            type="button"
            class="lobby-online"
            :title="`${onlineCount} online - click to see who`"
            @click="showOnlinePlayers = !showOnlinePlayers"
          >
            <span class="lobby-online__dot"></span>
            {{ onlineCount }} online
          </button>
          <div v-if="showOnlinePlayers" class="lobby-online-popup">
            <strong class="lobby-online-popup__title">Online now</strong>
            <p v-if="onlinePlayerNames.length === 0" class="text-muted small mb-0">Nobody else is online right now.</p>
            <ul v-else class="lobby-online-popup__list">
              <li v-for="name in onlinePlayerNames" :key="name">{{ name }}</li>
            </ul>
          </div>
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
          <GameBar
            :game="game"
            :presence-state="presenceState"
            :my-user-id="myUserId"
            @click.native="handleGameClick(game.id, $event)"
            @delete-test-game="deleteMyTestGame"
          />
        </b-list-group-item>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { PresenceState, trackPresence } from "./presence";
import { backfillSubscriptionTimezone, isPushEnabled } from "./push";
import CreditsContent from "../components/CreditsContent.vue";
import { factionName } from "../data/factions";
import { isAdminEmail } from "./admin";
import GameBar from "./GameBar.vue";
import {
  auctionLabel as auctionLabelShared,
  claimedSeats as claimedSeatsShared,
  factionInitial as factionInitialShared,
  isMyGame as isMyGameShared,
  isMyTurn as isMyTurnShared,
  isTestGame as isTestGameShared,
  moveAge as moveAgeShared,
  playerBarTitle as playerBarTitleShared,
  playerPresence as playerPresenceShared,
  playerRows as playerRowsShared,
  playersWithSummary as playersWithSummaryShared,
  sortGames as sortGamesShared,
  summaryForGame as summaryForGameShared,
} from "./game-bar";
import InfoModal from "./InfoModal.vue";
import NotificationSettings from "./NotificationSettings.vue";
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

type ReleaseEntry = {
  version: string;
  releasedAt: string;
  kind: string;
  title: string;
  visible?: boolean;
  changes: string[];
  /** Short, plain-language bullets for the "What's new" tab - only real, visible/usable changes
   * (new features, new options, redesigns). Never bug fixes, crashes, or backend/technical work,
   * even if the change list above happens to mention one - scripts/update-viewer-release.js
   * enforces this split at authoring time. Empty/absent means this entry is developer-only and
   * never shown on the "What's new" tab. */
  userChanges?: string[];
};

export default Vue.extend({
  name: "HostedLobby",
  components: { GameBar, InfoModal, CreditsContent, NotificationSettings },
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
      changelogTab: "user" as "user" | "dev",
      showNicknameModal: false,
      showCredits: false,
      showNotifSettings: false,
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
      showOnlinePlayers: false,
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
    allReleaseEntries(): ReleaseEntry[] {
      return ((releaseData as any).entries ?? []).filter((entry: ReleaseEntry) => entry.visible !== false);
    },
    // "What's new" tab: only entries with real user-facing content, showing just those short
    // bullets - never the full (often technical) `changes` list.
    userReleaseEntries(): (ReleaseEntry & { changes: string[] })[] {
      return this.allReleaseEntries
        .filter((entry) => (entry.userChanges ?? []).length > 0)
        .map((entry) => ({ ...entry, changes: entry.userChanges }))
        .slice(0, 10);
    },
    // "Developer" tab: the unfiltered, full history.
    devReleaseEntries(): ReleaseEntry[] {
      return this.allReleaseEntries.slice(0, 20);
    },
    openGames(): any[] {
      return this.sortGames((this.games as any[]).filter((game) => game.status === "open"));
    },
    activeGames(): any[] {
      return this.sortGames((this.games as any[]).filter((game) => game.status === "active" && !this.isMyGame(game)));
    },
    myGames(): any[] {
      return this.sortGames((this.games as any[]).filter((game) => this.isMyGame(game) && game.status !== "finished"));
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
    // Names come from whatever's already loaded in `games[].players[].display_name` - no separate
    // "all users" directory RPC exists (or is needed), and every currently-online user has almost
    // certainly appeared in at least one game's player list by the time they're online at all.
    onlinePlayerNames(): string[] {
      const names = new Map<string, string>();
      for (const game of this.games as any[]) {
        for (const player of game.players ?? []) {
          if (player.user_id && player.display_name) {
            names.set(player.user_id, player.display_name);
          }
        }
      }
      return Object.keys(this.presenceState)
        .filter((userId) => (this.presenceState[userId] ?? []).length > 0)
        .map((userId) => (userId === this.myUserId ? "You" : names.get(userId) || "A player"))
        .sort((a, b) => a.localeCompare(b));
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
    // Backfill this device's timezone for the turn-reminder quiet-hours gate (no-op once set).
    backfillSubscriptionTimezone(this.client as any);
    // Default to the Lobby tab, but honour an explicit `?tab=` so backing out of a game (the
    // hosted bar's back arrow links to `?lobby=1&tab=mine`) - and an OS/browser swipe-back that
    // returns to the lobby's own history entry - land on the tab the player was last on rather
    // than always resetting to Lobby.
    const requestedTab = this.readTabFromUrl();
    this.activeTab = requestedTab ?? "open";
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
    readTabFromUrl(): "mine" | "open" | "active" | "finished" | null {
      if (typeof window === "undefined") {
        return null;
      }
      const tab = new URLSearchParams(window.location.search).get("tab");
      return tab === "mine" || tab === "open" || tab === "active" || tab === "finished" ? tab : null;
    },
    setActiveTab(tab: "mine" | "open" | "active" | "finished") {
      this.activeTab = tab;
      // Reflect the tab in the URL (without adding a history entry) so a subsequent OS/browser
      // swipe-back into this lobby entry restores the same tab instead of resetting to Lobby.
      if (typeof window !== "undefined" && window.history && typeof window.history.replaceState === "function") {
        const params = new URLSearchParams(window.location.search);
        params.set("tab", tab);
        window.history.replaceState(window.history.state, "", `?${params.toString()}`);
      }
    },
    onDocumentPointerDown(event: PointerEvent) {
      if (!(event.target as HTMLElement | null)?.closest?.(".game-swipe")) {
        this.revealedGameId = "";
      }
      if (!(event.target as HTMLElement | null)?.closest?.(".lobby-online-wrap")) {
        this.showOnlinePlayers = false;
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
        Promise.resolve((this.client as any).rpc("prune_idle_test_games")).catch(() => undefined);
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
    // Delegates to game-bar.ts's shared, no-`this` implementations (also used by GameBar.vue's own
    // rendering) so Lobby.vue's game list and GameNavPanel.vue's desktop menu can never drift apart
    // - see game-bar.ts's own doc comment.
    isMyGame(game: any): boolean {
      return isMyGameShared(game, this.myUserId, this.userEmail);
    },
    isMyTurn(game: any): boolean {
      return isMyTurnShared(game, this.myUserId, this.userEmail);
    },
    sortGames(games: any[]): any[] {
      return sortGamesShared(games, this.myUserId, this.userEmail);
    },
    playersWithSummary(game: any): any[] {
      return playersWithSummaryShared(game);
    },
    playerRows(game: any): any[][] {
      return playerRowsShared(game);
    },
    factionInitial: factionInitialShared,
    playerBarTitle(game: any, player: any): string {
      return playerBarTitleShared(player);
    },
    playerPresence(game: any, player: any): "green" | "yellow" | "grey" {
      return playerPresenceShared(game, player, this.presenceState as PresenceState);
    },
    isTestGame: isTestGameShared,
    auctionLabel: auctionLabelShared,
    summaryForGame: summaryForGameShared,
    moveAge: moveAgeShared,
    claimedSeats: claimedSeatsShared,
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
      // Mouse clicks must never enter the swipe-capture flow at all: setPointerCapture() on
      // .game-swipe (an ancestor of the game-bar__link <a>) retargets that pointer's subsequent
      // events - including the click event - to the capturing element instead of the <a>. That
      // silently breaks both the <a>'s native href navigation AND its own @click handler, since
      // the click's dispatch path no longer passes through the anchor at all. Desktop mouse users
      // only ever click, never swipe, so there's nothing to capture for "mouse" - only real
      // touch/pen swipes need this.
      if (
        !this.isAdmin ||
        event.pointerType === "mouse" ||
        (event.target as HTMLElement | null)?.closest(".game-swipe__delete")
      ) {
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
    async deleteMyTestGame(game: any) {
      if (!window.confirm(`Delete "${game.name || "this test game"}"? This cannot be undone.`)) {
        return;
      }
      const { error } = await (this.client as any).rpc("delete_my_test_game", { p_game_id: game.id });
      if (error) {
        this.message = `Could not delete the game: ${error.message}`;
      } else {
        await this.refresh();
      }
    },
    async onPushChanged() {
      // The settings modal owns the subscribe/unsubscribe + its own inline status; just refresh
      // the bell's on/off colour here.
      this.pushEnabled = await isPushEnabled();
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

.lobby-online-wrap {
  position: relative;
  // Pushes the indicator to the far right of `.lobby-toolbar__actions` on mobile (that row's
  // default flex packs its children to the start otherwise) - owner request.
  margin-left: auto;
}

.lobby-online {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #495057;
  border: 0;
  background: transparent;
  padding: 0.2rem 0.3rem;
}

.lobby-online-popup {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.35rem;
  min-width: 10rem;
  max-width: 14rem;
  background: var(--bs-body-bg, #fff);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 0.4rem;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  padding: 0.5rem 0.65rem;
  z-index: 1060;
}

.lobby-online-popup__title {
  display: block;
  font-size: 0.75rem;
  margin-bottom: 0.3rem;
}

.lobby-online-popup__list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
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

.release-notes__tabs {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
  border-bottom: 1px solid #e9ecef;
}

.release-notes__tab {
  border: none;
  background: none;
  padding: 0.3rem 0.1rem 0.55rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #6c757d;
  border-bottom: 2px solid transparent;
  margin-right: 0.9rem;
}

.release-notes__tab--active {
  color: #0b5ed7;
  border-bottom-color: #0b5ed7;
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

// `.game-bar`/`.game-bar__*` styling itself now lives in GameBar.vue (deliberately global, not
// scoped - see its own doc comment) since the markup moved into that shared component; a scoped
// block here would never reach elements a child component renders.
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
}
</style>
