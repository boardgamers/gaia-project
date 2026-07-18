<template>
  <div class="container py-4 offline-lobby" style="max-width: 46rem">
    <div class="offline-lobby__header">
      <div>
        <h3 class="mb-1">Offline games</h3>
        <div class="text-muted small">Pass-and-play games stored only on this device</div>
      </div>
      <div class="offline-lobby__actions">
        <a class="btn btn-primary" href="?offline=1&create=1">+ New game</a>
        <a v-if="online" class="btn btn-outline-secondary" href="?lobby=1">Online lobby</a>
      </div>
    </div>

    <b-alert show variant="success" class="offline-lobby__status">
      <strong>{{ cacheReady ? "App available offline" : "Preparing app for offline use" }}</strong>
      <span v-if="online"> — wait for the ready message before flying, then add Fight Club to your home screen. </span>
      <span v-else> — airplane mode is active.</span>
    </b-alert>

    <b-alert :show="!!storageError" variant="warning" dismissible @dismissed="storageError = ''">
      {{ storageError }}
    </b-alert>

    <b-list-group v-if="games.length === 0" class="mb-3">
      <b-list-group-item>
        No offline games yet. Create one now; every move will be saved locally and appear here.
      </b-list-group-item>
    </b-list-group>

    <div v-else class="offline-lobby__games">
      <b-list-group-item v-for="game in games" :key="game.id" class="game-bar offline-lobby__game">
        <GameBar :game="game" :game-href="gameHref(game.id)" my-user-id="" />
        <b-button
          size="sm"
          variant="outline-danger"
          class="offline-lobby__delete"
          :aria-label="`Delete ${game.name}`"
          @click="deleteGame(game)"
        >
          Delete
        </b-button>
      </b-list-group-item>
    </div>

    <p class="text-muted small mt-3 mb-0">
      Games remain on this phone after closing or restarting the app. Clearing browser/site data or uninstalling the app
      can remove them, so export an important game's backup from inside that game.
    </p>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import {
  deleteStoredOfflineGame,
  listOfflineGames,
  offlineGameListRow,
  OfflineGameListRow,
  requestPersistentOfflineStorage,
} from "../offline-game";
import GameBar from "../hosted/GameBar.vue";

export default Vue.extend({
  name: "OfflineLobby",
  components: { GameBar },
  props: {
    storage: { type: Object, default: null },
  },
  data() {
    return {
      games: [] as OfflineGameListRow[],
      storageError: "",
      online: typeof navigator === "undefined" || navigator.onLine !== false,
      cacheReady: false,
    };
  },
  mounted() {
    this.refresh();
    requestPersistentOfflineStorage().catch(() => undefined);

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

<style lang="scss" scoped>
.offline-lobby__header {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.offline-lobby__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.offline-lobby__status {
  font-size: 0.9rem;
}

.offline-lobby__games {
  display: grid;
  gap: 0.65rem;
}

.offline-lobby__game {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  padding-right: 0.65rem;
}

.offline-lobby__delete {
  flex: 0 0 auto;
}

@media (max-width: 575px) {
  .offline-lobby__header {
    align-items: stretch;
    flex-direction: column;
  }

  .offline-lobby__actions {
    justify-content: stretch;
  }

  .offline-lobby__actions .btn {
    flex: 1 1 auto;
  }

  .offline-lobby__game {
    align-items: stretch;
    flex-direction: column;
  }

  .offline-lobby__delete {
    align-self: flex-end;
  }
}
</style>
