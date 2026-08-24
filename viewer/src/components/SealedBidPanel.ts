import Engine, { Command, Faction } from "@gaia-project/engine";
import { Component, Vue, Watch } from "vue-property-decorator";
import { factionName } from "../data/factions";
import { isLegacySequentialBidRound, sealedBidPhase, SealedBidVariant } from "../logic/sealed-bid";
import { SealedBidBackend } from "../store";

/** How often the panel re-reads submission progress. There is nothing to subscribe to: sealed rows
 * are invisible to other players by design, so Realtime cannot deliver them. */
const POLL_INTERVAL_MS = 5000;

/**
 * Everything the two simultaneous-bid panels (`PreferenceSplitBid.vue`, `SilentAuctionBid.vue`)
 * do identically, which is nearly all of it: work out which seats this device may submit for, keep
 * a per-faction number for each, poll the server for who is still deciding, render a roster from
 * that, and submit either through the sealed backend (hosted) or as an ordinary move (offline /
 * hot-seat, where there is no server to seal anything and secrecy is pass-the-device).
 *
 * The variants differ only in what a legal submission IS - the Preference Split splits one fixed
 * budget across the factions, the Silent Auction bids on each independently up to a ceiling - so
 * that, the wording, and the form layout are all a subclass supplies. Everything above is the
 * mechanism that makes bidding simultaneous, and it is deliberately shared: the two rounds are the
 * same round with different arithmetic, and any drift between them (whose submission counts, when
 * the reveal fires, what the roster claims) would be a bug in one of them.
 *
 * Both panels render from Game.vue's round-0 strip rather than from Commands.vue, because in
 * hosted play every seat bids AT THE SAME TIME - `canPlay` (which gates Commands) is only ever true
 * for the one seat the engine happens to point at, so everybody else would have no way to submit.
 */
@Component
export default class SealedBidPanel extends Vue {
  values: Record<string, number> = {};
  busy = false;
  error = "";
  /** Seats this device has submitted for, so the form doesn't come back for one of them while the
   * status poll is still catching up. Server-side the submission is final regardless. */
  protected locallySubmitted: number[] = [];
  private poller: number | null = null;

  // -------------------------------------------------------------------------
  // Supplied by the subclass
  // -------------------------------------------------------------------------

  /** Which auction this panel is the form for; it renders only during that variant's bid round. */
  get variant(): SealedBidVariant {
    throw new Error("SealedBidPanel subclasses must define `variant`");
  }

  /** The engine command one submission becomes (offline) or is revealed as (hosted). */
  get commandName(): Command {
    throw new Error("SealedBidPanel subclasses must define `commandName`");
  }

  /** Why the current numbers are not a legal submission, or null when they are. The shared rule
   * the engine and the database both enforce, so the submit button can never be enabled for
   * something the server would reject (or disabled for something it would accept). */
  get submissionError(): string | null {
    throw new Error("SealedBidPanel subclasses must define `submissionError`");
  }

  /** What a finished seat's roster row says, e.g. "Split submitted". */
  get submittedStateLabel(): string {
    return "Submitted";
  }

  /** What this device's own finished submission is called, e.g. "Your split is in." */
  get waitingText(): string {
    if (!this.backend && !this.onlineSequential) {
      return "Pass the device to the next player.";
    }
    return this.submittedCount >= this.playerCount
      ? "Everyone has submitted - resolving the auction…"
      : "The auction resolves itself the moment the last submission lands.";
  }

  /**
   * Online play without a sealed backend (boardgamers.space): this device holds exactly one locked
   * seat and a bid is an ordinary move relayed through the platform. The engine collects bids one
   * seat at a time, but the platform's stripSecret masks every submitted bid from the other
   * clients until the reveal - so the round is sequential-but-sealed: you may have to wait for
   * your turn to submit, yet nobody ever sees a value before the auction resolves.
   */
  get onlineSequential(): boolean {
    if (this.backend || this.$store.state.analysisMode) {
      return false;
    }
    const locked = this.$store.state.player?.index;
    return typeof locked === "number" && locked >= 0;
  }

  /** True while this device's seat may not submit yet (online sequential play, not on turn). */
  get waitingForTurn(): boolean {
    return this.onlineSequential && this.seat !== null && this.gameData?.playerToMove !== this.seat;
  }

  /** Small hint under the form while `waitingForTurn` - the inputs stay editable so the bids can
   * be prepared, only the submit waits. */
  get turnHint(): string {
    return this.waitingForTurn
      ? "Waiting for your turn to submit - bids already made stay sealed until everyone has bid."
      : "";
  }

  // -------------------------------------------------------------------------
  // Shared state
  // -------------------------------------------------------------------------

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

  /**
   * The one hosted state this panel steps aside for: a Silent Auction that was already recording
   * its bids as sequential committed moves when the sealed path shipped. Those games finish the
   * way they started, through `Commands.vue`'s old on-turn form - see `isLegacySequentialBidRound`.
   * Never true offline, where a bid is a move by design.
   */
  get legacySequentialRound(): boolean {
    return !!this.backend && isLegacySequentialBidRound(this.gameData);
  }

  /** True while this panel's own variant is in its bid round. */
  get bidding(): boolean {
    return sealedBidPhase(this.gameData)?.variant === this.variant && !this.legacySequentialRound;
  }

  /**
   * Every seat this device may submit for, in the order it should be asked for them.
   *
   * - Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §2.6/decision #7) takes the board over
   *   entirely, same as setup building placement's own pass-and-play - every seat's bid is yours to
   *   enter, regardless of any real locked seat, so this check comes first.
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
    if (this.$store.state.analysisMode) {
      return (this.gameData?.players ?? []).map((_, index: number) => index);
    }
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
   * - `engineSubmittedSeats` is the offline/hot-seat one: there is no server there, so a submitted
   *   set of bids is an ordinary move and the engine itself is the record of who has bid. It stays
   *   empty in hosted play until the reveal, by which point this panel is gone.
   */
  get submittedSeats(): number[] {
    const done = new Set<number>([
      ...(this.status?.submittedSeats ?? []),
      ...this.locallySubmitted,
      ...this.engineSubmittedSeats,
    ]);
    return [...done].sort((a, b) => a - b);
  }

  /** Which seats the ENGINE knows have bid - the offline record. Subclass-specific because each
   * variant keeps its submissions in its own list on the engine. */
  get engineSubmittedSeats(): number[] {
    return [];
  }

  get submittedCount(): number {
    return this.submittedSeats.length;
  }

  /** The seats above that still owe a submission. */
  get pendingSeats(): number[] {
    const done = new Set<number>(this.submittedSeats);
    return this.mySeats.filter((seat) => !done.has(seat));
  }

  /** One row per seat at the table: who has locked their bids in and who has not. */
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
        state: isDone ? this.submittedStateLabel : "Still choosing",
      };
    });
  }

  /** The seat the form is currently for: the next one that still owes a submission. */
  get seat(): number | null {
    return this.pendingSeats.length > 0 ? this.pendingSeats[0] : (this.mySeats[0] ?? null);
  }

  get command() {
    return this.gameData?.availableCommands?.find((c) => c.name === this.commandName) ?? null;
  }

  get factions(): Faction[] {
    return (this.command?.data?.factions ?? this.gameData?.setup ?? []) as Faction[];
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
   * them (a hosted test game, or hot-seat play): it is the only thing saying whose bids these are. */
  get seatSuffix(): string {
    return this.seat === null ? "" : ` — ${this.seatName(this.seat)}`;
  }

  seatName(seat: number): string {
    return this.gameData?.players?.[seat]?.name || `Player ${seat + 1}`;
  }

  get entries(): { faction: string; points: number }[] {
    return this.factions.map((faction) => ({ faction: faction as string, points: Number(this.values[faction]) || 0 }));
  }

  get valid(): boolean {
    return this.submissionError === null;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

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
   * has to start from blank numbers, not the previous player's. */
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

  protected resetValues() {
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
    if (seat === null || !this.valid || this.busy || this.waitingForTurn) {
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
        this.$emit("command", `${this.commandName} ${this.entries.map((e) => `${e.faction} ${e.points}`).join(" ")}`);
        this.resetValues();
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.busy = false;
    }
  }
}
