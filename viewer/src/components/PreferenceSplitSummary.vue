<template>
  <!-- Shown once the auction has resolved, in the same slot and style as SetupStatus's round-0
       strip (and as SilentAuctionSummary, which does the same job for the other variant): without
       it the result is only reachable from the statistics panel, so nobody would know it happened.
       Dismissible per game, per device. -->
  <div v-if="visible" class="auction-summary">
    <span class="auction-summary__text">
      <b>Preference Split Auction resolved</b>
      <span v-for="(row, i) in results" :key="row.faction">
        {{ i === 0 ? "—" : "·" }} {{ row.faction }} to {{ row.winner }} for {{ row.price }} VP
      </span>
    </span>
    <b-btn variant="link" size="sm" class="auction-summary__action" @click="logOpen = true">Full log</b-btn>
    <b-btn variant="link" size="sm" class="auction-summary__action" @click="dismiss">Dismiss</b-btn>
    <b-modal
      v-model="logOpen"
      title="Preference Split Auction"
      size="lg"
      ok-only
      ok-title="Close"
      dialog-class="gaia-viewer-modal"
    >
      <PreferenceSplitLog hide-title />
    </b-modal>
  </div>
</template>

<script lang="ts">
import Engine, { PlayerEnum, PreferenceSplitResult } from "@gaia-project/engine";
import { Component, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";
import PreferenceSplitLog from "./PreferenceSplitLog.vue";

const DISMISSED_KEY_PREFIX = "gaia-preference-split-summary-dismissed-v1:";

@Component({ components: { PreferenceSplitLog } })
export default class PreferenceSplitSummary extends Vue {
  logOpen = false;
  dismissed = false;

  created() {
    this.dismissed = this.readDismissed();
  }

  get gameData(): Engine {
    return this.$store.state.data;
  }

  get result(): PreferenceSplitResult | null {
    return this.gameData?.preferenceSplitResult ?? null;
  }

  /** Hosted games are keyed by their `?game=` id; self-contained/hot-seat play has no id, so the
   * map seed stands in - either way the dismissal belongs to this game, not to every game. */
  private get gameKey(): string {
    const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("game") : null;
    return fromUrl ?? this.gameData?.map?.seed ?? "local";
  }

  private readDismissed(): boolean {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(DISMISSED_KEY_PREFIX + this.gameKey) === "1";
  }

  get visible(): boolean {
    return !this.dismissed && this.results.length > 0;
  }

  get results(): { faction: string; winner: string; price: number }[] {
    return (this.result?.allocations ?? []).map((allocation) => ({
      faction: factionName(allocation.faction),
      winner: this.playerLabel(allocation.winner),
      price: allocation.payment,
    }));
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
// Deliberately identical to SilentAuctionSummary's strip - the two say the same kind of thing in
// the same place, and only one of them can ever be on screen for a given game.
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
