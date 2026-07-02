<template>
  <div class="container py-4" style="max-width: 46rem">
    <div class="d-flex justify-content-between align-items-center">
      <h3 class="mb-0">The Lost Fleet — Games</h3>
      <div>
        <b-button size="sm" variant="outline-secondary" @click="enablePush" :disabled="pushBusy">Enable notifications</b-button>
        <b-button size="sm" variant="outline-secondary" @click="signOut">Sign out</b-button>
      </div>
    </div>
    <div class="text-muted small mb-3">{{ userEmail }}</div>
    <b-alert :show="!!message" variant="info" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <b-list-group class="mb-4">
      <b-list-group-item v-if="loading">Loading games…</b-list-group-item>
      <b-list-group-item v-else-if="games.length === 0">No games yet — create one below.</b-list-group-item>
      <b-list-group-item
        v-for="game in games"
        :key="game.id"
        :href="`?game=${game.id}`"
        class="d-flex justify-content-between align-items-center"
      >
        <span>
          <strong>{{ game.name || "Unnamed game" }}</strong>
          <span class="text-muted small"> · {{ game.player_count }}p · {{ (game.options && game.options.lostFleet) ? "Lost Fleet" : "base game" }}</span>
        </span>
        <b-badge :variant="badgeVariant(game)">{{ turnLabel(game) }}</b-badge>
      </b-list-group-item>
    </b-list-group>

    <h5>New game</h5>
    <b-form @submit.prevent="createGame">
      <b-form-group label="Name">
        <b-form-input v-model="form.name" placeholder="Friday fleet night" />
      </b-form-group>
      <b-form-group label="Players">
        <b-form-select v-model.number="form.playerCount" :options="[2, 3, 4, 5]" @change="resizeSeats" />
      </b-form-group>
      <b-form-checkbox v-model="form.lostFleet" class="mb-2">Lost Fleet expansion</b-form-checkbox>
      <b-form-group
        v-for="(seatForm, i) in form.seats"
        :key="i"
        :label="`Seat ${i + 1}`"
      >
        <div class="d-flex" style="gap: 0.5rem">
          <b-form-input v-model="seatForm.email" type="email" required placeholder="friend@example.com" />
          <b-form-input v-model="seatForm.name" placeholder="Display name" />
        </div>
      </b-form-group>
      <b-button variant="outline-secondary" size="sm" class="mb-3" @click="shuffleSeats">Shuffle seat order</b-button>
      <div>
        <b-button type="submit" variant="primary" :disabled="creating">Create game</b-button>
      </div>
    </b-form>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { buildCreateGameParams } from "./new-game";
import { enablePushNotifications } from "./push";

type SeatForm = { email: string; name: string };

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
      creating: false,
      pushBusy: false,
      message: "",
      form: {
        name: "",
        playerCount: 2,
        lostFleet: true,
        seats: [] as SeatForm[],
      },
    };
  },
  computed: {
    userEmail(): string {
      return (this.session as any).user?.email ?? "";
    },
  },
  created() {
    this.resizeSeats();
    this.refresh();
  },
  methods: {
    resizeSeats() {
      const seats: SeatForm[] = this.form.seats.slice(0, this.form.playerCount);
      while (seats.length < this.form.playerCount) {
        seats.push({ email: seats.length === 0 ? this.userEmail : "", name: "" });
      }
      this.form.seats = seats;
    },
    shuffleSeats() {
      const seats = [...this.form.seats];
      for (let i = seats.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seats[i], seats[j]] = [seats[j], seats[i]];
      }
      this.form.seats = seats;
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
        this.games = data ?? [];
      }
      this.loading = false;
    },
    playerAtSeat(game: any, seat: number | null): any {
      return (game.players ?? []).find((p: any) => p.seat === seat);
    },
    turnLabel(game: any): string {
      if (game.status === "finished") {
        return "finished";
      }
      const player = this.playerAtSeat(game, game.current_seat);
      if (!player) {
        return "active";
      }
      const mine = player.user_id === (this.session as any).user?.id;
      return mine ? "your turn" : `${player.display_name || player.invited_email} to move`;
    },
    badgeVariant(game: any): string {
      if (game.status === "finished") {
        return "secondary";
      }
      const player = this.playerAtSeat(game, game.current_seat);
      return player && player.user_id === (this.session as any).user?.id ? "success" : "info";
    },
    async createGame() {
      this.creating = true;
      this.message = "";
      try {
        const params = buildCreateGameParams({
          name: this.form.name,
          playerCount: this.form.playerCount,
          lostFleet: this.form.lostFleet,
          seats: this.form.seats,
        });
        const { data, error } = await (this.client as any).rpc("create_game", params);
        if (error) {
          throw new Error(error.message);
        }
        window.location.search = `?game=${data}`;
      } catch (err) {
        this.message = `Could not create the game: ${err instanceof Error ? err.message : err}`;
        this.creating = false;
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
