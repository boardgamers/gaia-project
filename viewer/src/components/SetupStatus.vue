<template>
  <div v-if="visible" class="setup-status">
    <span class="setup-status__links">
      <b-btn
        v-if="showBanPhaseInfo"
        v-b-modal.ban-phase-info
        variant="link"
        size="sm"
        class="setup-status__info setup-status__info--ban"
        aria-label="Read about the ban phase"
        title="Read about the ban phase"
      >
        Ban phase <b-badge variant="info" pill>i</b-badge>
      </b-btn>
      <b-btn
        v-if="auctionInfoModalId"
        variant="link"
        size="sm"
        class="setup-status__info setup-status__info--auction"
        :aria-label="`Read about ${auctionTypeName}`"
        :title="`Read about ${auctionTypeName}`"
        @click="$bvModal.show(auctionInfoModalId)"
      >
        Auction type <b-badge variant="info" pill>i</b-badge>
      </b-btn>
    </span>
    <SilentAuctionInfo v-if="showSilentAuctionInfo" />
    <PreferenceSplitInfo v-if="showPreferenceSplitInfo" :budget="gameData.preferenceSplitBudget" />
    <BanPhaseInfo v-if="showBanPhaseInfo" />
    <b-modal
      v-if="showClassicAuctionInfo"
      id="classic-auction-info"
      size="lg"
      :title="`How ${auctionTypeName} works`"
      ok-only
      dialog-class="gaia-viewer-modal"
    >
      <p class="mb-0">{{ classicAuctionDescription }}</p>
    </b-modal>
  </div>
</template>

<script lang="ts">
import Engine, { AuctionVariant, Phase } from "@gaia-project/engine";
import { Component, Vue } from "vue-property-decorator";
import { isBeforeRound1 } from "../logic/utils";
import BanPhaseInfo from "./BanPhaseInfo.vue";
import PreferenceSplitInfo from "./PreferenceSplitInfo.vue";
import SilentAuctionInfo from "./SilentAuctionInfo.vue";

@Component({ components: { BanPhaseInfo, PreferenceSplitInfo, SilentAuctionInfo } })
export default class SetupStatus extends Vue {
  get gameData(): Engine {
    return this.$store.state.data;
  }

  get visible(): boolean {
    const data = this.gameData;
    return !!data && isBeforeRound1(data) && (this.showBanPhaseInfo || !!this.auctionInfoModalId);
  }

  // Deliberately NOT during `SetupSilentBid`: SilentAuctionBid.vue renders this very modal there,
  // and two copies of one `b-modal` id on a page make the button open whichever one Bootstrap-Vue
  // happens to have registered last. Same reason SetupPreferenceBid is missing below.
  get showSilentAuctionInfo(): boolean {
    return (
      this.gameData.options.auction === AuctionVariant.Silent &&
      (this.gameData.phase === Phase.SetupFactionBan || this.gameData.phase === Phase.SetupFaction)
    );
  }

  get showPreferenceSplitInfo(): boolean {
    return (
      this.gameData.options.auction === AuctionVariant.PreferenceSplit &&
      (this.gameData.phase === Phase.SetupFactionBan || this.gameData.phase === Phase.SetupFaction)
    );
  }

  /** The two older, turn-by-turn auction variants share a concise in-game explainer. */
  get showClassicAuctionInfo(): boolean {
    const auction = this.gameData.options.auction;
    return (
      (auction === AuctionVariant.ChooseBid || auction === AuctionVariant.BidWhileChoosing) &&
      (this.gameData.phase === Phase.SetupFactionBan ||
        this.gameData.phase === Phase.SetupFaction ||
        this.gameData.phase === Phase.SetupAuction)
    );
  }

  get auctionInfoModalId(): string {
    if (this.showSilentAuctionInfo) {
      return "silent-auction-info";
    }
    if (this.showPreferenceSplitInfo) {
      return "preference-split-info";
    }
    if (this.showClassicAuctionInfo) {
      return "classic-auction-info";
    }
    return "";
  }

  get auctionTypeName(): string {
    switch (this.gameData.options.auction) {
      case AuctionVariant.Silent:
        return "the Silent Auction";
      case AuctionVariant.PreferenceSplit:
        return "the Preference Split Auction";
      case AuctionVariant.ChooseBid:
        return "Choose, Then Bid";
      case AuctionVariant.BidWhileChoosing:
        return "Bid While Choosing";
      default:
        return "this auction type";
    }
  }

  get classicAuctionDescription(): string {
    if (this.gameData.options.auction === AuctionVariant.ChooseBid) {
      return (
        "Each player first picks a faction in turn order. Once every faction is picked, players take turns " +
        "bidding Victory Points to take a different picked faction. An outbid player becomes the next player who " +
        "needs a faction, and bidding continues until everyone holds one."
      );
    }
    return (
      "Players choose and bid in the same phase. On your turn, either introduce a new faction at no cost or bid " +
      "more Victory Points for one another player holds. An outbid player becomes the next player who needs a " +
      "faction, and the auction ends once everyone holds one."
    );
  }

  // Ban rules are useful alongside (not instead of) the selected auction's rules: ban phase is an
  // independent option and applies before every faction-selection variant.
  get showBanPhaseInfo(): boolean {
    return this.gameData.phase === Phase.SetupFactionBan;
  }
}
</script>

<style lang="scss" scoped>
.setup-status {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.setup-status__links {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
}

.setup-status__info {
  padding: 0 0.25rem;
  white-space: nowrap;
  text-decoration: none;

  .badge {
    margin-left: 0.25rem;
  }
}
</style>
