<template>
  <div class="container py-4" style="max-width: 46rem">
    <div class="d-flex justify-content-between align-items-center">
      <h3 class="mb-0">The Lost Fleet — Games</h3>
      <div>
        <b-button
          v-if="pushEnabled"
          size="sm"
          variant="success"
          :disabled="pushBusy"
          v-b-tooltip.hover
          title="This device is registered for turn notifications. Enable it separately on any other device you play from. Click to turn off."
          @click="disablePush"
        >
          🔔 Notifications on
        </b-button>
        <b-button v-else size="sm" variant="outline-secondary" @click="enablePush" :disabled="pushBusy"
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
      <b-list-group-item v-for="game in games" :key="game.id" class="game-bar d-flex align-items-center">
        <a :href="`?game=${game.id}`" class="text-body text-decoration-none flex-grow-1 game-bar__link">
          <span class="game-bar__round" v-if="game.current_round">R{{ game.current_round }}</span>
          <span class="game-bar__title">
            <strong>{{ game.name || "Unnamed game" }}</strong>
            <span class="text-muted small">
              · {{ game.player_count }}p · {{ game.options && game.options.lostFleet ? "Lost Fleet" : "base game"
              }}<template v-if="isTestGame(game)"> · test game</template>
            </span>
          </span>
          <!-- Per-seat faction + score, boardgamers.space-style - only once at least one seat has
               actually cached one (skip entirely for a brand new game, or one committed before
               0009_lobby_round_faction_score_cache.sql seeded these columns). The current-turn
               seat gets a highlighted ring instead of repeating the turnLabel text per player. -->
          <span class="game-bar__players gaia-viewer-game" v-if="playersWithSummary(game).length > 0">
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
                <span class="game-bar__score">{{ player.score != null ? player.score : "–" }}</span>
              </span>
            </span>
          </span>
          <b-badge :variant="badgeVariant(game)" class="ml-auto">{{ turnLabel(game) }}</b-badge>
        </a>
        <b-button
          v-if="isAdmin"
          size="sm"
          variant="outline-danger"
          class="ml-2"
          @click="deleteGame(game)"
          >Delete</b-button
        >
      </b-list-group-item>
    </b-list-group>

    <a v-if="isAdmin" href="?create=1" class="btn btn-primary">+ New game</a>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { disablePushNotifications, enablePushNotifications, isPushEnabled } from "./push";
import Token from "../components/Token.vue";
import { factionName } from "../data/factions";

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
    };
  },
  computed: {
    userEmail(): string {
      return (this.session as any).user?.email ?? "";
    },
    myUserId(): string {
      return (this.session as any).user?.id ?? "";
    },
    // Matches delete_game's own admin check (supabase/migrations/0006_delete_game.sql) - kept in
    // sync manually since there's no roles table; the RPC is the actual enforcement point, this
    // just avoids showing a Delete button that would only fail server-side for everyone else.
    isAdmin(): boolean {
      return this.userEmail.toLowerCase() === "kim.pham.nguyen2@gmail.com";
    },
  },
  created() {
    this.refresh();
    isPushEnabled().then((enabled) => {
      this.pushEnabled = enabled;
    });
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
    // Only seats with a cached faction (seeded once that player picks one and their first
    // post-migration move commits, see host.ts's `playerUpdates`) - a brand new game, or one that
    // hasn't seen a move since 0009_lobby_round_faction_score_cache.sql, shows nothing here rather
    // than empty placeholder chips.
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
      return `${name} — ${factionName(player.faction)} — ${vp}`;
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
.game-bar__link {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  min-width: 0;
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
</style>
