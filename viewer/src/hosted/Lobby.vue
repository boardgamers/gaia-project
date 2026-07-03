<template>
  <div class="container py-4" style="max-width: 46rem">
    <div class="d-flex justify-content-between align-items-center">
      <h3 class="mb-0">The Lost Fleet — Games</h3>
      <div>
        <b-button size="sm" variant="outline-secondary" @click="enablePush" :disabled="pushBusy"
          >Enable notifications</b-button
        >
        <b-button size="sm" variant="outline-secondary" @click="signOut">Sign out</b-button>
      </div>
    </div>
    <div class="text-muted small mb-3">{{ userEmail }}</div>
    <b-alert :show="!!message" variant="info" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <b-list-group class="mb-3">
      <b-list-group-item v-if="loading">Loading games…</b-list-group-item>
      <b-list-group-item v-else-if="games.length === 0">No games yet — create one below.</b-list-group-item>
      <b-list-group-item v-for="game in games" :key="game.id" class="d-flex justify-content-between align-items-center">
        <a
          :href="`?game=${game.id}`"
          class="text-body text-decoration-none flex-grow-1 d-flex justify-content-between align-items-center"
          style="gap: 0.5rem"
        >
          <span>
            <strong>{{ game.name || "Unnamed game" }}</strong>
            <span class="text-muted small">
              · {{ game.player_count }}p · {{ game.options && game.options.lostFleet ? "Lost Fleet" : "base game"
              }}<template v-if="isTestGame(game)"> · test game</template>
            </span>
          </span>
          <b-badge :variant="badgeVariant(game)">{{ turnLabel(game) }}</b-badge>
        </a>
        <b-button
          v-if="game.created_by === myUserId"
          size="sm"
          variant="outline-danger"
          class="ml-2"
          @click="deleteGame(game)"
          >Delete</b-button
        >
      </b-list-group-item>
    </b-list-group>

    <a href="?create=1" class="btn btn-primary">+ New game</a>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { enablePushNotifications } from "./push";

export default Vue.extend({
  name: "HostedLobby",
  props: {
    client: { type: Object, required: true },
    session: { type: Object, required: true },
  },
  data() {
    return {
      games: [] as any[],
      loading: true,
      pushBusy: false,
      message: "",
    };
  },
  computed: {
    userEmail(): string {
      return (this.session as any).user?.email ?? "";
    },
    myUserId(): string {
      return (this.session as any).user?.id ?? "";
    },
  },
  created() {
    this.refresh();
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
    playerAtSeat(game: any, seat: number | null): any {
      return (game.players ?? []).find((p: any) => p.seat === seat);
    },
    isTestGame(game: any): boolean {
      const players = game.players ?? [];
      return players.length > 0 && players.every((p: any) => p.user_id === this.myUserId);
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
      this.pushBusy = false;
    },
    async signOut() {
      await (this.client as any).auth.signOut();
      window.location.reload();
    },
  },
});
</script>
