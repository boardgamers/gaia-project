<template>
  <div
    ref="root"
    :class="['premove-bar', { 'premove-bar--sticky-mobile': stickyMobile }]"
    :style="{ '--premove-bottom-offset': `${bottomOffset}px` }"
  >
    <!-- The sheet's own dark header band, the exact counterpart of Commands.vue's
         `#move-buttons .sticky-bar-title` on-turn bar: same gradient/grab-handle/full-bleed
         treatment. It carries the single line that matters for whatever step the sheet is showing -
         what will play, what is being armed, what just got cancelled - so the answer is always in
         the same place. Rendered whenever the bar is in off-turn mode but CSS-hidden until the
         narrow-viewport media query actually pins the bar, since the in-flow desktop card is not a
         bottom sheet and shows `__inline-title` below instead - the same both-in-the-DOM/CSS-toggled
         split Commands.vue uses for #move-title. -->
    <div v-if="stickyMobile" :class="['premove-bar__sheet-title', 'd-flex', 'align-items-center', bandVariantClass]">
      <h5 class="mb-0">{{ bandTitle }}</h5>
    </div>

    <div v-if="bandTitle" :class="['premove-bar__inline-title', 'small', bandVariantClass]">{{ bandTitle }}</div>

    <div class="premove-bar__body">
      <!-- ============================ cancel-trigger steps ============================
           These three used to be a `b-modal` in Game.vue, which threw the player from the bottom of
           the screen to the middle of it and back again in the middle of one task. They are steps of
           the same sheet now: the band above names the step, the footer below confirms it, and the
           body just swaps. -->
      <CancelTriggerPicker
        v-if="stage === 'picker'"
        :seat="seat"
        @pick-opponent="$emit('pick-opponent', $event)"
        @pick-leech="$emit('pick-leech')"
      />
      <CancelTriggerLeechConfig
        v-else-if="stage === 'leech'"
        :seat="seat"
        :initial-config="editingLeechConfig"
        @input="leechDraft = $event"
      />
      <CancelTriggerRefine
        v-else-if="stage === 'refine'"
        :move="draftMove"
        :watched-seat="watchedSeat"
        :initial-atoms="editingAtoms"
        @input="refineDraft = $event"
      />

      <!-- ================================ idle / queue ================================ -->
      <template v-else>
        <!-- What happened while you were away. These used to render as `alert`s in Game.vue's
             in-flow commands column - i.e. somewhere up the page, above a sheet pinned to the bottom
             of the screen, which is the one place they were guaranteed not to be read. -->
        <div v-if="editCascadeNotice !== null" class="premove-bar__notice">
          <span class="flex-grow-1"
            >Premove updated — {{ editCascadeNotice }} queued move{{ editCascadeNotice === 1 ? "" : "s" }} after it
            {{ editCascadeNotice === 1 ? "was" : "were" }} discarded, since
            {{ editCascadeNotice === 1 ? "it" : "they" }} depended on it.</span
          >
          <button type="button" class="premove-bar__notice-x" @click="$emit('dismiss-cascade')">✕</button>
        </div>
        <div
          v-for="failure in unreadFailures"
          :key="failure.id"
          :class="[
            'premove-bar__notice',
            failure.kind === 'cancelled' ? 'premove-bar__notice--stop' : 'premove-bar__notice--warn',
          ]"
        >
          <span class="flex-grow-1">
            <template v-if="failure.kind === 'cancelled'">Queue cancelled — {{ failure.reason }}</template>
            <template v-else>Couldn't play your premove — {{ failure.reason }}</template>
          </span>
          <button type="button" class="premove-bar__notice-x" @click="markFailureRead(failure.id)">✕</button>
        </div>
        <div v-if="playedNotice" class="premove-bar__notice premove-bar__notice--ok">
          <span class="flex-grow-1">Played for you{{ playedNoticeSuffix }} — {{ playedNotice.move }}</span>
          <button type="button" class="premove-bar__notice-x" @click="dismissPlayedNotice">✕</button>
        </div>

        <!-- Mode is a labelled two-way choice with its own plain-language line, not two "+" buttons
             that each also silently rewrite a queue-wide setting. -->
        <div class="premove-bar__mode">
          <div class="premove-bar__segment" role="radiogroup" aria-label="Premove mode">
            <button
              v-for="option in modeOptions"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="mode === option.value"
              :class="['premove-bar__segment-option', { 'premove-bar__segment-option--on': mode === option.value }]"
              @click="requestMode(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <button type="button" class="premove-bar__info-link" v-b-modal.premove-info title="How premoves work">
            ⓘ
          </button>
        </div>
        <div class="premove-bar__mode-hint">{{ modeHint }}</div>

        <!-- Switching modes discards the queue, so it asks first - inline, in the sheet, instead of
             a raw window.confirm that ignores every visual convention around it. -->
        <div v-if="pendingModeSwitch" class="premove-bar__notice premove-bar__notice--warn premove-bar__confirm">
          <span class="flex-grow-1"
            >Switching to {{ modeLabel(pendingModeSwitch) }} discards your {{ rows.length }} queued move{{
              rows.length === 1 ? "" : "s"
            }}.</span
          >
          <button type="button" class="btn btn-sm premove-bar__mini-button mr-1" @click="confirmModeSwitch">
            Switch
          </button>
          <button type="button" class="btn btn-sm premove-bar__mini-button" @click="pendingModeSwitch = null">
            Keep
          </button>
        </div>

        <div v-if="rows.length === 0" class="premove-bar__empty">
          Queued moves play by themselves when your turn comes, even with the app closed. If the board changed and the
          move is no longer legal, it's skipped and you get a notice here.
        </div>

        <!-- Every entry readable at once, each carrying its own move text and its own live legality.
             This replaces a tab strip whose labels ("Premove 2") held no information and which showed
             one entry at a time out of a maximum of three. -->
        <div v-else class="premove-bar__list">
          <div
            v-for="(row, i) in rows"
            :key="row.seq"
            :class="['premove-bar__entry', entryClass(row, i), { 'premove-bar__entry--open': selectedSeq === row.seq }]"
          >
            <button type="button" class="premove-bar__entry-head" @click="toggleSelected(row.seq)">
              <span class="premove-bar__entry-idx">{{ i + 1 }}</span>
              <span class="premove-bar__entry-move">{{ row.move }}</span>
              <span :class="['premove-bar__entry-state', `premove-bar__entry-state--${entryState(row, i)}`]">{{
                entryStateLabel(row, i)
              }}</span>
            </button>
            <div v-if="selectedSeq === row.seq" class="premove-bar__entry-detail">
              <div v-if="staleness(row) > 0" class="premove-bar__entry-note">
                Queued {{ staleness(row) }} move{{ staleness(row) === 1 ? "" : "s" }} ago.
              </div>
              <div class="premove-bar__entry-actions d-flex flex-wrap">
                <button type="button" class="btn btn-sm premove-bar__mini-button" @click="edit(row)">Edit</button>
                <button
                  v-if="mode === 'priority' && i > 0"
                  type="button"
                  class="btn btn-sm premove-bar__mini-button"
                  title="Move up"
                  @click="reorder(row.seq, 'up')"
                >
                  ↑
                </button>
                <button
                  v-if="mode === 'priority' && i < rows.length - 1"
                  type="button"
                  class="btn btn-sm premove-bar__mini-button"
                  title="Move down"
                  @click="reorder(row.seq, 'down')"
                >
                  ↓
                </button>
                <button type="button" class="btn btn-sm premove-bar__mini-button" @click="cancel(row)">Remove</button>
              </div>
              <!-- The cascade warning belongs on the row that causes it, at the moment it becomes
                   true - not as a paragraph in a detail pane somewhere else. -->
              <div v-if="mode === 'sequential' && downstreamCount(row) > 0" class="premove-bar__entry-note">
                Editing or removing this also drops the {{ downstreamCount(row) }} entr{{
                  downstreamCount(row) === 1 ? "y" : "ies"
                }}
                after it.
              </div>
            </div>
          </div>
        </div>

        <div class="premove-bar__actions d-flex align-items-center">
          <button
            type="button"
            class="btn btn-sm premove-bar__action-button premove-bar__action-button--primary flex-grow-1"
            :disabled="rows.length >= 3"
            @click="$emit('start-new', { mode, switchingModes: false })"
          >
            + Add move
          </button>
          <button
            type="button"
            class="btn btn-sm premove-bar__action-button premove-bar__action-button--amber"
            @click="$emit('start-cancel-trigger')"
          >
            ⚠ Cancel if…<span v-if="cancelTriggerRows.length > 0"> {{ cancelTriggerRows.length }}</span>
          </button>
        </div>

        <div v-if="cancelTriggerRows.length > 0" class="premove-bar__triggers">
          <button type="button" class="premove-bar__fold" @click="triggersOpen = !triggersOpen">
            <span class="flex-grow-1"
              >⚠ {{ cancelTriggerRows.length }} rule{{ cancelTriggerRows.length === 1 ? "" : "s" }} armed</span
            >
            <span>{{ triggersOpen ? "▴" : "▾" }}</span>
          </button>
          <div v-if="triggersOpen">
            <div v-for="trigger in cancelTriggerRows" :key="trigger.seq" class="premove-bar__trigger-row d-flex">
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
        </div>

        <div v-if="autoCharge === 'ask' && rows.length > 0" class="premove-bar__mode-hint">
          A charge decision before your turn still pauses until you're online — enable auto-charge in preferences to
          fully automate.
        </div>
      </template>
    </div>

    <!-- One primary action and one escape, always in the same spot, so the flow confirms from a
         single place no matter which step it is on. -->
    <div v-if="stage !== null" class="premove-bar__foot d-flex align-items-center">
      <button
        v-if="stage !== 'picker'"
        type="button"
        class="btn btn-sm premove-bar__action-button premove-bar__action-button--primary flex-grow-1"
        :disabled="!canArm"
        @click="arm"
      >
        Arm rule
      </button>
      <button
        type="button"
        class="btn btn-sm premove-bar__action-button"
        :class="{ 'flex-grow-1': stage === 'picker' }"
        @click="$emit('close-cancel-trigger')"
      >
        Back
      </button>
    </div>

    <!-- Last row of the sheet, same slot and same hairline-divider treatment as the on-turn bar's
         own StickyResourceBar - what you can afford is exactly what a premove has to be planned
         against, and off-turn it is otherwise a scroll away up the page. Hidden outside the
         sticky-sheet layout for the same reason as the header above. -->
    <StickyResourceBar v-if="showResourceBar" :player="myPlayer" class="premove-bar__resource-row" />

    <b-modal id="premove-info" size="lg" title="Premove modes" ok-only>
      <p>
        <b>Chain</b> queues your next turns in order: entry 2 is previewed assuming entry 1 already landed, and so on.
        It's throughput — more of your own turns get played while you're away. If an early link breaks (the board
        changed enough that it's no longer legal), everything queued behind it is discarded too, since it was planned
        assuming that link would land. Editing a link has the same effect as breaking it, for the same reason.
      </p>
      <p>
        <b>Fallback</b> is up to 3 ranked alternatives for your <i>single</i> upcoming turn. The first one that's still
        legal when your turn arrives is the one that plays; the rest are discarded. It's insurance — useful for "pass
        taking booster A, or B, or C" or any contested claim (federation token, advanced tech, artifact) where you want
        a fallback instead of a single bet. Editing one rank never affects the others.
      </p>
      <p class="text-muted small">
        Neither mode can tell "still legal" from "still a good idea" — Fallback only falls through on an
        <i>illegal</i> option, not a merely worse one. Switching between modes clears your current queue, since the two
        interpret the queue differently. A pending charge/leech decision before your turn still needs auto-charge
        enabled to resolve automatically while you're offline.
      </p>
      <p>
        <b>Cancel rules.</b> A rule watches one opponent and, if they do the thing you picked, clears your whole premove
        queue — it never plays anything, it only cancels. You can arm as many as you like, on different opponents; any
        one of them firing clears everything, including your other rules.
      </p>
      <p>
        Rules match on <b>what happened, not how</b>. Power burns and free-action conversions are ignored, so "spend 2
        power, then build a mine at 3A4" matches a plain "build a mine at 3A4". More usefully:
        <b
          >"advances Economy" fires whether they got that step from a tech tile, a research power action, or a faction's
          own special action</b
        >
        — the route doesn't matter, the result does. If you want the narrow version, watch "takes the tech tile at eco"
        instead.
      </p>
      <p class="text-muted small">
        You can also cancel on a <b>power charge</b> instead of on an opponent's move — useful because leeching changes
        your power bowls and costs VP, which is exactly the kind of "still legal, but I'd play something else now" shift
        a premove can't notice on its own. Pick whether it counts offers you turned down, and a minimum size — charging
        N power costs N-1 VP, so 2 is the first one that costs you anything. Only moves made after you arm a rule count.
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
  CancelTriggerLeechConfig as CancelTriggerLeechConfigType,
  CancelTriggerRow,
  PremoveFailureRow,
  PremoveMode,
  PremoveRow,
} from "../hosted/types";
import { buildSequentialChainPreview } from "../logic/premove-preview";
import { zoomCompensationTransform } from "../logic/zoom-compensation";
import CancelTriggerLeechConfig from "./CancelTriggerLeechConfig.vue";
import CancelTriggerPicker from "./CancelTriggerPicker.vue";
import CancelTriggerRefine from "./CancelTriggerRefine.vue";
import StickyResourceBar from "./StickyResourceBar.vue";

export type CancelTriggerStage = "picker" | "leech" | "refine" | null;

/** Present-tense text for one armed atom, for the armed-rules list (§8.5) - a present-tense
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

/**
 * The premove sheet: the ONE surface the whole premove flow lives on.
 *
 * Before this pass the flow was spread over four of them - this bar, a `b-modal` for the
 * cancel-trigger steps, an `alert` banner at the top of Game.vue's commands column, and
 * Commands.vue's own sticky bar for the confirm buttons - so a single task walked the player from
 * the bottom of the screen to the middle, to the top, and back to the bottom. Everything that isn't
 * the on-turn move buttons now renders here, in a fixed anatomy: header band (what's happening),
 * body (the only part that swaps), footer (one primary action, one escape), resource strip.
 */
@Component({
  components: { CancelTriggerLeechConfig, CancelTriggerPicker, CancelTriggerRefine, StickyResourceBar },
})
export default class PremoveBar extends Vue {
  @Prop()
  seat: number;

  @Prop()
  composeModePreference: PremoveMode;

  @Prop({ default: false })
  stickyMobile: boolean;

  @Prop({ default: 0 })
  bottomOffset: number;

  /** Which cancel-trigger step the sheet is showing, or null for the ordinary queue view. Owned by
   * Game.vue (it also drives the board takeover between the picker and refine steps). */
  @Prop({ default: null })
  stage: CancelTriggerStage;

  @Prop({ default: null })
  watchedSeat: number | null;

  @Prop({ default: "" })
  draftMove: string;

  @Prop({ default: () => [] })
  editingAtoms: string[];

  @Prop({ default: null })
  editingLeechConfig: CancelTriggerLeechConfigType | null;

  @Prop({ default: null })
  editCascadeNotice: number | null;

  private selectedSeq: number | null = null;
  // Open by default: an armed rule silently wipes the whole queue when it fires, so "I forgot one
  // was armed" is a worse outcome than a slightly taller sheet. Collapsible for when it isn't.
  private triggersOpen = true;
  private pendingModeSwitch: PremoveMode | null = null;
  private refineDraft: string[] = [];
  private leechDraft: CancelTriggerLeechConfigType | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private visualViewportListener: (() => void) | null = null;
  private zoomTransformUpdater: (() => void) | null = null;

  readonly modeOptions: { value: PremoveMode; label: string }[] = [
    { value: "sequential", label: "Chain" },
    { value: "priority", label: "Fallback" },
  ];

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

  modeLabel(mode: PremoveMode): string {
    return this.modeOptions.find((o) => o.value === mode)?.label ?? mode;
  }

  get modeHint(): string {
    return this.mode === "sequential"
      ? "Plays several of your turns in a row."
      : "Ranked alternatives for one turn — the first still legal plays.";
  }

  get cancelTriggerRows(): CancelTriggerRow[] {
    return ((this.$store.state.cancelTriggers as CancelTriggerRow[]) ?? [])
      .filter((t) => t.seat === this.seat)
      .sort((a, b) => a.seq - b.seq);
  }

  triggerLabel(trigger: CancelTriggerRow): string {
    if (trigger.kind === "leech") {
      const config = trigger.config as CancelTriggerLeechConfigType;
      return `⚡ Power charge ≥ ${config.minPower} ${config.mode === "offered" ? "offered to me" : "taken by me"}`;
    }
    const faction = this.engine.players[trigger.watched_seat]?.faction;
    const label = faction ? factionName(faction) : "Opponent";
    return `⚠ ${label} ${trigger.atoms.map(describeAtomPresent).join(" or ")}`;
  }

  removeTrigger(seq: number) {
    this.$store.dispatch("disarmCancelTrigger", { seat: this.seat, seq });
  }

  // ---------------------------------------------------------------------------
  // Notices - all of them, in the sheet (they used to render up the page)
  // ---------------------------------------------------------------------------

  get unreadFailures(): PremoveFailureRow[] {
    return ((this.$store.state.premoveFailures as PremoveFailureRow[]) ?? []).filter((f) => f.seat === this.seat);
  }

  markFailureRead(id: string) {
    this.$store.dispatch("markPremoveFailureRead", id);
  }

  get playedNotice(): { seat: number; move: string; rank?: number; totalRanks?: number } | null {
    return this.$store.state.premovePlayedNotice ?? null;
  }

  get playedNoticeSuffix(): string {
    const notice = this.playedNotice;
    return notice?.rank && notice.totalRanks && notice.totalRanks > 1
      ? ` (fallback ${notice.rank} of ${notice.totalRanks})`
      : "";
  }

  dismissPlayedNotice() {
    this.$store.commit("dismissPremovePlayedNotice");
  }

  /** §8.5 - the most recent "cancelled" notice for this seat, if any (already in chronological
   * order - fetchPremoveFailures orders by created_at). Drives the fired-state header override. */
  get cancelledNotice(): PremoveFailureRow | null {
    const notices = this.unreadFailures.filter((f) => f.kind === "cancelled");
    return notices.length > 0 ? notices[notices.length - 1] : null;
  }

  // ---------------------------------------------------------------------------
  // Header band
  // ---------------------------------------------------------------------------

  get watchedFactionName(): string {
    const faction = this.watchedSeat === null ? undefined : this.engine.players[this.watchedSeat]?.faction;
    return faction ? factionName(faction) : "opponent";
  }

  /** The band's single line, ranked by what the player most needs to read at a glance: the step
   * they're on > a just-fired cancel rule (§8.5) > what is about to play > what is queued but
   * stuck > an invitation to queue something. */
  get bandTitle(): string {
    switch (this.stage) {
      case "picker":
        return "Cancel my queue if…";
      case "leech":
        return "Cancel if a power charge is…";
      case "refine":
        return `Cancel if ${this.watchedFactionName}…`;
    }
    if (this.cancelledNotice) {
      return `Cancelled — ${this.cancelledNotice.reason}`;
    }
    if (this.rows.length === 0) {
      return "Plan your next turn";
    }
    return this.willFireLine ?? `${this.rows.length} queued — none can play right now`;
  }

  get bandVariantClass(): string {
    if (this.stage !== null) {
      return "premove-bar__band--amber";
    }
    return this.cancelledNotice ? "premove-bar__band--stop" : "";
  }

  // ---------------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------------

  get canArm(): boolean {
    if (this.stage === "refine") {
      return this.refineDraft.length > 0;
    }
    if (this.stage === "leech") {
      return this.leechDraft !== null;
    }
    return false;
  }

  arm() {
    if (!this.canArm) {
      return;
    }
    if (this.stage === "refine") {
      this.$emit("arm-refine", this.refineDraft);
    } else if (this.stage === "leech") {
      this.$emit("arm-leech", this.leechDraft);
    }
  }

  /** Each step starts from a clean draft - otherwise a selection made on a previous trigger would
   * leave "Arm rule" enabled the moment the next step opened, before anything was picked. */
  @Watch("stage")
  onStageChanged() {
    this.refineDraft = [];
    this.leechDraft = null;
    this.$nextTick(() => this.emitBarHeight());
  }

  // ---------------------------------------------------------------------------
  // Queue list
  // ---------------------------------------------------------------------------

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

  /** Which entry actually plays next: index 0 in Chain, the first still-legal rank in Fallback. */
  get firstPlayableIndex(): number {
    const map = this.legalMap;
    return this.rows.findIndex((r) => map[r.seq]);
  }

  entryState(row: PremoveRow, index: number): "next" | "queued" | "blocked" {
    if (!this.legalMap[row.seq]) {
      return "blocked";
    }
    return index === this.firstPlayableIndex ? "next" : "queued";
  }

  entryStateLabel(row: PremoveRow, index: number): string {
    const state = this.entryState(row, index);
    if (state === "blocked") {
      return "blocked";
    }
    if (state === "next") {
      return this.engine.playerToMove === this.seat ? "ready" : "next";
    }
    return this.mode === "sequential" ? "then" : "backup";
  }

  entryClass(row: PremoveRow, index: number): string {
    return `premove-bar__entry--${this.entryState(row, index)}`;
  }

  private isLegal(base: Engine, move: string): boolean {
    const clone = Engine.fromData(JSON.parse(JSON.stringify(base)));
    // Move phase forced as well as the seat (see Engine.forcePremovePreviewTurn): in Fallback mode
    // `base` is the live engine, which may currently be sitting in RoundLeech/RoundIncome waiting on
    // somebody's decision - every queued row would read as "blocked" there otherwise.
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
    // Chain: each entry previews against a clone with every earlier entry already applied; a
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
    const index = this.firstPlayableIndex;
    if (index === -1) {
      return null;
    }
    return `Next: ${this.rows[index].move}`;
  }

  /** The seat this bar belongs to, guarded: `seat` can be undefined (nobody locked to a seat) and
   * the spec mounts this component against an engine with no players at all. */
  get myPlayer(): Player | null {
    return this.engine.players?.[this.seat] ?? null;
  }

  get showResourceBar(): boolean {
    return this.stickyMobile && !!this.myPlayer?.faction;
  }

  requestMode(mode: PremoveMode) {
    if (mode === this.mode) {
      this.pendingModeSwitch = null;
      return;
    }
    if (this.rows.length > 0) {
      // Inline confirm in the sheet rather than a window.confirm - see the template.
      this.pendingModeSwitch = mode;
      return;
    }
    this.$emit("mode-preference", mode);
  }

  confirmModeSwitch() {
    const mode = this.pendingModeSwitch;
    if (!mode) {
      return;
    }
    this.pendingModeSwitch = null;
    this.$store.dispatch("cancelAllPremoves", { seat: this.seat });
    this.$emit("mode-preference", mode);
    this.selectedSeq = null;
  }

  edit(row: PremoveRow) {
    this.$emit("start-edit", row.seq);
  }

  cancel(row: PremoveRow) {
    // §10.6: cascade in Chain (everything behind a cancelled entry was previewed assuming it
    // landed), single-row in Fallback (each rank is independent).
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

  &__body {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  &__inline-title {
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

  // ---- mode ----
  &__mode {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  &__segment {
    display: flex;
    flex-grow: 1;
    border: 1px solid var(--ui-border-strong);
    border-radius: 9px;
    overflow: hidden;
  }

  &__segment-option {
    flex: 1;
    border: 0;
    padding: 0.3rem 0.5rem;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
    color: var(--ui-text-muted);

    &--on {
      background: var(--ui-banner-start);
      color: var(--ui-banner-text);
    }
  }

  &__mode-hint,
  &__empty {
    font-size: 0.72rem;
    line-height: 1.35;
    color: var(--ui-text-muted);
  }

  &__info-link {
    border: 0;
    background: transparent;
    color: var(--ui-text-muted);
    font-size: 0.95rem;
    line-height: 1;
    padding: 0.2rem 0.3rem;
    cursor: pointer;
  }

  // ---- queue list ----
  &__list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__entry {
    border: 1px solid var(--ui-border);
    border-left: 3px solid var(--ui-border-strong);
    border-radius: 0.45rem;
    background: var(--ui-surface);
    overflow: hidden;

    &--next {
      border-left-color: #2f8f6b;
    }

    &--blocked {
      border-left-color: #b3564b;
    }
  }

  &__entry-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    border: 0;
    background: transparent;
    padding: 0.32rem 0.45rem;
    text-align: left;
    cursor: pointer;
    color: inherit;
  }

  &__entry-idx {
    font-weight: 700;
    font-size: 0.72rem;
    color: var(--ui-text-muted);
    flex: 0 0 auto;
  }

  &__entry-move {
    flex: 1;
    font-size: 0.78rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__entry-state {
    flex: 0 0 auto;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-radius: 20px;
    padding: 0.1rem 0.4rem;
    background: var(--ui-surface-alt, rgba(128, 128, 128, 0.16));
    color: var(--ui-text-muted);

    &--next {
      background: rgba(47, 143, 107, 0.16);
      color: #2f8f6b;
    }

    &--blocked {
      background: rgba(179, 86, 75, 0.16);
      color: #b3564b;
    }
  }

  &__entry-detail {
    padding: 0 0.45rem 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  &__entry-note {
    font-size: 0.68rem;
    line-height: 1.3;
    color: var(--ui-text-muted);
  }

  &__entry-actions {
    gap: 0.25rem;
  }

  // ---- notices ----
  &__notice {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    line-height: 1.3;
    border: 1px solid var(--ui-border);
    border-radius: 0.45rem;
    padding: 0.3rem 0.45rem;
    background: var(--ui-surface);

    &--warn {
      border-color: #c9962f;
      background: rgba(201, 150, 47, 0.12);
    }

    &--stop {
      border-color: #b3564b;
      background: rgba(179, 86, 75, 0.12);
    }

    &--ok {
      border-color: #2f8f6b;
      background: rgba(47, 143, 107, 0.1);
    }
  }

  &__notice-x {
    border: 0;
    background: transparent;
    color: var(--ui-text-muted);
    font-size: 0.7rem;
    line-height: 1;
    padding: 0.15rem 0.2rem;
    cursor: pointer;
    flex: 0 0 auto;
  }

  &__confirm {
    flex-wrap: wrap;
  }

  // ---- actions / footer ----
  &__actions {
    gap: 0.3rem;
    margin-top: 0.1rem;
  }

  &__action-button--primary {
    background: var(--ui-banner-start);
    border-color: var(--ui-banner-start);
    color: var(--ui-banner-text);
  }

  &__action-button--amber {
    border-color: #c9962f;
    color: #8a6410;
    background: rgba(201, 150, 47, 0.14);
  }

  &__foot {
    gap: 0.3rem;
    margin-top: 0.45rem;
    padding-top: 0.4rem;
    border-top: 1px solid var(--ui-border);
  }

  // ---- armed rules ----
  &__triggers {
    border-top: 1px solid var(--ui-border);
    padding-top: 0.35rem;
    font-size: 0.72rem;
  }

  &__fold {
    display: flex;
    width: 100%;
    gap: 0.3rem;
    border: 0;
    background: transparent;
    padding: 0.1rem 0;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--ui-text-muted);
    cursor: pointer;
    text-align: left;
  }

  &__trigger-row {
    padding: 0.15rem 0;
    gap: 0.3rem;
    align-items: center;
  }

  // Plain Bootstrap buttons on the in-flow desktop card; the keycap treatment below is scoped to
  // the sticky sheet only, matching how ordinary move buttons look outside Commands.vue's own bar.
  &__action-button,
  &__mini-button {
    font-size: 0.76rem;
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--ui-border-strong);
    border-radius: 8px;
    background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
    color: var(--ui-secondary-text);
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

      // Amber while a cancel rule is being armed, red once one has fired - the same semantic split
      // Game.vue's two banners used to carry, now on the one surface that replaced them.
      &.premove-bar__band--amber {
        background: linear-gradient(135deg, #a97514 0%, #8a6410 100%);
      }

      &.premove-bar__band--stop {
        background: linear-gradient(135deg, #a4483d 0%, #83382f 100%);
      }

      h5 {
        font-size: 0.85rem;
        font-weight: 600;
        line-height: 1.2;
        color: inherit;
        // The move text in "Next: terrans build m -1x2" is arbitrarily long; ellipsize rather than
        // let it wrap the header to three lines, which is exactly the height problem the on-turn
        // bar's own 0.85rem h5 was introduced to solve. The full text stays readable in the queue
        // list below.
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    // Already said by the header band above - showing it twice is what Commands.vue avoids with
    // #move-title.hide-on-mobile-sticky, same idea from the other side.
    .premove-bar__inline-title {
      display: none;
    }

    // Same slot, divider and spacing the on-turn bar gives its own resource strip.
    .premove-bar__resource-row {
      display: flex !important;
      margin-top: 0.35rem;
      padding-top: 0.3rem;
      border-top: 1px solid var(--ui-border);
    }

    // Same "keycap" treatment Commands.vue applies to its own move buttons, scoped to this same
    // sticky-bar context only.
    .premove-bar__action-button,
    .premove-bar__mini-button {
      border-radius: 10px;
      border-color: var(--ui-border-strong);
      box-shadow: 0 1px 2px var(--ui-shadow-soft);
      transition: transform 0.08s ease-out, box-shadow 0.08s ease-out;

      &:active {
        transform: scale(0.97);
        box-shadow: inset 0 1px 2px var(--ui-shadow);
      }
    }
  }
}
</style>
