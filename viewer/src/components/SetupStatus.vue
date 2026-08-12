<template>
  <!-- Round 0 status strip, shown to everyone (see Game.vue). The action panel below only renders
       for whoever is on turn, so before this existed an off-turn player had nothing but a green
       ring on a turn-order circle to tell them what was happening - and the "how does the auction
       work?" button lived inside that same on-turn-only panel. -->
  <div v-if="visible" class="setup-status" :class="mine ? 'setup-status--mine' : 'setup-status--theirs'">
    <div class="setup-status__main">
      <span class="setup-status__text">
        <b>{{ who }}</b>
        {{ assignment }}
      </span>
      <span v-if="showBanPhaseInfo || auctionInfoModalId" class="setup-status__links">
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

    <!-- Who is done and who is not, for the round-0 phases where that adds information beyond the
         turn-order avatars and `who` above. Never carries what anybody picked or bid - only whether
         they have. The ban phase deliberately has no roster: it is sequential, and repeating the
         same active player directly below the turn text and highlighted avatar was redundant. -->
    <div v-if="roster.length > 0" class="setup-status__roster">
      <span class="setup-status__roster-label">{{ rosterLabel }}</span>
      <span
        v-for="row in roster"
        :key="row.seat"
        class="setup-status__chip"
        :class="{
          'setup-status__chip--done': row.done,
          'setup-status__chip--turn': row.onTurn,
          'setup-status__chip--mine': row.mine,
        }"
        :aria-label="row.label"
        :title="row.label"
      >
        <span class="setup-status__chip-mark" aria-hidden="true">{{ row.done ? "✔" : row.onTurn ? "▸" : "·" }}</span>
        {{ row.name }}
      </span>
      <span class="setup-status__roster-count">{{ doneCount }} of {{ roster.length }} in</span>
    </div>
  </div>
</template>

<script lang="ts">
import Engine, { AuctionVariant, Phase, Player, PlayerEnum } from "@gaia-project/engine";
import { Component, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";
import { isLegacySequentialBidRound, sealedBidPhase } from "../logic/sealed-bid";
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

/**
 * The round-0 phases that get a per-player done/waiting roster, and what to call it.
 *
 * Only phases where every player owes **exactly one** thing qualify, so "done" is a real state:
 *
 * - the sequential ban phase is deliberately absent because the turn-order avatar and status line
 *   already identify the only player who can act;
 * - `SetupAuction` (the Choose-Then-Bid and Bid-While-Choosing variants) is deliberately absent.
 *   There a player bids repeatedly and can be outbid again afterwards, so a done/waiting mark would
 *   be actively wrong - what matters there is who currently leads which faction at what price,
 *   which the turn-order circles and the auction's own buttons already show.
 * - both simultaneous bid rounds (`SetupPreferenceBid`, `SetupSilentBid`) are absent too, but for
 *   the opposite reason: their submissions all happen at once, and each variant's bid panel
 *   (`PreferenceSplitBid.vue` / `SilentAuctionBid.vue`) already carries the same roster inside the
 *   form itself, fed by the server's sealed-bid status in hosted play. Rendering it here as well
 *   would put two of them on one screen.
 */
const rosterLabels: { [phase: string]: string } = {
  [Phase.SetupFaction]: "Picks",
};

/** The state each roster phase reports, in the third person, for the chip's tooltip/aria-label. */
const rosterStates: { [phase: string]: [string, string] } = {
  [Phase.SetupFaction]: ["has picked a faction", "has not picked yet"],
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
    // Hosted sealed bidding (either variant) is simultaneous: naming one seat as "on turn" there
    // would be actively wrong, and the bid panel right below says what is actually happening
    // (n of 4 in). Hot-seat play keeps the line, because there the device really is passed around,
    // and so does a legacy sequential Silent Auction, which genuinely still bids one seat at a time.
    if (sealedBidPhase(data) && this.$store.state.sealedBidBackend && !isLegacySequentialBidRound(data)) {
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
    return this.onTurn ? this.seatName(this.onTurn.player as PlayerEnum) : "?";
  }

  private seatName(seat: PlayerEnum): string {
    const pl = this.gameData?.players?.[seat as number];
    if (!pl) {
      return "?";
    }
    // The account name first: during setup a faction is only provisional (the Silent Auction can
    // still reassign it), and in the ban phase nobody has one at all.
    return pl.name || (pl.faction ? factionName(pl.faction) : `Player ${(seat as number) + 1}`);
  }

  get rosterLabel(): string {
    return rosterLabels[this.gameData?.phase] ?? "";
  }

  /**
   * One entry per seat: has this player done their one thing for this phase yet?
   *
   * Each phase is read from the state that phase actually writes, rather than from a shared
   * "how many moves have been made" counter:
   *
   * - a pick sets `player.faction`, which is order-independent - Bid-While-Choosing interleaves
   *   picks with bids, so a positional rule would be wrong there.
   */
  get roster(): { seat: number; name: string; done: boolean; onTurn: boolean; mine: boolean; label: string }[] {
    const data = this.gameData;
    if (!this.rosterLabel || !data?.players?.length) {
      return [];
    }
    const mySeat = this.$store.state.player?.index;
    const [doneState, waitingState] = rosterStates[data.phase];
    return data.players.map((_, seat: number) => {
      const done = this.hasActed(seat);
      const name = this.seatName(seat as PlayerEnum);
      return {
        seat,
        name,
        done,
        onTurn: seat === data.playerToMove,
        mine: typeof mySeat === "number" && mySeat === seat,
        label: `${name} ${done ? doneState : waitingState}`,
      };
    });
  }

  get doneCount(): number {
    return this.roster.filter((row) => row.done).length;
  }

  private hasActed(seat: number): boolean {
    const data = this.gameData;
    switch (data.phase) {
      case Phase.SetupFaction:
        // Truthiness, not `!== undefined`: an unpicked seat's faction is `null` (Player's own
        // initializer), and the Silent Auction resets it to `undefined` when it reassigns.
        return !!data.players[seat]?.faction;
      default:
        return false;
    }
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
  padding: 0.25rem 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid transparent;
  font-size: 0.95rem;
}

.setup-status__main {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0.25rem 0.5rem;
}

.setup-status__text {
  flex: 1 1 auto;
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
  padding: 0 0.25rem;
  white-space: nowrap;
  text-decoration: none;

  .badge {
    margin-left: 0.25rem;
  }
}

.setup-status__links {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.1rem;
  margin-left: auto;
}

.setup-status__roster {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.2rem 0.4rem;
  margin-top: 0.2rem;
  font-size: 0.8rem;
}

.setup-status__roster-label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6c757d;
}

.setup-status__roster-count {
  margin-left: auto;
  color: #6c757d;
  white-space: nowrap;
}

.setup-status__chip {
  display: inline-flex;
  align-items: baseline;
  gap: 0.2rem;
  padding: 0 0.35rem;
  border-radius: 0.75rem;
  border: 1px solid currentColor;
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  // Waiting is the default state; done and on-turn each override it below.
  color: #8a8a8a;
}

.setup-status__chip--done {
  color: #2b7a2b;
}

.setup-status__chip--turn {
  color: #b36b00;
  font-weight: 600;
}

.setup-status__chip--mine {
  text-decoration: underline;
}

.setup-status__chip-mark {
  flex: 0 0 auto;
}
</style>
