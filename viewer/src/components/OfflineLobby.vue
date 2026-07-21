<template>
  <div class="container py-4 offline-lobby" style="max-width: 46rem">
    <div class="lobby-header">
      <h1 class="h3 mb-0">Offline games</h1>
      <div class="lobby-header__actions">
        <b-button
          size="sm"
          class="lobby-icon-button"
          variant="outline-secondary"
          v-b-tooltip.hover
          title="About offline games"
          aria-label="About offline games"
          @click="showInfo = true"
        >
          <span aria-hidden="true">&#9432;</span>
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
          <b-dropdown-item v-if="online" href="?lobby=1">Online lobby</b-dropdown-item>
          <b-dropdown-item-button @click="toggleDarkMode">{{
            isDarkMode ? "Light mode" : "Dark mode"
          }}</b-dropdown-item-button>
          <b-dropdown-item-button @click="showInfo = true">About offline games</b-dropdown-item-button>
        </b-dropdown>
      </div>
    </div>

    <div class="lobby-meta text-muted small mb-3">
      <span
        class="offline-lobby__status-dot"
        :class="cacheReady ? 'offline-lobby__status-dot--ready' : 'offline-lobby__status-dot--pending'"
        aria-hidden="true"
      ></span>
      <span class="font-weight-bold">{{ cacheReady ? "Available offline" : "Preparing app for offline use…" }}</span>
      <span class="lobby-meta__sep">&middot;</span>
      <span>{{ storageProtectionText }}</span>
      <span class="lobby-meta__sep">&middot;</span>
      <a href="" class="lobby-meta__toggle-link" @click.prevent="showInfo = true">About</a>
    </div>

    <InfoModal :open="showInfo" title="About offline games" @close="showInfo = false">
      <p>Pass-and-play games stored only on this device — no account or connection needed to play.</p>
      <p v-if="online">
        Wait for the <strong>“Available offline”</strong> status before flying, then add Fight Club to your home screen
        so it launches like an app.
      </p>
      <p v-else>Airplane mode is active — you're playing fully offline right now.</p>
      <p v-if="storagePersistenceChecked && storagePersisted">
        This browser has granted persistent storage, which protects local games from automatic space cleanup.
      </p>
      <p v-else-if="storagePersistenceChecked && storagePersisted === false">
        This browser did not grant persistent storage. Your games still save locally, but downloading backups is
        especially important.
      </p>
      <p v-else-if="storagePersistenceChecked">
        This browser does not report whether local game storage is protected from automatic cleanup.
      </p>
      <p class="mb-0">
        Games remain on this phone after closing or restarting the app. Clearing browser/site data or uninstalling the
        app can remove them. Use <strong>Download backup</strong> for important games; <strong>Import backup</strong>
        restores that file here or on another device.
      </p>
    </InfoModal>

    <b-alert :show="!!storageError" variant="warning" dismissible @dismissed="storageError = ''">
      {{ storageError }}
    </b-alert>
    <b-alert :show="!!backupMessage" variant="success" dismissible @dismissed="backupMessage = ''">
      {{ backupMessage }}
    </b-alert>

    <div class="lobby-toolbar mb-3">
      <div class="offline-lobby__count text-muted small">
        {{ games.length }} {{ games.length === 1 ? "game" : "games" }} on this device
      </div>
      <div class="lobby-toolbar__actions">
        <b-button variant="outline-primary" @click="chooseBackupFile">Import backup</b-button>
        <a class="btn btn-primary" href="?offline=1&create=1">+ New game</a>
        <input
          ref="backupFile"
          class="d-none"
          type="file"
          accept=".json,application/json"
          tabindex="-1"
          aria-hidden="true"
          @change="importBackupFile"
        />
      </div>
    </div>

    <b-list-group v-if="games.length === 0" class="mb-3">
      <b-list-group-item>
        No offline games yet. Create one now; every move will be saved locally and appear here.
      </b-list-group-item>
    </b-list-group>

    <div v-else class="lobby-games">
      <b-list-group-item v-for="game in games" :key="game.id" class="game-bar offline-lobby__game">
        <GameBar :game="game" :game-href="gameHref(game.id)" my-user-id="" />
        <div class="offline-lobby__game-actions">
          <b-button size="sm" variant="outline-secondary" @click="downloadBackup(game)"> Download backup </b-button>
          <a
            v-if="online"
            class="btn btn-sm btn-outline-primary"
            :href="`?importOffline=${encodeURIComponent(game.id)}`"
          >
            Move online
          </a>
          <b-button size="sm" variant="outline-danger" :aria-label="`Delete ${game.name}`" @click="deleteGame(game)">
            Delete
          </b-button>
        </div>
      </b-list-group-item>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import {
  deleteStoredOfflineGame,
  importOfflineGameBackup,
  listOfflineGames,
  offlineGameListRow,
  OfflineGameListRow,
  readStoredOfflineGame,
  requestPersistentOfflineStorage,
  serializeOfflineGameBackup,
} from "../offline-game";
import GameBar from "../hosted/GameBar.vue";
import InfoModal from "../hosted/InfoModal.vue";
import { getTheme, toggleTheme } from "../hosted/theme";

function backupFileName(name: string): string {
  const safeName = name
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${safeName || "offline-game"}-backup.json`;
}

function readBackupFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("The backup file could not be read."));
    reader.readAsText(file);
  });
}

export default Vue.extend({
  name: "OfflineLobby",
  components: { GameBar, InfoModal },
  props: {
    storage: { type: Object, default: null },
  },
  data() {
    return {
      games: [] as OfflineGameListRow[],
      storageError: "",
      backupMessage: "",
      online: typeof navigator === "undefined" || navigator.onLine !== false,
      cacheReady: false,
      storagePersistenceChecked: false,
      storagePersisted: null as boolean | null,
      showInfo: false,
      isDarkMode: getTheme() === "dark",
    };
  },
  computed: {
    storageProtectionText(): string {
      if (!this.storagePersistenceChecked) {
        return "Checking storage protection…";
      }
      if (this.storagePersisted) {
        return "Storage protected";
      }
      return this.storagePersisted === false ? "Backup recommended" : "Storage protection unavailable";
    },
  },
  mounted() {
    this.refresh();
    requestPersistentOfflineStorage()
      .then((persisted) => {
        this.storagePersisted = persisted;
        this.storagePersistenceChecked = true;
      })
      .catch(() => {
        this.storagePersistenceChecked = true;
      });

    const updateConnectivity = () => {
      this.online = navigator.onLine !== false;
    };
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    this.$on("hook:beforeDestroy", () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => (this.cacheReady = true)).catch(() => undefined);
    }
  },
  methods: {
    refresh() {
      const result = this.storage ? listOfflineGames(this.storage as Storage) : listOfflineGames();
      this.games = result.games.map(offlineGameListRow);
      this.storageError = result.error ?? "";
    },
    gameHref(gameId: string): string {
      return `?offline=1&game=${encodeURIComponent(gameId)}`;
    },
    toggleDarkMode() {
      this.isDarkMode = toggleTheme() === "dark";
    },
    chooseBackupFile() {
      (this.$refs.backupFile as HTMLInputElement)?.click();
    },
    importBackupContents(raw: string, fallbackName: string) {
      const result = this.storage
        ? importOfflineGameBackup(raw, fallbackName, this.storage as Storage)
        : importOfflineGameBackup(raw, fallbackName);
      if (!result.save) {
        this.storageError = result.error ?? "The backup could not be imported.";
        return;
      }
      this.refresh();
      if (result.error) {
        this.storageError = result.error;
      }
      this.backupMessage = `Imported “${result.save.name}”.`;
    },
    async importBackupFile(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      try {
        const raw = await readBackupFile(file);
        this.importBackupContents(raw, file.name.replace(/\.json$/i, "") || "Imported backup");
      } catch (error) {
        this.storageError = `The backup file could not be read: ${error instanceof Error ? error.message : error}`;
      } finally {
        input.value = "";
      }
    },
    downloadBackup(game: OfflineGameListRow) {
      const result = this.storage
        ? readStoredOfflineGame(game.id, this.storage as Storage)
        : readStoredOfflineGame(game.id);
      if (!result.save) {
        this.storageError = result.error ?? "The backup could not be created.";
        return;
      }

      const blob = new Blob([serializeOfflineGameBackup(result.save)], { type: "application/json" });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = backupFileName(result.save.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
      this.backupMessage = `Downloaded a backup of “${result.save.name}”.`;
    },
    deleteGame(game: OfflineGameListRow) {
      if (!window.confirm(`Delete "${game.name}" from this device? This cannot be undone.`)) {
        return;
      }
      const result = this.storage
        ? deleteStoredOfflineGame(game.id, this.storage as Storage)
        : deleteStoredOfflineGame(game.id);
      if (result.error) {
        this.storageError = result.error;
        return;
      }
      this.refresh();
    },
  },
});
</script>

<!-- The `.lobby-*` chrome classes below mirror Lobby.vue (online) one-to-one so the offline lobby
     reads as the same screen (owner request: "mimic the online lobby 100%"). The game rows
     themselves reuse the shared GameBar.vue component and its global `.game-bar*` styles, so a row
     looks identical online and offline; only the offline-specific extras (`.offline-lobby__*`) live
     here. Keep these values in sync with Lobby.vue if that lobby's chrome ever changes. -->
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
  align-items: center;
  gap: 0.45rem;
}

.lobby-icon-button {
  min-width: 2.2rem;
  padding-left: 0.45rem;
  padding-right: 0.45rem;
}

.lobby-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.lobby-meta__sep {
  color: var(--ui-text-subtle);
}

.lobby-meta__toggle-link {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0 0.2rem;
  color: var(--ui-link);
  text-decoration: none;
}

.lobby-meta__toggle-link:hover {
  color: var(--ui-link-hover);
  text-decoration: underline;
}

.lobby-games {
  display: grid;
  gap: 0.55rem;
}

.offline-lobby__status-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  flex-shrink: 0;

  &--ready {
    background: #28a745;
  }

  &--pending {
    background: #f1c40f;
  }
}

.offline-lobby__game {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.25rem;
}

.offline-lobby__game-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 0 0 auto;
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
}

@media (max-width: 575px) {
  .offline-lobby__game {
    align-items: stretch;
    flex-direction: column;
  }

  .offline-lobby__game-actions {
    justify-content: flex-end;
  }
}
</style>
