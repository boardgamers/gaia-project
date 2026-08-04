<template>
  <!-- Shown once the auction has resolved, in the same spot and style as SetupStatus's round-0 strip
       (Game.vue, right under the top banner). The full log has always been available in the
       statistics panel's "Silent Auction" tab, but nothing ever told anyone the auction had happened
       or what it did - so the result went unseen. Dismissible per game, per device. -->
  <div v-if="visible" class="auction-summary">
    <span class="auction-summary__text">
      <b>Silent Auction resolved</b>
      <span v-for="(row, i) in results" :key="row.faction">
        {{ i === 0 ? "—" : "·" }} {{ row.faction }} to {{ row.winner }} for {{ row.price }} VP
      </span>
    </span>
    <b-btn variant="link" size="sm" class="auction-summary__action" @click="logOpen = true">Full log</b-btn>
    <b-btn variant="link" size="sm" class="auction-summary__action" @click="dismiss">Dismiss</b-btn>
    <b-modal v-model="logOpen" title="Silent Auction" size="lg" ok-only ok-title="Close">
      <SilentAuctionLog hide-title />
    </b-modal>
  </div>
</template>

<script lang="ts">
import Engine, { Faction, PlayerEnum } from "@gaia-project/engine";
import { Component, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";
import SilentAuctionLog from "./SilentAuctionLog.vue";

const DISMISSED_KEY_PREFIX = "gaia-silent-auction-summary-dismissed-v1:";

@Component({ components: { SilentAuctionLog } })
export default class SilentAuctionSummary extends Vue {
  logOpen = false;
  dismissed = false;

  created() {
    this.dismissed = this.readDismissed();
  }

  get gameData(): Engine {
    return this.$store.state.data;
  }

  /** Hosted games are keyed by their `?game=` id; self-contained/hot-seat play has no id, so the
   * map seed stands in - either way the dismissal belongs to this game, not to every game. */
  private get gameKey(): string {
    const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("game") : null;
    return fromUrl ?? this.gameData?.map?.seed ?? "local";
  }

  private readDismissed(): boolean {
    // `window.localStorage`, not the bare global: under the test runner those are not always the
    // same Storage instance, and every other stored preference in the viewer reads it this way.
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(DISMISSED_KEY_PREFIX + this.gameKey) === "1";
  }

  get visible(): boolean {
    return !this.dismissed && (this.gameData?.silentAuctionLog?.length ?? 0) > 0 && this.results.length > 0;
  }

  /** Same shape SilentAuctionLog's result table uses: `setup` order is pick order, which is also
   * turn order, and each faction's current owner is who the auction gave it to. */
  get results(): { faction: string; winner: string; price: number }[] {
    const data = this.gameData;
    return (data?.setup ?? [])
      .map((faction: Faction) => {
        const winner = data.players.find((pl) => pl.faction === faction);
        return winner
          ? {
              faction: factionName(faction),
              winner: this.playerLabel(winner.player as PlayerEnum),
              price: winner.data.bid ?? 0,
            }
          : null;
      })
      .filter((row) => row !== null);
  }

  private playerLabel(player: PlayerEnum): string {
    const pl = this.gameData.players[player];
    return pl?.name || `Player ${(player as number) + 1}`;
  }

  dismiss() {
    this.dismissed = true;
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(DISMISSED_KEY_PREFIX + this.gameKey, "1");
    }
  }
}
</script>

<style lang="scss" scoped>
// Deliberately the same shape as SetupStatus's strip - it sits in the same slot and is read the
// same way - with its own tint so it doesn't read as a repeat of the turn line.
.auction-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
  padding: 0.25rem 0.75rem;
  margin-bottom: 0.5rem;
  border: 1px solid rgba(23, 162, 184, 0.45);
  border-radius: 0.25rem;
  background: rgba(23, 162, 184, 0.1);
  font-size: 0.95rem;
}

.auction-summary__text {
  min-width: 0;
}

.auction-summary__action {
  padding-top: 0;
  padding-bottom: 0;
  white-space: nowrap;
  text-decoration: none;

  &:first-of-type {
    margin-left: auto;
  }
}
</style>
