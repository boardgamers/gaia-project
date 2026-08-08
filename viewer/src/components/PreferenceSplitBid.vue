<template>
  <!-- The private bidding screen. Rendered from Game.vue's round-0 strip rather than from
       Commands.vue, because in hosted play every seat bids AT THE SAME TIME - `canPlay` (which
       gates Commands) is only ever true for the one seat the engine happens to point at, so
       everybody else would have no way to submit. -->
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
  /** Seats this device has submitted for, so the form doesn't come back for one of them while the
   * status poll is still catching up. Server-side the submission is final regardless. */
  private locallySubmitted: number[] = [];
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
   * Every seat this device may submit for, in the order it should be asked for them.
   *
   * - A locked seat (`player.index` >= 0) is the ordinary hosted case: exactly that one, whoever
   *   the engine's turn pointer currently happens to be on. That is what makes the submissions
   *   genuinely simultaneous.
   * - `player.index === -1` is a spectator: nothing to submit.
   * - NO lock at all in hosted play means one account holds every seat - a test game. `seatToLock`
   *   (host.ts) deliberately returns null there, so reading `player.index` alone would leave this
   *   panel with no seat and render nothing, while Commands.vue - whose `canPlay` reads "no lock"
   *   as "you may play" - still pointed at it. That was a real bug: an unplayable bid phase.
   *   Here it means all seats, asked for one at a time.
   * - No lock and no backend is offline/hot-seat: the seat on turn, since the device gets passed
   *   around and the engine's own order decides.
   */
  get mySeats(): number[] {
    const locked = this.$store.state.player?.index;
    if (typeof locked === "number") {
      return locked >= 0 ? [locked] : [];
    }
    if (this.backend) {
      return (this.gameData?.players ?? []).map((_, index: number) => index);
    }
    const onTurn = this.gameData?.playerToMove;
    return typeof onTurn === "number" ? [onTurn] : [];
  }

  /**
   * Every seat that has submitted, from whichever source knows.
   *
   * - `status.submittedSeats` is the hosted truth (`sealed_bid_status()`), but it is polled, so it
   *   lags this device's own submission by up to POLL_INTERVAL_MS - hence `locallySubmitted`.
   * - `preferenceSplitBids` is the offline/hot-seat one: there is no server there, so a submitted
   *   split is an ordinary move and the engine itself is the record of who has bid. It stays empty
   *   in hosted play until the reveal, by which point this panel is gone.
   */
  get submittedSeats(): number[] {
    const done = new Set<number>([
      ...(this.status?.submittedSeats ?? []),
      ...this.locallySubmitted,
      ...(this.gameData?.preferenceSplitBids ?? []).map((bid) => bid.player as number),
    ]);
    return [...done].sort((a, b) => a - b);
  }

  get submittedCount(): number {
    return this.submittedSeats.length;
  }

  /** The seats above that still owe a submission. */
  get pendingSeats(): number[] {
    const done = new Set<number>(this.submittedSeats);
    return this.mySeats.filter((seat) => !done.has(seat));
  }

  /** One row per seat at the table: who has locked their split in and who has not. */
  get roster(): { seat: number; name: string; done: boolean; mine: boolean; state: string }[] {
    const done = new Set<number>(this.submittedSeats);
    const mine = new Set<number>(this.mySeats);
    const seats = Math.max(this.playerCount, this.gameData?.players?.length ?? 0);
    return Array.from({ length: seats }, (_, seat) => {
      const isMine = mine.has(seat);
      const isDone = done.has(seat);
      return {
        seat,
        name: this.seatName(seat) + (isMine && this.mySeats.length === 1 ? " (you)" : ""),
        done: isDone,
        mine: isMine,
        state: isDone ? "Split submitted" : "Still choosing",
      };
    });
  }

  /** The seat the form is currently for: the next one that still owes a submission. */
  get seat(): number | null {
    return this.pendingSeats.length > 0 ? this.pendingSeats[0] : this.mySeats[0] ?? null;
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

  /** True once this device has nothing left to submit - show the waiting screen instead. */
  get submitted(): boolean {
    return this.mySeats.length > 0 && this.pendingSeats.length === 0;
  }

  get visible(): boolean {
    return this.bidding && this.mySeats.length > 0 && this.factions.length > 0;
  }

  /** Always name the seat being bid for. It is not decoration when this device holds several of
   * them (a hosted test game, or hot-seat play): it is the only thing saying whose split this is. */
  get seatSuffix(): string {
    return this.seat === null ? "" : ` — ${this.seatName(this.seat)}`;
  }

  seatName(seat: number): string {
    return this.gameData?.players?.[seat]?.name || `Player ${seat + 1}`;
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

  /** A hosted test game (or hot-seat play) walks this form through several seats in turn - each one
   * has to start from a blank split, not the previous player's numbers. */
  @Watch("seat")
  onSeatChanged(next: number | null, previous: number | null) {
    if (next !== previous) {
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
        this.locallySubmitted = [...this.locallySubmitted, seat];
        this.resetValues();
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
