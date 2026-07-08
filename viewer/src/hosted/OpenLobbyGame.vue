<template>
  <div class="container py-4" style="max-width: 72rem">
    <div class="open-lobby-page__header">
      <div>
        <div class="text-muted small text-uppercase">Lobby game</div>
        <h3 class="mb-1">{{ gameName }}</h3>
        <div v-if="game" class="text-muted small">{{ auctionLabel(game) }} · {{ claimedSeats(game) }}/{{ game.player_count }} joined</div>
      </div>
      <a href="?lobby=1" class="btn btn-outline-secondary btn-sm">Back to lobby</a>
    </div>

    <b-alert :show="!!message" variant="info" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <div v-if="loading" class="text-muted py-4">Loading game…</div>
    <div v-else-if="!game" class="alert alert-warning mb-0">This lobby game is no longer available.</div>
    <template v-else>
      <div class="open-lobby-page__top">
        <div class="open-lobby-page__section open-lobby-page__section--main">
          <div class="open-lobby-page__label">Players</div>
          <div class="open-lobby-page__joined-line">
            <b-button v-if="canLeaveAnySeat(game)" size="sm" variant="outline-secondary" @click="leaveMySeat(game)">
              Leave seat
            </b-button>
            <b-button v-else-if="canJoinGame(game)" size="sm" variant="primary" @click="joinFirstOpenSeat(game)">
              Join game
            </b-button>
          </div>
          <div class="open-lobby-page__names">
            <span v-for="name in joinedNames(game)" :key="name" class="open-lobby-page__name-chip">{{ name }}</span>
            <span v-if="joinedNames(game).length === 0" class="text-muted small">Nobody has joined yet.</span>
          </div>
        </div>
      </div>

      <div class="open-lobby-page__preview">
        <OpenGamePreview :game="game" />
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import OpenGamePreview from "./OpenGamePreview.vue";

export default Vue.extend({
  name: "HostedOpenLobbyGame",
  components: { OpenGamePreview },
  props: {
    client: { type: Object, required: true },
    session: { type: Object, required: true },
    gameId: { type: String, required: true },
  },
  data() {
    return {
      game: null as any,
      loading: true,
      message: "",
      gameChannel: null as any,
    };
  },
  created() {
    this.refresh();
    this.subscribeGame();
  },
  beforeDestroy() {
    if (this.gameChannel) {
      (this.client as any).removeChannel(this.gameChannel);
      this.gameChannel = null;
    }
  },
  computed: {
    gameName(): string {
      return this.game?.name || "Unnamed game";
    },
  },
  methods: {
    async refresh() {
      const showLoading = !this.game;
      if (showLoading) {
        this.loading = true;
      }
      const { data, error } = await (this.client as any).from("games").select("*, players(*)").eq("id", this.gameId).maybeSingle();
      if (error) {
        this.message = `Could not load the game: ${error.message}`;
      } else {
        this.game = data?.status === "open" ? data : null;
        if (data?.status === "active") {
          window.location.search = `?game=${this.gameId}`;
          return;
        }
      }
      this.loading = false;
    },
    subscribeGame() {
      this.gameChannel = (this.client as any)
        .channel(`open-game-${this.gameId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${this.gameId}` }, () => this.refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${this.gameId}` }, () => this.refresh())
        .subscribe();
    },
    auctionLabel(game: any): string {
      return game.options?.auction === "silent" ? "Silent Auction" : "Standard";
    },
    claimedSeats(game: any): number {
      return (game.players ?? []).filter((player: any) => !!player.user_id).length;
    },
    joinedNames(game: any): string[] {
      return (game.players ?? [])
        .filter((player: any) => !!player.user_id)
        .sort((a: any, b: any) => a.seat - b.seat)
        .map((player: any) => player.display_name || player.invited_email);
    },
    firstOpenSeat(game: any): number | null {
      const open = (game.players ?? []).find((player: any) => !player.user_id);
      return open ? open.seat : null;
    },
    mySeat(game: any): number | null {
      const mine = (game.players ?? []).find((seat: any) => seat.user_id === (this.session as any).user?.id);
      return mine ? mine.seat : null;
    },
    canJoinGame(game: any): boolean {
      return game.status === "open" && this.firstOpenSeat(game) !== null && this.mySeat(game) === null;
    },
    canLeaveAnySeat(game: any): boolean {
      return game.status === "open" && this.mySeat(game) !== null;
    },
    updateSeatLocally(seat: number, joined: boolean) {
      if (!this.game) {
        return;
      }
      const me = (this.session as any).user;
      this.game = {
        ...this.game,
        players: (this.game.players ?? []).map((player: any) => {
          if (player.seat !== seat) {
            return player;
          }
          return joined
            ? {
                ...player,
                user_id: me?.id ?? null,
                invited_email: me?.email ?? player.invited_email,
                display_name: me?.email ?? player.display_name,
              }
            : {
                ...player,
                user_id: null,
                display_name: "",
              };
        }),
      };
    },
    async joinFirstOpenSeat(game: any) {
      const seat = this.firstOpenSeat(game);
      if (seat === null) {
        return;
      }
      const { data, error } = await (this.client as any).rpc("join_open_game_seat", { p_game_id: game.id, p_seat: seat });
      if (error) {
        this.message = `Could not join the game: ${error.message}`;
        return;
      }
      if (data?.status === "active") {
        window.location.search = `?game=${game.id}`;
        return;
      }
      this.updateSeatLocally(seat, true);
    },
    async leaveMySeat(game: any) {
      const seat = this.mySeat(game);
      if (seat === null) {
        return;
      }
      const { error } = await (this.client as any).rpc("leave_open_game_seat", { p_game_id: game.id, p_seat: seat });
      if (error) {
        this.message = `Could not leave the seat: ${error.message}`;
        return;
      }
      this.updateSeatLocally(seat, false);
    },
  },
});
</script>

<style lang="scss" scoped>
.open-lobby-page__header,
.open-lobby-page__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.open-lobby-page__top {
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.open-lobby-page__section {
  min-width: 16rem;
}

.open-lobby-page__section--main {
  flex: 1 1 36rem;
}

.open-lobby-page__label {
  margin-bottom: 0.45rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #5b657a;
}

.open-lobby-page__joined-line,
.open-lobby-page__names {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.open-lobby-page__joined-line {
  align-items: center;
  margin-bottom: 0.55rem;
}

.open-lobby-page__pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: #eef3f8;
  color: #55657a;
  font-size: 0.74rem;
  font-weight: 700;
}

.open-lobby-page__name-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  background: #f5f7fb;
  color: #364152;
  font-size: 0.82rem;
}

.open-lobby-page__preview {
  border: 1px solid rgba(28, 43, 74, 0.08);
  border-radius: 12px;
  padding: 0.65rem;
  background: linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%);
}

@media (max-width: 767px) {
  .open-lobby-page__header,
  .open-lobby-page__top {
    align-items: flex-start;
  }
}
</style>
