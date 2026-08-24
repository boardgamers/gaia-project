<template>
  <!-- The Preference Split's private bidding screen; SealedBidPanel.ts holds everything it shares
       with the Silent Auction's, including why both render from Game.vue's round-0 strip rather
       than from Commands.vue. -->
  <div v-if="visible" class="preference-split-bid">
    <div class="preference-split-bid__header">
      <b>Preference Split Auction{{ seatSuffix }}</b>
      <b-btn v-b-modal.preference-split-info variant="link" size="sm" class="preference-split-bid__info">
        How does it work? <b-badge variant="info" pill>i</b-badge>
      </b-btn>
    </div>

    <template v-if="!submitted">
      <p class="text-muted small mb-2">
        Split exactly <b>{{ budget }}</b> bid points across the {{ factions.length }} factions - highest on the one you
        want most, <b>0</b> on one you'd take only for free. Everyone submits at the same time and
        <b>nothing is revealed until all {{ playerCount }} splits are in</b>. Whoever wins a faction pays the average of
        every bid on it - your own bid decides which faction you get, not what it costs, so you can end up paying more
        than you put on it.
      </p>

      <div v-for="faction in factions" :key="faction" class="d-flex align-items-center mb-2">
        <FactionSheetButton :faction="faction" class="preference-split-bid__faction mr-2" />
        <b-form-input
          type="number"
          min="0"
          :max="budget"
          step="1"
          v-model.number="values[faction]"
          :aria-label="`Your bid for ${factionLabel(faction)}`"
          class="preference-split-bid__input"
        />
      </div>

      <div class="preference-split-bid__tally" :class="{ 'preference-split-bid__tally--ok': valid }">
        <span
          >Allocated <b>{{ allocated }}</b> of {{ budget }}</span
        >
        <span
          >Remaining <b>{{ remaining }}</b></span
        >
      </div>
      <div v-if="error" class="small text-danger mb-2">{{ error }}</div>

      <b-btn variant="primary" class="preference-split-bid__submit" :disabled="!valid || busy" @click="submit">
        {{ busy ? "Submitting…" : "Submit my split" }}
      </b-btn>
    </template>

    <template v-else>
      <p class="mb-1">
        <b>Your split is in.</b> It stays sealed until everyone has submitted - nobody can see it, and it cannot be
        changed.
      </p>
      <p class="text-muted small mb-0">{{ waitingText }}</p>
    </template>

    <!-- Who is still deciding. Shown while the form is open too, not just afterwards: knowing you
         are the last one everybody is waiting for is exactly the thing you want to know BEFORE you
         submit. Progress only - `sealed_bid_status()` never returns anybody's points. -->
    <div class="preference-split-bid__roster">
      <div class="preference-split-bid__roster-title">
        Bid status
        <span class="preference-split-bid__roster-count">{{ submittedCount }} of {{ playerCount }} in</span>
      </div>
      <ul class="preference-split-bid__roster-list">
        <li
          v-for="row in roster"
          :key="row.seat"
          class="preference-split-bid__roster-row"
          :class="{
            'preference-split-bid__roster-row--done': row.done,
            'preference-split-bid__roster-row--mine': row.mine,
          }"
        >
          <span class="preference-split-bid__roster-mark" aria-hidden="true">{{ row.done ? "✔" : "…" }}</span>
          <span class="preference-split-bid__roster-name">{{ row.name }}</span>
          <span class="preference-split-bid__roster-state">{{ row.state }}</span>
        </li>
      </ul>
    </div>

    <PreferenceSplitInfo :budget="budget" />
  </div>
</template>

<script lang="ts">
import { Command, Faction, preferenceSplitBidError } from "@gaia-project/engine";
import { Component } from "vue-property-decorator";
import { SealedBidVariant } from "../logic/sealed-bid";
import FactionSheetButton from "./FactionSheetButton.vue";
import PreferenceSplitInfo from "./PreferenceSplitInfo.vue";
import SealedBidPanel from "./SealedBidPanel";

@Component({ components: { FactionSheetButton, PreferenceSplitInfo } })
export default class PreferenceSplitBid extends SealedBidPanel {
  get variant(): SealedBidVariant {
    return "preference-split";
  }

  get commandName(): Command {
    return Command.PreferenceBid;
  }

  get submittedStateLabel(): string {
    return "Split submitted";
  }

  /** The exact rule the engine and the database both enforce - shared, so the button can never be
   * enabled for something the server would reject (or disabled for something it would accept). */
  get submissionError(): string | null {
    return preferenceSplitBidError(this.entries, this.factions, this.budget);
  }

  /** The engine's own record of who has bid, which is what offline/hot-seat play reads (hosted
   * play keeps the submissions server-side until the reveal, so this stays empty there). */
  get engineSubmittedSeats(): number[] {
    return (this.gameData?.preferenceSplitBids ?? []).map((bid) => bid.player as number);
  }

  get budget(): number {
    return this.command?.data?.budget ?? this.status?.budget ?? this.gameData?.preferenceSplitBudget ?? 0;
  }

  /** Deliberately carries no count: the roster right underneath is the one place progress is
   * reported, so the two can never drift apart or say the same thing twice. */
  get waitingText(): string {
    if (!this.backend) {
      return "Pass the device to the next player.";
    }
    return this.submittedCount >= this.playerCount
      ? "Everyone has submitted - resolving the auction…"
      : "The auction resolves itself the moment the last split lands.";
  }

  get allocated(): number {
    return this.factions.reduce((sum: number, faction: Faction) => sum + (Number(this.values[faction]) || 0), 0);
  }

  get remaining(): number {
    return this.budget - this.allocated;
  }
}
</script>

<style lang="scss" scoped>
.preference-split-bid {
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
  border: 1px solid rgba(23, 162, 184, 0.45);
  border-radius: 0.25rem;
  background: rgba(23, 162, 184, 0.1);
}

.preference-split-bid__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.preference-split-bid__info {
  margin-left: auto;
  padding-top: 0;
  padding-bottom: 0;
  white-space: nowrap;
  text-decoration: none;

  .badge {
    margin-left: 0.25rem;
  }
}

// Fixed width so every bid input lines up whatever the faction names are - same trick the Silent
// Auction's own form uses.
.preference-split-bid__faction {
  width: 9rem;
  flex: 0 0 auto;
}

.preference-split-bid__input {
  width: 6rem;
}

.preference-split-bid__tally {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #b36b00;
}

.preference-split-bid__tally--ok {
  color: #2b7a2b;
}

.preference-split-bid__roster {
  margin-top: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(23, 162, 184, 0.35);
}

.preference-split-bid__roster-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6c757d;
}

.preference-split-bid__roster-count {
  margin-left: auto;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}

.preference-split-bid__roster-list {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
}

.preference-split-bid__roster-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #b36b00;
}

.preference-split-bid__roster-row--done {
  color: #2b7a2b;
}

.preference-split-bid__roster-row--mine .preference-split-bid__roster-name {
  font-weight: 600;
}

.preference-split-bid__roster-mark {
  width: 1rem;
  flex: 0 0 auto;
  text-align: center;
}

.preference-split-bid__roster-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preference-split-bid__roster-state {
  margin-left: auto;
  flex: 0 0 auto;
  font-size: 0.8rem;
}
</style>
