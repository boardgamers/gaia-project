<template>
  <div
    ref="root"
    :class="['premove-bar', { 'premove-bar--sticky-mobile': stickyMobile }]"
    :style="{ '--premove-bottom-offset': `${bottomOffset}px` }"
  >
    <!-- The sheet's own dark header band, the exact counterpart of Commands.vue's
         `#move-buttons .sticky-bar-title` on-turn bar: same gradient/grab-handle/full-bleed
         treatment, carrying the one line that matters here ("Next: ..." / "Priority 2 will play:
         ...") the way that one carries the on-turn status line. Rendered whenever the bar is in
         off-turn mode but CSS-hidden until the narrow-viewport media query actually pins the bar,
         since the in-flow desktop card is not a bottom sheet and shows `__will-fire` below
         instead - same both-in-the-DOM/CSS-toggled split Commands.vue uses for #move-title. -->
    <div v-if="stickyMobile" class="premove-bar__sheet-title d-flex align-items-center">
      <h5 class="mb-0">{{ sheetTitle }}</h5>
    </div>

    <div v-if="willFireLine" class="premove-bar__will-fire small">{{ willFireLine }}</div>

    <div v-if="rows.length > 0" class="premove-bar__tabs d-flex flex-wrap" role="tablist">
      <button
        v-for="(row, i) in rows"
        :key="row.seq"
        type="button"
        role="tab"
        class="premove-bar__tab"
        :aria-selected="selectedSeq === row.seq"
        :class="{ 'premove-bar__tab--active': selectedSeq === row.seq, 'text-muted': !legalMap[row.seq] }"
        @click="toggleSelected(row.seq)"
      >
        {{ tabLabel(i) }}
      </button>
    </div>

    <div class="premove-bar__actions d-flex align-items-center flex-wrap">
      <button
        type="button"
        class="btn btn-sm btn-secondary premove-bar__action-button mr-2 mb-2"
        :disabled="!canStartNew('sequential')"
        @click="requestStartNew('sequential')"
      >
        + Sequential
      </button>
      <button
        type="button"
        class="btn btn-sm btn-secondary premove-bar__action-button mr-2 mb-2"
        :disabled="!canStartNew('priority')"
        @click="requestStartNew('priority')"
      >
        + Priority
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline-warning premove-bar__action-button mr-2 mb-2"
        @click="$emit('start-cancel-trigger')"
      >
        ⚠ Cancel trigger
      </button>
      <button type="button" class="btn btn-link btn-sm p-0 mb-2 premove-bar__info-link" v-b-modal.premove-info>
        ⓘ How premoves work
      </button>
    </div>

    <div v-if="cancelTriggerRows.length > 0" class="premove-bar__triggers small mt-2">
      <div
        v-for="trigger in cancelTriggerRows"
        :key="trigger.seq"
        class="premove-bar__trigger-row d-flex align-items-center"
      >
        <span class="flex-grow-1">{{ triggerLabel(trigger) }}</span>
        <button
          type="button"
          class="btn btn-link btn-sm p-0 mr-2"
          @click="$emit('start-edit-cancel-trigger', trigger.seq)"
        >
          Edit
        </button>
        <button type="button" class="btn btn-link btn-sm p-0" @click="removeTrigger(trigger.seq)">Remove</button>
      </div>
    </div>

    <div v-if="selectedRow" class="premove-bar__detail small">
      <div class="premove-bar__detail-move">{{ selectedRow.move }}</div>
      <div v-if="!legalMap[selectedRow.seq]" class="text-muted">no longer possible</div>
      <div v-else-if="staleness(selectedRow) > 0" class="text-muted">
        queued {{ staleness(selectedRow) }} move{{ staleness(selectedRow) === 1 ? "" : "s" }} ago
      </div>
      <div v-if="mode === 'sequential' && downstreamCount(selectedRow) > 0" class="text-warning mt-1">
        Editing this will also discard the {{ downstreamCount(selectedRow) }} premove{{
          downstreamCount(selectedRow) === 1 ? "" : "s"
        }}
        queued after it.
      </div>
      <div class="mt-2 premove-bar__detail-actions d-flex flex-wrap">
        <button
          type="button"
          class="btn btn-sm btn-secondary premove-bar__mini-button mr-1 mb-1"
          @click="edit(selectedRow)"
        >
          Edit
        </button>
        <button
          v-if="mode === 'priority' && selectedIndex > 0"
          type="button"
          class="btn btn-sm btn-secondary premove-bar__mini-button mr-1 mb-1"
          title="Move up"
          @click="reorder(selectedRow.seq, 'up')"
        >
          Move up
        </button>
        <button
          v-if="mode === 'priority' && selectedIndex < rows.length - 1"
          type="button"
          class="btn btn-sm btn-secondary premove-bar__mini-button mr-1 mb-1"
          title="Move down"
          @click="reorder(selectedRow.seq, 'down')"
        >
          Move down
        </button>
        <button
          type="button"
          class="btn btn-sm btn-secondary premove-bar__mini-button mr-1 mb-1"
          @click="cancel(selectedRow)"
        >
          Cancel premove
        </button>
      </div>
    </div>

    <div v-if="autoCharge === 'ask' && rows.length > 0" class="text-muted small mt-1">
      A charge decision before your turn will still pause until you're online - enable auto-charge in preferences to
      fully automate.
    </div>

    <!-- Last row of the sheet, same slot and same hairline-divider treatment as the on-turn bar's
         own StickyResourceBar - what you can afford is exactly what a premove has to be planned
         against, and off-turn it is otherwise a scroll away up the page. Hidden outside the
         sticky-sheet layout for the same reason as the header above. -->
    <StickyResourceBar v-if="showResourceBar" :player="myPlayer" class="premove-bar__resource-row" />

    <b-modal id="premove-info" size="lg" title="Premove modes" ok-only>
      <p>
        <b>Sequential</b> is a chain of your next turns: entry 2 is previewed assuming entry 1 already landed, and so
        on. It's throughput - more of your own turns get played while you're away. If an early link breaks (the board
        changed enough that it's no longer legal), everything queued behind it is discarded too, since it was planned
        assuming that link would land. Editing a link has the same effect as breaking it, for the same reason.
      </p>
      <p>
        <b>Priority</b> is up to 3 ranked alternatives for your <i>single</i> upcoming turn. The first one that's still
        legal when your turn arrives is the one that plays; the rest are discarded. It's insurance - useful for "pass
        taking booster A, or B, or C" or any contested claim (federation token, advanced tech, artifact) where you want
        a fallback instead of a single bet. Editing one rank never affects the others.
      </p>
      <p class="text-muted small">
        Neither mode can tell "still legal" from "still a good idea" - Priority only falls through on an
        <i>illegal</i> option, not a merely worse one. Switching between modes clears your current queue, since the two
        interpret the queue differently. A pending charge/leech decision before your turn still needs auto-charge
        enabled to resolve automatically while you're offline.
      </p>
      <p>
        <b>Cancel triggers.</b> A trigger watches one opponent and, if they do the thing you picked, clears your whole
        premove queue - it never plays anything, it only cancels. You can arm as many as you like, on different
        opponents; any one of them firing clears everything, including your other triggers.
      </p>
      <p>
        Triggers match on <b>what happened, not how</b>. Power burns and free-action conversions are ignored, so "spend
        2 power, then build a mine at 3A4" matches a plain "build a mine at 3A4". More usefully:
        <b
          >"advances Economy" fires whether they got that step from a tech tile, a research power action, or a faction's
          own special action</b
        >
        - the route doesn't matter, the result does. If you want the narrow version, watch "takes the tech tile at eco"
        instead.
      </p>
      <p class="text-muted small">
        You can also cancel on a <b>power charge</b> instead of on an opponent's move - useful because leeching changes
        your power bowls and costs VP, which is exactly the kind of "still legal, but I'd play something else now" shift
        a premove can't notice on its own. Pick whether it counts offers you turned down, and a minimum size - charging
        N power costs N-1 VP, so 2 is the first one that costs you anything. Only moves made after you arm a trigger
        count.
      </p>
    </b-modal>
  </div>
</template>

<script lang="ts">
import Engine, { Player, PlayerEnum } from "@gaia-project/engine";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { factionName } from "../data/factions";
import { researchData } from "../data/research";
import {
  CancelTriggerLeechConfig,
  CancelTriggerRow,
  PremoveFailureRow,
  PremoveMode,
  PremoveRow,
} from "../hosted/types";
import { buildSequentialChainPreview } from "../logic/premove-preview";
import { zoomCompensationTransform } from "../logic/zoom-compensation";
import StickyResourceBar from "./StickyResourceBar.vue";

/** Present-tense text for one armed atom, for the armed-triggers list (§8.5) - a present-tense
 * cousin of host.ts's own past-tense describeMatchedAtom (that one narrates something that already
 * happened; this one describes what's still being watched for). */
function describeAtomPresent(atom: string): string {
  const [command, ...rest] = atom.split(":");
  const trackName = (code: string) => researchData[code as never]?.name ?? code;
  switch (command) {
    case "build":
      return rest[1] === "*" ? `builds ${rest[0]} anywhere` : `builds ${rest[0]} at ${rest[1]}`;
    case "up":
      return rest[0] === "*" ? "advances research" : `advances ${trackName(rest[0])}`;
    case "tech":
      return rest[0] === "*" ? "takes any tech tile" : `takes the tech tile at ${trackName(rest[0])}`;
    case "action":
      return rest[0] === "*" ? "takes a board action" : `takes board action ${rest[0]}`;
    case "special":
      return "uses a special action";
    case "pass":
      return rest[0] === "*" ? "passes" : `passes, taking booster ${rest[0]}`;
    case "federation":
      return "forms a federation";
    default:
      return atom;
  }
}

@Component({ components: { StickyResourceBar } })
export default class PremoveBar extends Vue {
  @Prop()
  seat: number;

  @Prop()
  composeModePreference: PremoveMode;

  @Prop({ default: false })
  stickyMobile: boolean;

  @Prop({ default: 0 })
  bottomOffset: number;

  private selectedSeq: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private visualViewportListener: (() => void) | null = null;
  private zoomTransformUpdater: (() => void) | null = null;

  get engine(): Engine {
    return this.$store.state.data;
  }

  get autoCharge(): string {
    return this.$store.state.preferences.autoChargePower as string;
  }

  get rows(): PremoveRow[] {
    return ((this.$store.state.premoves as PremoveRow[]) ?? [])
      .filter((p) => p.seat === this.seat)
      .sort((a, b) => a.seq - b.seq);
  }

  get mode(): PremoveMode {
    return this.rows.length > 0 ? this.rows[0].mode : this.composeModePreference;
  }

  get cancelTriggerRows(): CancelTriggerRow[] {
    return ((this.$store.state.cancelTriggers as CancelTriggerRow[]) ?? [])
      .filter((t) => t.seat === this.seat)
      .sort((a, b) => a.seq - b.seq);
  }

  triggerLabel(trigger: CancelTriggerRow): string {
    if (trigger.kind === "leech") {
      const config = trigger.config as CancelTriggerLeechConfig;
      return `⚡ Power charge ≥ ${config.minPower} ${config.mode === "offered" ? "offered to me" : "taken by me"}`;
    }
    const faction = this.engine.players[trigger.watched_seat]?.faction;
    const label = faction ? factionName(faction) : "Opponent";
    return `⚠ ${label} ${trigger.atoms.map(describeAtomPresent).join(" or ")}`;
  }

  removeTrigger(seq: number) {
    this.$store.dispatch("disarmCancelTrigger", { seat: this.seat, seq });
  }

  /** §8.5 - the most recent "cancelled" notice for this seat, if any (already in chronological
   * order - fetchPremoveFailures orders by created_at). Drives the fired-state header override. */
  get cancelledNotice(): PremoveFailureRow | null {
    const notices = ((this.$store.state.premoveFailures as PremoveFailureRow[]) ?? []).filter(
      (f) => f.seat === this.seat && f.kind === "cancelled"
    );
    return notices.length > 0 ? notices[notices.length - 1] : null;
  }

  get selectedRow(): PremoveRow | null {
    return this.rows.find((r) => r.seq === this.selectedSeq) ?? null;
  }

  get selectedIndex(): number {
    return this.rows.findIndex((r) => r.seq === this.selectedSeq);
  }

  tabLabel(index: number): string {
    return `${this.mode === "sequential" ? "Premove" : "Priority"} ${index + 1}`;
  }

  toggleSelected(seq: number) {
    this.selectedSeq = this.selectedSeq === seq ? null : seq;
  }

  downstreamCount(row: PremoveRow): number {
    return this.rows.filter((r) => r.seq > row.seq).length;
  }

  get committedMoveCount(): number {
    return this.engine.moveHistory.length - 1;
  }

  staleness(row: PremoveRow): number {
    return this.committedMoveCount - row.queued_move_count;
  }

  private isLegal(base: Engine, move: string): boolean {
    const clone = Engine.fromData(JSON.parse(JSON.stringify(base)));
    // Move phase forced as well as the seat (see Engine.forcePremovePreviewTurn): in Priority mode
    // `base` is the live engine, which may currently be sitting in RoundLeech/RoundIncome waiting on
    // somebody's decision - every queued row would read as "no longer possible" there otherwise.
    clone.forcePremovePreviewTurn(this.seat as PlayerEnum);
    clone.generateAvailableCommands();
    try {
      clone.move(move);
      clone.generateAvailableCommandsIfNeeded();
      return clone.newTurn;
    } catch {
      return false;
    }
  }

  get legalMap(): Record<number, boolean> {
    const result: Record<number, boolean> = {};
    if (this.rows.length === 0) {
      return result;
    }
    if (this.mode === "priority") {
      // Every rank previews against the SAME fresh current state (§10.1) - independent of each other.
      for (const row of this.rows) {
        result[row.seq] = this.isLegal(this.engine, row.move);
      }
      return result;
    }
    // Sequential: each entry previews against a clone with every earlier entry already applied; a
    // broken link makes everything behind it moot too (mirrors the resolver's own cascade, §10.5).
    let priorMoves: string[] = [];
    let broken = false;
    for (const row of this.rows) {
      if (broken) {
        result[row.seq] = false;
        continue;
      }
      const clone = buildSequentialChainPreview(this.engine, this.seat, priorMoves);
      const ok = this.isLegal(clone, row.move);
      result[row.seq] = ok;
      if (ok) {
        priorMoves = [...priorMoves, row.move];
      } else {
        broken = true;
      }
    }
    return result;
  }

  get willFireLine(): string | null {
    if (this.rows.length === 0 || this.engine.playerToMove === this.seat) {
      return null;
    }
    if (this.mode === "sequential") {
      return this.legalMap[this.rows[0].seq] ? `Next: ${this.rows[0].move}` : null;
    }
    const map = this.legalMap;
    const firstLegalIndex = this.rows.findIndex((r) => map[r.seq]);
    if (firstLegalIndex === -1) {
      return null;
    }
    return `Priority ${firstLegalIndex + 1} will play: ${this.rows[firstLegalIndex].move}`;
  }

  /** The header band's single line, ranked by what the player most needs to read at a glance: a
   * just-fired cancel trigger (§8.5) > what is about to play > what is queued but stuck > an
   * invitation to queue something. */
  get sheetTitle(): string {
    if (this.cancelledNotice) {
      return `Cancelled — ${this.cancelledNotice.reason}`;
    }
    if (this.rows.length === 0) {
      return "Plan your next turn";
    }
    return this.willFireLine ?? `${this.rows.length} queued - none can play right now`;
  }

  /** The seat this bar belongs to, guarded: `seat` can be undefined (nobody locked to a seat) and
   * the spec mounts this component against an engine with no players at all. */
  get myPlayer(): Player | null {
    return this.engine.players?.[this.seat] ?? null;
  }

  get showResourceBar(): boolean {
    return this.stickyMobile && !!this.myPlayer?.faction;
  }

  canStartNew(candidateMode: PremoveMode): boolean {
    if (this.rows.length === 0) {
      return true;
    }
    if (this.mode === candidateMode) {
      return this.rows.length < 3;
    }
    // A different mode is always startable - switching clears the existing queue first (with a
    // confirm), same invariant as before this redesign.
    return true;
  }

  requestStartNew(mode: PremoveMode) {
    if (this.rows.length > 0 && this.mode !== mode) {
      if (
        typeof window !== "undefined" &&
        !window.confirm(`Switching to ${mode} mode clears your current queue. Continue?`)
      ) {
        return;
      }
      this.$store.dispatch("cancelAllPremoves", { seat: this.seat });
      this.$emit("mode-preference", mode);
      // The switch (cancelAllPremoves) is async and may not have landed in the store yet - tell
      // the parent this is a fresh start regardless, so it doesn't compose against a queue that's
      // about to disappear.
      this.$emit("start-new", { mode, switchingModes: true });
      this.selectedSeq = null;
      return;
    }
    this.$emit("mode-preference", mode);
    this.$emit("start-new", { mode, switchingModes: false });
  }

  edit(row: PremoveRow) {
    this.$emit("start-edit", row.seq);
  }

  cancel(row: PremoveRow) {
    // §10.6: cascade in Sequential (everything behind a cancelled entry was previewed assuming it
    // landed), single-row in Priority (each rank is independent).
    const toCancel = this.mode === "sequential" ? this.rows.filter((r) => r.seq >= row.seq) : [row];
    for (const r of toCancel) {
      this.$store.dispatch("cancelPremove", { seat: this.seat, seq: r.seq });
    }
    if (this.selectedSeq !== null && toCancel.some((r) => r.seq === this.selectedSeq)) {
      this.selectedSeq = null;
    }
  }

  reorder(seq: number, direction: "up" | "down") {
    this.$store.dispatch("reorderPremove", { seat: this.seat, seq, direction });
  }

  mounted() {
    const root = this.$refs.root as HTMLElement;

    // Use the exact same compensation rule as Commands.vue's on-turn bar. Keeping a second copy of
    // the scale/offset checks here left this off-turn bar on the old exact `scale === 1` path after
    // Commands switched to a tolerance, so a tiny post-pinch scale residue could keep translating
    // this fixed bar during ordinary scrolling until the app was hard-refreshed.
    const vv = window.visualViewport;
    const updateZoomTransform = () => {
      if (!root || !vv) {
        return;
      }
      root.style.transform = zoomCompensationTransform({
        isStickyMobile: this.stickyMobile,
        scale: vv.scale || 1,
        offsetLeft: vv.offsetLeft,
        offsetTop: vv.offsetTop,
        height: vv.height,
        innerHeight: window.innerHeight,
      });
    };
    this.zoomTransformUpdater = updateZoomTransform;

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.emitBarHeight();
        updateZoomTransform();
      });
      this.resizeObserver.observe(root);
    }
    this.emitBarHeight();

    if (root && vv) {
      updateZoomTransform();
      vv.addEventListener("resize", updateZoomTransform);
      vv.addEventListener("scroll", updateZoomTransform);
      this.visualViewportListener = () => {
        vv.removeEventListener("resize", updateZoomTransform);
        vv.removeEventListener("scroll", updateZoomTransform);
        root.style.transform = "";
      };
    }
  }

  @Watch("stickyMobile")
  onStickyMobileChanged() {
    this.zoomTransformUpdater?.();
  }

  beforeDestroy() {
    this.resizeObserver?.disconnect();
    this.visualViewportListener?.();
    this.$emit("bar-height", 0);
  }

  @Watch("stickyMobile")
  @Watch("bottomOffset")
  onLayoutChanged() {
    this.$nextTick(() => this.emitBarHeight());
  }

  private emitBarHeight() {
    const root = this.$refs.root as HTMLElement | undefined;
    this.$emit("bar-height", this.stickyMobile && root ? root.getBoundingClientRect().height : 0);
  }
}
</script>

<style lang="scss">
.premove-bar {
  border: 1px solid var(--ui-border);
  border-radius: 0.9rem;
  padding: 0.7rem 0.7rem 0.6rem;
  background: linear-gradient(180deg, var(--ui-panel-gradient-start) 0%, var(--ui-panel-gradient-end) 100%);
  box-shadow: 0 8px 24px var(--ui-shadow), 0 1px 2px var(--ui-shadow-soft);

  &__will-fire {
    margin-bottom: 0.35rem;
    font-weight: 600;
    color: var(--ui-secondary-text);
  }

  // Both of these belong to the bottom-sheet layout only - the in-flow desktop card is an ordinary
  // panel, where a full-bleed dark banner and a duplicate resource strip would both be wrong. They
  // need !important to be hidden: each element also carries Bootstrap's .d-flex utility ("display:
  // flex !important"), which would otherwise win outright - the same footgun Commands.vue documents
  // on its own .sticky-bar-title/#move-title pair.
  &__sheet-title,
  &__resource-row {
    display: none !important;
  }

  &__tabs {
    margin: -1.2rem 0 0.55rem;
    gap: 0.3rem;
    padding-left: 0.15rem;
  }

  &__tab {
    border: 1px solid var(--ui-border);
    border-bottom: 0;
    background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
    color: var(--ui-text-muted);
    border-radius: 14px 14px 0 0;
    padding: 0.28rem 0.8rem 0.32rem;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 -1px 0 var(--ui-divider-highlight), 0 8px 18px var(--ui-shadow-soft);

    &--active {
      background: var(--ui-banner-start);
      color: var(--ui-banner-text);
      border-color: var(--ui-banner-start);
    }
  }

  &__detail {
    margin-top: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: var(--ui-surface);
    border: 1px solid var(--ui-border);
    border-radius: 0.4rem;
  }

  &__detail-move {
    font-weight: 600;
  }

  &__detail-actions {
    gap: 0.15rem;
  }

  &__triggers {
    border-top: 1px solid var(--ui-border);
    padding-top: 0.4rem;
  }

  &__trigger-row {
    padding: 0.15rem 0;
    gap: 0.3rem;
  }
}

@media (max-width: 767px) {
  // Matches Commands.vue's `#move-buttons.mobile-sticky-actions` bar exactly (same position/
  // z-index/border/shadow) so the off-turn sticky bar is visually identical to the on-turn one,
  // not just similar - including a fully borderless edge (no leftover top hairline from the
  // in-flow `.premove-bar` card rule above).
  .premove-bar--sticky-mobile {
    position: fixed;
    left: 0;
    right: 0;
    bottom: var(--premove-bottom-offset, 0px);
    z-index: 1030;
    // Same cap as Commands.vue's $mobile-sticky-actions-max-height, so a long premove list and a
    // long move-button list stop growing at the same point instead of two different ones.
    max-height: 40vh;
    overflow-y: auto;
    margin: 0;
    // Anchors the JS counter-transform (the visualViewport listener in mounted() below, shared with
    // Commands.vue through zoomCompensationTransform) at the corner this bar is actually positioned
    // from - without it the browser scales/translates about the element's centre and a pinch-zoom
    // walks the bar off the bottom edge. Commands.vue sets the identical origin on its own bar.
    transform-origin: left bottom;
    padding: 0.7rem calc(0.5rem + env(safe-area-inset-right)) calc(0.45rem + env(safe-area-inset-bottom) + 8px)
      calc(0.5rem + env(safe-area-inset-left));
    border-radius: 16px 16px 0 0;
    border: 0;
    background: linear-gradient(180deg, var(--ui-panel-gradient-start) 0%, var(--ui-panel-gradient-end) 100%);
    box-shadow: 0 -12px 28px var(--ui-shadow), 0 -1px 0 var(--ui-divider-highlight);

    // The sheet header, byte-for-byte the geometry of Commands.vue's `.sticky-bar-title`: full-bleed
    // to the sheet's rounded top corners (negative margins cancelling this container's own padding,
    // including the safe-area insets), pulled up over the padding that leaves room for the grab
    // handle it draws at its own top edge.
    .premove-bar__sheet-title {
      display: flex !important;
      position: relative;
      margin: calc(-0.7rem) calc(-0.5rem - env(safe-area-inset-right)) 0.4rem calc(-0.5rem - env(safe-area-inset-left));
      padding: 0.65rem calc(0.7rem + env(safe-area-inset-right)) 0.35rem calc(0.7rem + env(safe-area-inset-left));
      border-radius: 16px 16px 0 0;
      background: linear-gradient(135deg, var(--ui-banner-start) 0%, var(--ui-banner-end) 100%);
      color: var(--ui-banner-text);

      &::before {
        content: "";
        position: absolute;
        top: 0.35rem;
        left: 50%;
        transform: translateX(-50%);
        width: 32px;
        height: 4px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.28);
      }

      h5 {
        font-size: 0.85rem;
        font-weight: 600;
        line-height: 1.2;
        color: inherit;
        // The move text in "Next: terrans build m -1x2" is arbitrarily long; ellipsize rather than
        // let it wrap the header to three lines, which is exactly the height problem the on-turn
        // bar's own 0.85rem h5 was introduced to solve. The full text stays readable in the tab
        // detail below.
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    // Already said by the header band above - showing it twice is what Commands.vue avoids with
    // #move-title.hide-on-mobile-sticky, same idea from the other side.
    .premove-bar__will-fire {
      display: none;
    }

    // The tabs sit as "folder tabs" straddling the in-flow card's top edge (hence the negative
    // margin in the base rule). Inside the sheet that edge is the header band, so they hang below
    // it normally instead of being pulled up into it.
    .premove-bar__tabs {
      margin-top: 0;
    }

    // Same slot, divider and spacing the on-turn bar gives its own resource strip.
    .premove-bar__resource-row {
      display: flex !important;
      margin-top: 0.35rem;
      padding-top: 0.3rem;
      border-top: 1px solid var(--ui-border);
    }

    // Same "keycap" treatment Commands.vue applies to its own move buttons, scoped to this same
    // sticky-bar context only (so the desktop/in-flow premove card keeps plain Bootstrap buttons,
    // matching how normal move buttons look outside the sticky bar too).
    .premove-bar__action-button,
    .premove-bar__mini-button {
      border-radius: 10px;
      border-color: var(--ui-border-strong);
      box-shadow: 0 1px 2px var(--ui-shadow-soft);
      background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
      color: var(--ui-secondary-text);
      transition: transform 0.08s ease-out, box-shadow 0.08s ease-out;

      &:active {
        transform: scale(0.97);
        box-shadow: inset 0 1px 2px var(--ui-shadow);
      }
    }
  }
}
</style>
