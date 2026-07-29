<template>
  <div class="container py-3 py-md-4" style="max-width: 32rem">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h3 mb-0">Move to online lobby</h1>
      <a href="?offline=1" class="btn btn-outline-secondary btn-sm">Back to offline games</a>
    </div>

    <b-alert :show="!!message" variant="info" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <div v-if="!row" class="text-muted">
      This offline game could not be loaded on this device{{ loadError ? `: ${loadError}` : "." }}
    </div>

    <div v-else-if="isMirror" class="text-muted">
      “{{ storedGame.name }}” is an automatic copy of a game that is already in the online lobby, so there is nothing to
      move. Open it there instead — or turn off <strong>Convert to offline game</strong> in that game's settings menu if
      you no longer want the copy.
    </div>

    <div v-else>
      <p class="text-muted small">
        "{{ storedGame.name }}" ({{ row.player_count }} players, {{ row.move_count }} moves so far) will be copied to
        the Supabase-hosted online lobby with its full history intact. Assign each seat to a registered player before
        continuing - the local copy on this device is deleted only after the move succeeds.
      </p>

      <div v-for="seat in seatIndexes" :key="seat" class="import-offline-seat mb-2">
        <label :for="`import-offline-seat-${seat}`" class="mb-1">
          Seat {{ seat + 1
          }}<span v-if="row.players[seat] && row.players[seat].faction"> ({{ row.players[seat].faction }})</span>
        </label>
        <b-form-select :id="`import-offline-seat-${seat}`" v-model="seatAssignments[seat]" :options="seatOptions" />
      </div>

      <b-button variant="primary" block :disabled="!canImport || importing" @click="importGame">
        {{ importing ? "Moving…" : "Move to online lobby" }}
      </b-button>
      <p v-if="!canImport" class="text-muted small mt-2 mb-0">
        At least one seat must be assigned to you, and every seat needs a player.
      </p>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import {
  deleteStoredOfflineGame,
  offlineGameListRow,
  OfflineGameListRow,
  readStoredOfflineGame,
  StoredOfflineGame,
} from "../offline-game";
import { buildImportGameParams } from "./import-offline-game";
import { fetchMyNickname } from "./profile";

export default Vue.extend({
  name: "ImportOfflineGame",
  props: {
    client: { type: Object, default: null },
    session: { type: Object, default: null },
    offlineGameId: { type: String, default: "" },
    storage: { type: Object, default: null },
  },
  data() {
    return {
      storedGame: null as StoredOfflineGame | null,
      row: null as OfflineGameListRow | null,
      loadError: "",
      message: "",
      importing: false,
      myNickname: "" as string,
      invitablePlayers: [] as { user_id: string; nickname: string }[],
      seatAssignments: [] as string[],
    };
  },
  created() {
    const stored = this.storage
      ? readStoredOfflineGame(this.offlineGameId, this.storage as Storage)
      : readStoredOfflineGame(this.offlineGameId);
    if (stored.save) {
      this.storedGame = stored.save;
      this.row = offlineGameListRow(stored.save);
      this.seatAssignments = new Array(this.row.player_count).fill(this.myUserId);
    } else {
      this.loadError = stored.error ?? "";
    }

    fetchMyNickname(this.client as any, this.myUserId).then((nickname) => {
      this.myNickname = nickname;
    });
    (this.client as any).rpc("list_invitable_players").then(({ data, error }: any) => {
      if (!error) {
        this.invitablePlayers = (data ?? []).filter((p: any) => p.user_id !== this.myUserId);
      }
    });
  },
  computed: {
    myUserId(): string {
      return (this.session as any).user?.id ?? "";
    },
    /** A record kept in sync FROM an online game (hosted/offline-mirror.ts) - importing it would
     * create a second, forked copy of a game that is already hosted. */
    isMirror(): boolean {
      return !!this.storedGame?.mirrorOf;
    },
    seatIndexes(): number[] {
      return this.row ? Array.from({ length: this.row.player_count }, (_, i) => i) : [];
    },
    seatOptions(): { value: string; text: string }[] {
      return [
        { value: this.myUserId, text: this.myNickname || "Me" },
        ...this.invitablePlayers.map((p) => ({ value: p.user_id, text: p.nickname })),
      ];
    },
    canImport(): boolean {
      return (
        !this.isMirror &&
        this.seatAssignments.length > 0 &&
        this.seatAssignments.every((id) => !!id) &&
        this.seatAssignments.includes(this.myUserId)
      );
    },
  },
  methods: {
    displayNameFor(userId: string): string {
      if (userId === this.myUserId) {
        return this.myNickname || "Me";
      }
      return this.invitablePlayers.find((p) => p.user_id === userId)?.nickname ?? "";
    },
    async importGame() {
      if (!this.canImport || !this.storedGame) {
        return;
      }
      this.importing = true;
      this.message = "";
      try {
        const seats = this.seatAssignments.map((userId, seat) => ({
          seat,
          userId,
          displayName: this.displayNameFor(userId),
        }));
        const params = buildImportGameParams(this.storedGame, seats);
        const { data, error } = await (this.client as any).rpc("import_offline_game", params);
        if (error) {
          throw new Error(error.message);
        }
        const deleted = this.storage
          ? deleteStoredOfflineGame(this.offlineGameId, this.storage as Storage)
          : deleteStoredOfflineGame(this.offlineGameId);
        if (deleted.error) {
          console.warn(deleted.error);
        }
        window.location.search = `?game=${data}`;
      } catch (err) {
        this.message = `Could not move this game online: ${err instanceof Error ? err.message : err}`;
        this.importing = false;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.import-offline-seat label {
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
