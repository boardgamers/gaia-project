<template>
  <!-- Round 0 status strip, shown to everyone (see Game.vue). The action panel below only renders
       for whoever is on turn, so before this existed an off-turn player had nothing but a green
       ring on a turn-order circle to tell them what was happening - and the "how does the auction
       work?" button lived inside that same on-turn-only panel. -->
  <div v-if="visible" class="setup-status" :class="mine ? 'setup-status--mine' : 'setup-status--theirs'">
    <span class="setup-status__text">
      <b>{{ who }}</b>
      {{ assignment }}
    </span>
    <b-btn
      v-if="showSilentAuctionInfo"
      v-b-modal.silent-auction-info
      variant="link"
      size="sm"
      class="setup-status__info"
    >
      How does the auction work? <b-badge variant="info" pill>i</b-badge>
    </b-btn>
    <SilentAuctionInfo v-if="showSilentAuctionInfo" />
    <b-btn
      v-if="showPreferenceSplitInfo"
      v-b-modal.preference-split-info
      variant="link"
      size="sm"
      class="setup-status__info"
    >
      How does the auction work? <b-badge variant="info" pill>i</b-badge>
    </b-btn>
    <PreferenceSplitInfo v-if="showPreferenceSplitInfo" :budget="gameData.preferenceSplitBudget" />
    <b-btn v-if="showBanPhaseInfo" v-b-modal.ban-phase-info variant="link" size="sm" class="setup-status__info">
      What's the ban phase? <b-badge variant="info" pill>i</b-badge>
    </b-btn>
    <BanPhaseInfo v-if="showBanPhaseInfo" />
  </div>
</template>

<script lang="ts">
import Engine, { AuctionVariant, Phase, Player, PlayerEnum } from "@gaia-project/engine";
import { Component, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";
import { isBeforeRound1 } from "../logic/utils";
import BanPhaseInfo from "./BanPhaseInfo.vue";
import PreferenceSplitInfo from "./PreferenceSplitInfo.vue";
import SilentAuctionInfo from "./SilentAuctionInfo.vue";

/** What the player on turn has to do, in the second person and in the third person. */
const assignments: { [phase: string]: [string, string] } = {
  [Phase.SetupFactionBan]: ["to ban a faction", "to ban a faction"],
  [Phase.SetupFaction]: ["to pick a faction", "to pick a faction"],
  [Phase.SetupAuction]: ["to bid on a faction", "to bid on a faction"],
  [Phase.SetupSilentBid]: ["to submit your secret bids", "to submit their secret bids"],
  // The Preference Split Auction is simultaneous, so "whose turn" is really "who is still missing";
  // the engine's turn pointer only decides the order the submissions are recorded in.
  [Phase.SetupPreferenceBid]: ["to split your bid points", "to split their bid points"],
  [Phase.SetupBuilding]: ["to place your starting buildings", "to place their starting buildings"],
  [Phase.SetupBooster]: ["to choose your round booster", "to choose their round booster"],
};

@Component({ components: { BanPhaseInfo, PreferenceSplitInfo, SilentAuctionInfo } })
export default class SetupStatus extends Vue {
  get gameData(): Engine {
    return this.$store.state.data;
  }

  get onTurn(): Player | null {
    const index = this.gameData?.playerToMove;
    return index === undefined || index === null ? null : this.gameData.players[index] ?? null;
  }

  /** True only when the viewer is locked to the seat on turn - hot-seat/self-contained play has no
   * locked seat, and there "your turn" would be meaningless since every seat is the viewer's. */
  get mine(): boolean {
    const seat: PlayerEnum | undefined = this.$store.state.player?.index;
    return seat !== undefined && seat !== null && seat >= 0 && seat === this.gameData?.playerToMove;
  }

  get visible(): boolean {
    const data = this.gameData;
    // Hosted Preference Split bidding is simultaneous: naming one seat as "on turn" there would be
    // actively wrong, and the bid panel right below says what is actually happening (n of 4 in).
    // Hot-seat play keeps the line, because there the device really does get passed around.
    if (data?.phase === Phase.SetupPreferenceBid && this.$store.state.sealedBidBackend) {
      return false;
    }
    return (
      !!data &&
      data.players?.length > 0 &&
      isBeforeRound1(data) &&
      data.phase in assignments &&
      this.onTurn !== null &&
      !!this.assignment
    );
  }

  get assignment(): string {
    return assignments[this.gameData?.phase]?.[this.mine ? 0 : 1] ?? "";
  }

  get who(): string {
    if (this.mine) {
      return "Your turn";
    }
    const name = this.playerName;
    return `${name}${name.endsWith("s") ? "'" : "'s"} turn`;
  }

  private get playerName(): string {
    const pl = this.onTurn;
    if (!pl) {
      return "?";
    }
    // The account name first: during setup a faction is only provisional (the Silent Auction can
    // still reassign it), and in the ban phase nobody has one at all.
    return pl.name || (pl.faction ? factionName(pl.faction) : `Player ${(pl.player as number) + 1}`);
  }

  get showSilentAuctionInfo(): boolean {
    return (
      this.gameData.options.auction === AuctionVariant.Silent &&
      (this.gameData.phase === Phase.SetupFactionBan ||
        this.gameData.phase === Phase.SetupFaction ||
        this.gameData.phase === Phase.SetupSilentBid)
    );
  }

  get showPreferenceSplitInfo(): boolean {
    return (
      this.gameData.options.auction === AuctionVariant.PreferenceSplit &&
      (this.gameData.phase === Phase.SetupFactionBan || this.gameData.phase === Phase.SetupFaction)
    );
  }

  // The ban phase's own explainer, only when the Silent Auction walkthrough (which covers banning
  // as its own first step) isn't already offered above.
  get showBanPhaseInfo(): boolean {
    return this.gameData.phase === Phase.SetupFactionBan && this.gameData.options.auction !== AuctionVariant.Silent;
  }
}
</script>

<style lang="scss" scoped>
.setup-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
  padding: 0.25rem 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid transparent;
  font-size: 0.95rem;
}

.setup-status__text {
  min-width: 0;
}

.setup-status--mine {
  border-color: rgba(40, 167, 69, 0.5);
  background: rgba(40, 167, 69, 0.12);
}

.setup-status--theirs {
  border-color: rgba(128, 128, 128, 0.35);
  background: rgba(128, 128, 128, 0.1);
}

.setup-status__info {
  margin-left: auto;
  padding-top: 0;
  padding-bottom: 0;
  white-space: nowrap;
  text-decoration: none;

  .badge {
    margin-left: 0.25rem;
  }
}
</style>
