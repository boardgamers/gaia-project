<template>
  <!-- The Silent Auction's private bidding screen; SealedBidPanel.ts holds everything it shares
       with the Preference Split's, including why both render from Game.vue's round-0 strip rather
       than from Commands.vue. Until 2026-08-12 this form lived inside Commands.vue and could only
       be filled in by the one seat the engine's turn pointer named, which turned a round nobody
       can react to into four consecutive turns of waiting. -->
  <div v-if="visible" class="silent-auction-bid">
    <div class="silent-auction-bid__header">
      <b>Silent Auction{{ seatSuffix }}</b>
      <b-btn v-b-modal.silent-auction-info variant="link" size="sm" class="silent-auction-bid__info">
        How does it work? <b-badge variant="info" pill>i</b-badge>
      </b-btn>
    </div>

    <template v-if="!submitted">
      <p class="text-muted small mb-2">
        Privately enter the most VP you're willing to pay for each faction - bid highest on the one you want most, and
        <b>0</b> on one you'd only take for free. Everyone bids at the same time and
        <b>nothing is revealed until all {{ playerCount }} sets of bids are in</b>, then the auction resolves
        automatically. You never pay more than you bid, and usually a lot less.
      </p>

      <!-- The faction is a real button (FactionSheetButton) rather than a label, so the factions
           being bid on can actually be read before committing VP to them - the picker that normally
           offers that is long gone by this phase. The name column is a fixed width so every bid
           input lines up, whatever the names are. -->
      <div v-for="faction in factions" :key="faction" class="d-flex align-items-center mb-2">
        <FactionSheetButton :faction="faction" class="silent-auction-bid__faction mr-2" />
        <b-form-input
          type="number"
          min="0"
          :max="maxBid"
          step="1"
          v-model.number="values[faction]"
          :aria-label="`Your bid for ${factionLabel(faction)}`"
          class="silent-auction-bid__input"
        />
      </div>

      <div v-if="submissionError" class="small text-danger mb-2">{{ submissionError }}</div>
      <div v-if="error" class="small text-danger mb-2">{{ error }}</div>

      <div v-if="turnHint" class="small text-muted mb-2">{{ turnHint }}</div>
      <b-btn
        variant="primary"
        class="silent-auction-bid__submit"
        :disabled="!valid || busy || waitingForTurn"
        @click="submit"
      >
        {{ busy ? "Submitting…" : "Submit my bids" }}
      </b-btn>
    </template>

    <template v-else>
      <p class="mb-1">
        <b>Your bids are in.</b> They stay sealed until everyone has submitted - nobody can see them, and they cannot be
        changed.
      </p>
      <p class="text-muted small mb-0">{{ waitingText }}</p>
    </template>

    <!-- Who is still deciding. Shown while the form is open too, not just afterwards: knowing you
         are the last one everybody is waiting for is exactly the thing you want to know BEFORE you
         submit. Progress only - `sealed_bid_status()` never returns anybody's points. -->
    <div class="silent-auction-bid__roster">
      <div class="silent-auction-bid__roster-title">
        Bid status
        <span class="silent-auction-bid__roster-count">{{ submittedCount }} of {{ playerCount }} in</span>
      </div>
      <ul class="silent-auction-bid__roster-list">
        <li
          v-for="row in roster"
          :key="row.seat"
          class="silent-auction-bid__roster-row"
          :class="{
            'silent-auction-bid__roster-row--done': row.done,
            'silent-auction-bid__roster-row--mine': row.mine,
          }"
        >
          <span class="silent-auction-bid__roster-mark" aria-hidden="true">{{ row.done ? "✔" : "…" }}</span>
          <span class="silent-auction-bid__roster-name">{{ row.name }}</span>
          <span class="silent-auction-bid__roster-state">{{ row.state }}</span>
        </li>
      </ul>
    </div>

    <SilentAuctionInfo />
  </div>
</template>

<script lang="ts">
import { Command, MAX_SILENT_BID, silentAuctionBidError } from "@gaia-project/engine";
import { Component } from "vue-property-decorator";
import type { SealedBidVariant } from "../logic/sealed-bid";
import FactionSheetButton from "./FactionSheetButton.vue";
import SealedBidPanel from "./SealedBidPanel";
import SilentAuctionInfo from "./SilentAuctionInfo.vue";

@Component({ components: { FactionSheetButton, SilentAuctionInfo } })
export default class SilentAuctionBid extends SealedBidPanel {
  get variant(): SealedBidVariant {
    return "silent";
  }

  get commandName(): Command {
    return Command.SilentBid;
  }

  get submittedStateLabel(): string {
    return "Bids submitted";
  }

  /** The exact rule the engine and the database both enforce - shared, so the button can never be
   * enabled for something the server would reject (or disabled for something it would accept).
   * Rendered above the button too: unlike a budget split there is no running tally to make an
   * over-the-ceiling bid obvious on its own. */
  get submissionError(): string | null {
    return silentAuctionBidError(this.entries, this.factions, this.maxBid);
  }

  /** The engine's own record of who has bid, which is what offline/hot-seat play reads. In hosted
   * play it is empty for the whole round by construction - a non-empty one means a game that
   * started under the old sequential flow, and `sealedBidPhase` hides this panel for those. */
  get engineSubmittedSeats(): number[] {
    return (this.gameData?.silentAuctionBids ?? []).map((bid) => bid.player as number);
  }

  /** The ceiling on any single bid. From the available command when the engine offers one, from
   * the server's status otherwise (a seat the turn pointer is not on has no command of its own). */
  get maxBid(): number {
    return this.command?.data?.maxBid ?? this.status?.maxBid ?? MAX_SILENT_BID;
  }

  /** Deliberately carries no count: the roster right underneath is the one place progress is
   * reported, so the two can never drift apart or say the same thing twice. */
  get waitingText(): string {
    if (!this.backend) {
      return "Pass the device to the next player.";
    }
    return this.submittedCount >= this.playerCount
      ? "Everyone has submitted - resolving the auction…"
      : "The auction resolves itself the moment the last set of bids lands.";
  }
}
</script>

<style lang="scss" scoped>
.silent-auction-bid {
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
  border: 1px solid rgba(23, 162, 184, 0.45);
  border-radius: 0.25rem;
  background: rgba(23, 162, 184, 0.1);
}

.silent-auction-bid__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.silent-auction-bid__info {
  margin-left: auto;
  padding-top: 0;
  padding-bottom: 0;
  white-space: nowrap;
  text-decoration: none;

  .badge {
    margin-left: 0.25rem;
  }
}

// Fixed width so every bid input lines up whatever the faction names are.
.silent-auction-bid__faction {
  width: 9rem;
  flex: 0 0 auto;
}

.silent-auction-bid__input {
  width: 6rem;
}

.silent-auction-bid__roster {
  margin-top: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(23, 162, 184, 0.35);
}

.silent-auction-bid__roster-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6c757d;
}

.silent-auction-bid__roster-count {
  margin-left: auto;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}

.silent-auction-bid__roster-list {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
}

.silent-auction-bid__roster-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #b36b00;
}

.silent-auction-bid__roster-row--done {
  color: #2b7a2b;
}

.silent-auction-bid__roster-row--mine .silent-auction-bid__roster-name {
  font-weight: 600;
}

.silent-auction-bid__roster-mark {
  width: 1rem;
  flex: 0 0 auto;
  text-align: center;
}

.silent-auction-bid__roster-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.silent-auction-bid__roster-state {
  margin-left: auto;
  flex: 0 0 auto;
  font-size: 0.8rem;
}
</style>
