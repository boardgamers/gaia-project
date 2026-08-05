<template>
  <!-- The private bidding screen. Rendered from Game.vue's round-0 strip rather than from
       Commands.vue, because in hosted play all four seats bid AT THE SAME TIME - `canPlay` (which
       gates Commands) is only ever true for the one seat the engine happens to point at, so three
       of the four players would have no way to submit. -->
  <div v-if="visible" class="preference-split-bid">
    <div class="preference-split-bid__header">
      <b>Preference Split Auction{{ seatSuffix }}</b>
      <b-btn v-b-modal.preference-split-info variant="link" size="sm" class="preference-split-bid__info">
        How does it work? <b-badge variant="info" pill>i</b-badge>
      </b-btn>
    </div>

    <template v-if="!submitted">
      <p class="text-muted small mb-2">
        Split exactly <b>{{ budget }}</b> bid points across the four factions - highest on the one you want most,
        <b>0</b> on one you'd take only for free. Everyone submits at the same time and
        <b>nothing is revealed until all {{ playerCount }} splits are in</b>. The winner of a faction pays the average
        of all four bids on it, and never more than their own bid.
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

    <PreferenceSplitInfo :budget="budget" />
  </div>
</template>

<script lang="ts">
import Engine, { Command, Faction, Phase, preferenceSplitBidError } from "@gaia-project/engine";
import { Component, Vue, Watch } from "vue-property-decorator";
import { factionName } from "../data/factions";
import { SealedBidBackend } from "../store";
import FactionSheetButton from "./FactionSheetButton.vue";
import PreferenceSplitInfo from "./PreferenceSplitInfo.vue";

/** How often the waiting screen re-reads submission progress. There is nothing to subscribe to:
 * sealed rows are invisible to other players by design, so Realtime cannot deliver them. */
const POLL_INTERVAL_MS = 5000;

@Component({ components: { FactionSheetButton, PreferenceSplitInfo } })
export default class PreferenceSplitBid extends Vue {
  values: Record<string, number> = {};
  busy = false;
  error = "";
  /** Set once this device has submitted for `seat`, so the form doesn't come back while the poll
   * is still catching up. Server-side the submission is final regardless. */
  private submittedSeat: number | null = null;
  private poller: number | null = null;

  get gameData(): Engine {
    return this.$store.state.data;
  }

  /** Hosted mode only. Null in offline/hot-seat play, where the bid is an ordinary move. */
  get backend(): SealedBidBackend | null {
    return this.$store.state.sealedBidBackend;
  }

  get status() {
    return this.$store.state.sealedBidStatus;
  }

  get bidding(): boolean {
    return this.gameData?.phase === Phase.SetupPreferenceBid;
  }

  /**
   * The seat this device is bidding for.
   *
   * Hosted: the seat the viewer is locked to (`player.index`), whoever the engine currently points
   * at - that is what makes the four submissions genuinely simultaneous. Offline/hot-seat: the seat
   * on turn, since the device is passed around and the engine's own order decides.
   */
  get seat(): number | null {
    if (this.backend) {
      const locked = this.$store.state.player?.index;
      return typeof locked === "number" && locked >= 0 ? locked : null;
    }
    const onTurn = this.gameData?.playerToMove;
    return typeof onTurn === "number" ? onTurn : null;
  }

  get command() {
    return this.gameData?.availableCommands?.find((c) => c.name === Command.PreferenceBid) ?? null;
  }

  get factions(): Faction[] {
    return (this.command?.data?.factions ?? this.gameData?.setup ?? []) as Faction[];
  }

  get budget(): number {
    return this.command?.data?.budget ?? this.status?.budget ?? this.gameData?.preferenceSplitBudget ?? 0;
  }

  get playerCount(): number {
    return this.status?.playerCount ?? this.gameData?.players?.length ?? 0;
  }

  get submitted(): boolean {
    if (this.seat === null) {
      return false;
    }
    if (this.submittedSeat === this.seat) {
      return true;
    }
    return (this.status?.submittedSeats ?? []).includes(this.seat);
  }

  get visible(): boolean {
    return this.bidding && this.seat !== null && this.factions.length > 0;
  }

  /** Hosted play has real seats, so name which one this form is for when the user holds several. */
  get seatSuffix(): string {
    const name = this.seat === null ? "" : this.gameData?.players?.[this.seat]?.name ?? "";
    return this.backend && name ? ` — ${name}` : "";
  }

  get waitingText(): string {
    const submitted = this.status?.submittedSeats?.length ?? 0;
    if (!this.backend) {
      return "Pass the device to the next player.";
    }
    return submitted >= this.playerCount
      ? "Everyone has submitted - resolving the auction…"
      : `${submitted} of ${this.playerCount} players have submitted. The auction resolves itself the moment the last one does.`;
  }

  get allocated(): number {
    return this.factions.reduce((sum, faction) => sum + (Number(this.values[faction]) || 0), 0);
  }

  get remaining(): number {
    return this.budget - this.allocated;
  }

  get entries() {
    return this.factions.map((faction) => ({ faction: faction as string, points: Number(this.values[faction]) || 0 }));
  }

  /** The exact rule the engine and the database both enforce - shared, so the button can never be
   * enabled for something the server would reject (or disabled for something it would accept). */
  get valid(): boolean {
    return preferenceSplitBidError(this.entries, this.factions, this.budget) === null;
  }

  created() {
    this.resetValues();
    this.startPolling();
  }

  beforeDestroy() {
    this.stopPolling();
  }

  /** The factions are only known once the pick round has finished, which can happen after this
   * component is created (the round-0 strip stays mounted across the whole setup stage). */
  @Watch("factions")
  onFactionsChanged(next: Faction[], previous: Faction[]) {
    if (next.join(",") !== (previous ?? []).join(",")) {
      this.resetValues();
    }
  }

  /** Same reason: this component is mounted for the whole game, so the bid phase usually starts
   * well after `created()`. Polling follows the phase in and out rather than running regardless. */
  @Watch("bidding")
  onBiddingChanged(bidding: boolean) {
    if (bidding) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  factionLabel(faction: Faction): string {
    return factionName(faction);
  }

  private resetValues() {
    const values: Record<string, number> = {};
    for (const faction of this.factions) {
      values[faction] = 0;
    }
    this.values = values;
  }

  private startPolling() {
    if (!this.backend || this.poller !== null || !this.bidding) {
      return;
    }
    // Kick once immediately so a freshly opened game shows real progress rather than "0 of 4".
    this.backend.refresh().catch(() => undefined);
    this.poller = window.setInterval(() => {
      if (!this.bidding) {
        this.stopPolling();
        return;
      }
      this.backend?.refresh().catch(() => undefined);
    }, POLL_INTERVAL_MS);
  }

  private stopPolling() {
    if (this.poller !== null) {
      window.clearInterval(this.poller);
      this.poller = null;
    }
  }

  async submit() {
    const seat = this.seat;
    if (seat === null || !this.valid || this.busy) {
      return;
    }
    this.error = "";
    this.busy = true;
    try {
      if (this.backend) {
        await this.backend.submit(seat, this.entries);
        this.submittedSeat = seat;
      } else {
        // Offline/hot-seat: no server to seal anything, so the bid is an ordinary move for the seat
        // on turn and secrecy is whoever else is looking at the screen.
        this.$emit(
          "command",
          `${Command.PreferenceBid} ${this.entries.map((e) => `${e.faction} ${e.points}`).join(" ")}`
        );
        this.resetValues();
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.busy = false;
    }
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
</style>
