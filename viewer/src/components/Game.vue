<template>
  <div :class="classes" id="root">
    <b-modal id="chart-button" title="Victory Points, Resources, and more" size="xl">
      <Charts />
    </b-modal>
    <Rules id="rules" />

    <!-- Show planning and queue details above the board; own-turn simulation starts beside the actions. -->
    <div v-if="analysisNotice || analysisPendingRestore" class="row">
      <div class="col-12">
        <AnalysisPanel
          :active="analysisMode"
          :notice="analysisNotice"
          :pending-restore="analysisPendingRestore"
          @dismiss-notice="dismissAnalysisNotice"
          @restore="restoreAnalysisLine"
          @discard-restore="discardPendingAnalysisLine"
        />
      </div>
    </div>

    <PremoveQueue
      v-if="showPremovePanel"
      :plan="myPremovePlan"
      :notice-storage-key="premoveNoticeStorageKey"
      :pending="!!$store.state.pendingPlan"
      :active="analysisMode"
      :preview-round="analysisMode && analysisRolledForward ? analysisBaseRound : undefined"
      :queue-enabled="premoveAvailable"
      :can-preview="!replayData"
      @plan="enterAnalysisMode"
      @exit="exitAnalysisMode"
      @view="viewPremoves"
      @cancel="cancelPremoves"
    />
    <PremoveNotice
      v-else-if="myPremovePlan && myPremovePlan.notice"
      :plan="myPremovePlan"
      :storage-key="premoveNoticeStorageKey"
      class="mb-3"
    />
    <div v-if="$store.state.planError" class="alert alert-warning" role="status">{{ $store.state.planError }}</div>
    <template v-if="uiMode === 'graphical'">
      <!-- Round 0 only (ban/pick/bid/starting buildings/booster): says whose turn it is and what
           they have to do, plus the auction/ban explainer buttons. Deliberately above the map
           rather than down in the commands column - during setup the board matters least and
           "whose turn, doing what" matters most, and the commands column is both below the whole
           map+research row on mobile AND only rendered for the player on turn (`canPlay`), so
           everyone else used to have nothing but a green ring on a turn-order circle to go on.
           Rendered here (inside the viewer) so hosted and self-contained/hot-seat play get the
           same strip. -->
      <div class="row" v-if="!ended">
        <div class="col-12">
          <SilentAuctionSummary />
          <PreferenceSplitSummary />
          <SetupStatus />
          <!-- Both simultaneous-bid auctions' forms live here rather than in Commands: every seat
               bids at once, so they must render for players the engine's turn pointer is not
               currently on (which is what gates Commands' `canPlay`). Only one of them can ever be
               visible - each renders only during its own variant's bid round. -->
          <PreferenceSplitBid @command="handleCommand" />
          <SilentAuctionBid @command="handleCommand" />
          <!-- Mobile only (`setupActionsAtTop`): during round 0 the pick/ban buttons move up here,
               directly under the status strip, instead of sitting below the whole map+research row
               where they normally live. Desktop keeps them in the commands column, unchanged. The
               matching `v-if` on the commands column's own <Commands> keeps exactly one of the two
               mounted - never both, which would duplicate its element ids and modals. -->
          <Commands
            v-if="setupActionsAtTop && (canPlay || analysisMode)"
            :actions-enabled="canPlay"
            @command="handleCommand"
            :currentMove="currentMove"
            :hide-spacer="true"
            :analysis-mode="analysisMode"
            :analysis-offered="analysisOffered && !replayData"
            @analysis-start="enterAnalysisMode"
            :analysis-status="analysisStatus"
            :analysis-move-count="analysisAppliedEntries.filter((entry) => entry.kind === 'move').length"
            :analysis-can-edit="!!(analysisEntries.length || currentMove || analysisPendingCharge)"
            :analysis-can-undo-charge="
              analysisPendingCharge > 0 || analysisAppliedEntries[analysisAppliedEntries.length - 1]?.kind === 'adjust'
            "
            :analysis-committable-moves="analysisCommittableMoves.length"
            :analysis-commit-plan="analysisCommitPlan"
            :analysis-faction-choices="analysisFactionChoices"
            :analysis-line-summaries="analysisLineSummaries"
            :analysis-active-line="analysisActiveLine"
            @analysis-seed-faction="seedAnalysisFaction"
            @analysis-commit="commitAnalysisLine"
            @analysis-charge="chargeAnalysisPower"
            @analysis-undo-charge="undoAnalysisCharge"
            @analysis-undo="undoLastAnalysisEntry"
            @analysis-reset="resetAnalysisLine"
            @analysis-select-line="selectAnalysisLine"
            @analysis-add-line="addAnalysisLine"
            @analysis-close-line="closeAnalysisLine"
            @sticky-bar-height="stickyBarHeight = $event"
          />
          <!-- Rendered next to the picker as well, not only instead of it: the picker drops a
               faction the moment it is picked, and this is what keeps its sheet reachable. -->
          <FactionBrowser v-if="setupActionsAtTop" :on-turn="canPlay" />
        </div>
      </div>
      <div
        :class="[
          'row',
          'no-gutters',
          'justify-content-center',
          'game-board-layout',
          engine.players.length > 2 ? 'medium-map' : 'small-map',
        ]"
        v-if="hasMap"
      >
        <SpaceMap :class="['mb-1', 'space-map', 'col-md-7']" />
        <div class="col-md-5 game-board-side-column">
          <!-- For Lost Fleet, ResearchBoard itself grows a 7th column (Scoring Board Extension +
               round scoring tiles - see ResearchBoard.vue) in the space ScoringBoard's final
               scoring used to occupy here, before final scoring moved onto the map itself
               (SpaceMap.vue's bottom-right corner) - so ScoringBoard only renders for the base
               game here. -->
          <ResearchPanel>
            <svg
              class="scoring-research-board"
              :viewBox="researchBoardCanvasViewBox"
              :width="researchBoardCanvasWidth"
              :height="researchBoardCanvasHeight"
            >
              <ResearchBoard
                :height="engine.options.lostFleet ? researchBoardViewHeight : 450"
                :width="engine.options.lostFleet ? researchBoardContentWidth : undefined"
                ref="researchBoard"
                x="-50"
              />
              <!-- No y offset: the pre-LF y="-25" pushed the final scoring tiles 25 units above
                   the canvas' minY=0, clipping them at the top (owner report, 2026-09). y=0 aligns
                   the section's top with the research tracks' top. -->
              <ScoringBoard v-if="!engine.options.lostFleet" class="ml-4" width="80" :x="researchBoardWidth + 20" />
              <!-- Right under the 6 tracks' own bottom edge (BASE_RESEARCH_BOARD_HEIGHT, a fixed
                   5-unit gap) - NOT researchBoardViewHeight, which Lost Fleet's 7th column (round
                   scoring + final scoring, positioned further right) can inflate well past where the
                   tracks themselves actually end, leaving a large visible gap here otherwise. -->
              <BoardAction
                :scale="17"
                :transform="
                  engine.options.lostFleet
                    ? `translate(${45 * i - 20 + boardActionRowXShift}, ${baseResearchBoardHeight + 5})`
                    : `translate(${45 * i + 6}, 455)`
                "
                v-for="(action, i) in actions"
                :key="action"
                :action="action"
              />
            </svg>
          </ResearchPanel>
          <!-- Stacked directly below the research board in normal document flow (same column,
               not a separate Bootstrap row) so it hugs the power/QIC action row's actual bottom
               edge at every viewport width - a separate row below would only start once BOTH
               columns of the row above finished, so whenever the map (a different aspect ratio,
               independently resizing) ended up taller than the research board, a resize-dependent
               gap opened up above the ships with nothing anchoring them to the research board
               specifically. Mobile is unaffected: research board and ships already rendered in
               this order (map, then research, then ships) once the row above wraps.

               The round boosters + available federation tokens (Pool.vue) used to live in their own
               full-width row far down the page, after every player board - owner feedback was to move
               them up beside the ship boards instead, in the room the ship boards' own tightened-up
               action row now leaves on the right, rather than a separate section. `lost-fleet-ships-row`
               gives `LostFleetShips` a fixed share of the width matching its action octagons' exact
               px-per-unit to the base game's own power/QIC octagons (`lostFleetShipsStyle`) and
               `Pool` (`compact` drops its page-gutter padding, which a narrow sidebar can't spare, while
               keeping its bordered box unchanged) whatever's left over. -->
          <div v-if="engine.options.lostFleet" class="lost-fleet-ships-row mt-2">
            <LostFleetShips :style="lostFleetShipsStyle" />
            <!-- Right sidebar column: just the round-booster/federation Pool (the notes sheet was
                 removed - per-game notes are the hosting platform's job now). -->
            <div class="lost-fleet-pool-sidebar lf-sidebar-col">
              <Pool compact />
            </div>
          </div>
        </div>
      </div>
      <div class="row mt-2">
        <!-- Turn Order back in its pre-Gaia-9 spot: compact, sharing this row with the commands
             column (order-flipped against it on mobile). The full-width top banner was reverted -
             it read as a huge rounded strip and duplicated information the page already shows. -->
        <TurnOrder v-if="!ended && engine.players.length > 0" class="col-md-4 order-4 order-md-1" />
        <div :class="commandsColumnClass">
          <Commands
            @command="handleCommand"
            v-if="(canPlay || analysisMode) && !setupActionsAtTop"
            :actions-enabled="canPlay"
            :currentMove="currentMove"
            :hide-spacer="true"
            :analysis-mode="analysisMode"
            :analysis-offered="analysisOffered && !replayData"
            @analysis-start="enterAnalysisMode"
            :analysis-status="analysisStatus"
            :analysis-move-count="analysisAppliedEntries.filter((entry) => entry.kind === 'move').length"
            :analysis-can-edit="!!(analysisEntries.length || currentMove || analysisPendingCharge)"
            :analysis-can-undo-charge="
              analysisPendingCharge > 0 || analysisAppliedEntries[analysisAppliedEntries.length - 1]?.kind === 'adjust'
            "
            :analysis-committable-moves="analysisCommittableMoves.length"
            :analysis-commit-plan="analysisCommitPlan"
            :analysis-faction-choices="analysisFactionChoices"
            :analysis-line-summaries="analysisLineSummaries"
            :analysis-active-line="analysisActiveLine"
            @analysis-seed-faction="seedAnalysisFaction"
            @analysis-commit="commitAnalysisLine"
            @analysis-charge="chargeAnalysisPower"
            @analysis-undo-charge="undoAnalysisCharge"
            @analysis-undo="undoLastAnalysisEntry"
            @analysis-reset="resetAnalysisLine"
            @analysis-select-line="selectAnalysisLine"
            @analysis-add-line="addAnalysisLine"
            @analysis-close-line="closeAnalysisLine"
            @sticky-bar-height="stickyBarHeight = $event"
          />

          <div v-else-if="offlineMirrorWaiting" class="text-muted small">
            Waiting for {{ turnPlayer.name || "the other player" }}. This is your offline copy of an online game, so you
            play only your own seats here; their move arrives the next time you open the game with a connection.
          </div>

          <FactionBrowser v-if="!setupActionsAtTop" :on-turn="canPlay" />
        </div>
      </div>
      <AdvancedLog
        class="col-12 order-last mt-4"
        :currentMove="currentMove"
        :hideLog.sync="hideLog"
        v-if="logPlacement === 'top'"
      />
      <div class="row mt-2">
        <template v-if="sessionPlayer === undefined">
          <PlayerInfo v-for="player in orderedPlayers" :player="player" :key="player.player" class="col-md-6 order-6" />
        </template>
        <template v-else>
          <PlayerInfo :player="sessionPlayer" class="col-md-6 order-3" />
          <PlayerInfo
            v-for="player in orderedPlayers.filter((pl) => pl !== sessionPlayer)"
            :player="player"
            :key="player.player"
            class="col-md-6 order-6"
          />
        </template>
        <!-- Lost Fleet moved this into its own sidebar next to the ship boards (see the map+research
             row above) - only the base game still renders it in its old full-width spot here. -->
        <Pool v-if="!engine.options.lostFleet" class="col-12 order-10 mt-4" />
        <AdvancedLog
          class="col-12 order-last mt-4"
          :currentMove="currentMove"
          :hideLog.sync="hideLog"
          v-if="logPlacement === 'bottom'"
        />
      </div>
    </template>
    <div v-else class="d-flex flex-column">
      <SetupStatus v-if="!ended" />
      <SpaceMap v-if="hasMap" :class="['mb-1', 'space-map', 'col-md-7']" />
      <AdvancedLog :currentMove="currentMove" :hideLog.sync="hideLog" v-if="logPlacement === 'top'" />
      <Commands
        @command="handleCommand"
        v-if="canPlay || analysisMode"
        :actions-enabled="canPlay"
        :currentMove="currentMove"
        :hide-spacer="true"
        @sticky-bar-height="stickyBarHeight = $event"
        :analysis-mode="analysisMode"
        :analysis-offered="analysisOffered && !replayData"
        @analysis-start="enterAnalysisMode"
        :analysis-status="analysisStatus"
        :analysis-move-count="analysisAppliedEntries.filter((entry) => entry.kind === 'move').length"
        :analysis-can-edit="!!(analysisEntries.length || currentMove || analysisPendingCharge)"
        :analysis-can-undo-charge="
          analysisPendingCharge > 0 || analysisAppliedEntries[analysisAppliedEntries.length - 1]?.kind === 'adjust'
        "
        :analysis-committable-moves="analysisCommittableMoves.length"
        :analysis-commit-plan="analysisCommitPlan"
        :analysis-faction-choices="analysisFactionChoices"
        :analysis-line-summaries="analysisLineSummaries"
        :analysis-active-line="analysisActiveLine"
        @analysis-seed-faction="seedAnalysisFaction"
        @analysis-commit="commitAnalysisLine"
        @analysis-charge="chargeAnalysisPower"
        @analysis-undo-charge="undoAnalysisCharge"
        @analysis-undo="undoLastAnalysisEntry"
        @analysis-reset="resetAnalysisLine"
        @analysis-select-line="selectAnalysisLine"
        @analysis-add-line="addAnalysisLine"
        @analysis-close-line="closeAnalysisLine"
      />
      <Table />
      <AdvancedLog :currentMove="currentMove" :hideLog.sync="hideLog" v-if="logPlacement === 'bottom'" />
    </div>
    <div class="chat-host" :style="{ '--chat-footer-height': totalStickyFooterHeight + 'px' }"></div>
    <div
      class="mobile-sticky-actions-spacer"
      :style="{ '--sticky-bar-height': totalStickyFooterHeight + 'px' }"
      aria-hidden="true"
    ></div>
  </div>
</template>

<script lang="ts">
import type { EngineOptions } from "@gaia-project/engine";
import Engine, {
  BoardAction as BoardActionEnum,
  BuildWarning,
  Command,
  Faction,
  Phase,
  Player,
  ResearchField,
  Round,
} from "@gaia-project/engine";
import type { PremoveCommand, PremovePlan, PremoveTiming } from "@gaia-project/engine/src/premove-types";
import { MAX_PREMOVES } from "@gaia-project/engine/src/premove-types";
import { currentPlayer } from "@gaia-project/engine/wrapper";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import type { LogPlacement } from "../data";
import { factionName } from "../data/factions";
import { orderedPlayers } from "../data/player";
import type {
  AnalysisCommitPlan,
  AnalysisEntry,
  AnalysisLineSet,
  AnalysisLineSummary,
  AnalysisMoveEntry,
  AnalysisStatus,
} from "../logic/analysis";
import {
  advancePastOwnPass,
  analysisCommitPrefix,
  analysisFactionPool,
  applyLeechAdjustment,
  assumedPowerOf,
  buildAnalysisLineup,
  chargedPowerTotal,
  clearAnalysisLine,
  computeAnalysisStatus,
  dropPlayedAnalysisPrefix,
  emptyAnalysisLineSet,
  factionSeedAvailable,
  loadAnalysisLines,
  markAnalysisSeat,
  MAX_ANALYSIS_LINES,
  normalizeAnalysisLineSet,
  ownMoveCount,
  planAnalysisCommit,
  replayAnalysisLine,
  saveAnalysisLines,
  settleAnalysisClone,
  summarizeAnalysisLine,
} from "../logic/analysis";
import { ExecuteBack } from "../logic/buttons/types";
import { parseCommands } from "../logic/recent";
import { BASE_RESEARCH_BOARD_HEIGHT, isBeforeRound1, researchBoardHeight } from "../logic/utils";
import { isDesktopViewport, watchDesktopViewport } from "../logic/viewport";
import type { SealedBidBackend } from "../store";
import { UiMode } from "../store";
import AdvancedLog from "./AdvancedLog.vue";
import AnalysisPanel from "./AnalysisPanel.vue";
import BoardAction from "./BoardAction.vue";
import Charts from "./Charts.vue";
import Commands from "./Commands.vue";
import FactionBrowser from "./FactionBrowser.vue";
import LostFleetShips, { SHIP_BOARD_VIEWBOX_WIDTH } from "./LostFleetShips.vue";
import PlayerInfo from "./PlayerInfo.vue";
import Pool from "./Pool.vue";
import PreferenceSplitBid from "./PreferenceSplitBid.vue";
import PreferenceSplitSummary from "./PreferenceSplitSummary.vue";
import PremoveNotice from "./PremoveNotice.vue";
import PremoveQueue from "./PremoveQueue.vue";
import ResearchBoard from "./ResearchBoard.vue";
import ResearchPanel from "./ResearchPanel.vue";
import Rules from "./Rules.vue";
import ScoringBoard from "./ScoringBoard.vue";
import SetupStatus from "./SetupStatus.vue";
import SilentAuctionBid from "./SilentAuctionBid.vue";
import SilentAuctionSummary from "./SilentAuctionSummary.vue";
import SpaceMap from "./SpaceMap.vue";
import Table from "./Table.vue";
import TurnOrder from "./TurnOrder.vue";

// The base-game power/QIC action row is drawn with BoardAction.vue, which wraps every octagon in an
// inner `<svg viewBox="-28 -28 56 56" overflow:visible>`. That inner viewBox origin shifts the
// painted octagon by +28 on BOTH axes relative to the `translate(x, y)` we position each one at - so
// an octagon we translate to (x, y) actually paints centered near (x + 28, y + 28), and within that
// inner box the octagon's own bounding box measures roughly x∈[-26, 19], y∈[-27, 19]. The Lost Fleet
// canvas sizing + centering below have to account for where the octagons REALLY land, not for the
// bare translate: assuming they sat exactly at (x, y) is what let the row overflow the board's bottom
// edge into the ship boards, and left it hugging the panel's left edge.
const BOARD_ACTION_INNER_OFFSET = 28;
const BOARD_ACTION_OCTAGON_LEFT = -26;
const BOARD_ACTION_OCTAGON_BOTTOM = 19;
const BOARD_ACTION_BASE_X = -20;

@Component<Game>({
  components: {
    AdvancedLog,
    AnalysisPanel,
    BoardAction,
    Commands,
    PlayerInfo,
    Pool,
    ResearchBoard,
    ResearchPanel,
    ScoringBoard,
    SpaceMap,
    LostFleetShips,
    TurnOrder,
    SetupStatus,
    FactionBrowser,
    SilentAuctionSummary,
    PreferenceSplitSummary,
    PreferenceSplitBid,
    SilentAuctionBid,
    Rules,
    Table,
    PremoveQueue,
    PremoveNotice,
    // Static import (rather than the previous `() => import("./Charts.vue")`) so the published
    // UMD lib stays a single file - an async chunk would resolve against the baked-in publicPath,
    // which breaks when the bundle is hosted anywhere other than that exact CDN path.
    Charts,
  },
})
export default class Game extends Vue {
  public currentMove = "";
  public hideLog = false;
  isDesktopViewport = isDesktopViewport();
  clearCurrentMove = false;
  // Mirrors Commands.vue's own measured mobile sticky-bar height (see its `hide-spacer` prop /
  // `sticky-bar-height` event) so the reserved space for it can render at the end of the page
  // instead of right after Turn Order.
  stickyBarHeight = 0;
  // When joining a game
  name = "";

  replayData: { current: number; backup: Engine } = null;

  analysisSubmission: string | null = null;
  analysisMode = false;
  analysisBackup: Engine = null;
  analysisOrigin: Engine = null;
  analysisComposeBase: Engine = null;
  analysisSeat: number = null;
  analysisBaseRound: number = null;
  analysisBaseMoveCount: number = null;
  // The REAL move history the origin was cloned from. Not `analysisOrigin.moveHistory`, which is a
  // different list: `settleAnalysisClone`/`advancePastOwnPass` play opponents' declines, boosters,
  // starting mines and passes through `engine.move()`, and every one of those is pushed onto the
  // clone's own history. That drift is why an opponent's turn used to force-close the sandbox
  // whenever it had been opened during a leech pause or after this seat had passed - see
  // `reanchorAnalysisLine`, which compares against this instead.
  analysisRealHistory: string[] = [];
  // §13's lines. Every line is rooted at the same `analysisOrigin` (that is what makes switching
  // between them a replay rather than a second board takeover), so `analysisBaseRound`/
  // `analysisBaseMoveCount` above stay session-wide rather than becoming per-line - and staleness
  // (§3.5) stays one decision for the whole set. There is always at least one line, from the moment
  // the sandbox opens: Line 1 is not something the player has to create, and there is no Save button
  // because every line already persists on every completed turn (see `setAnalysisEntries`).
  analysisLines: AnalysisEntry[][] = [[]];
  analysisActiveLine = 0;
  // How many of the OPEN line's entries actually replayed onto the current origin - `analysisEntries`
  // is what is stored, `analysisAppliedEntries` is what is on the board, and the two differ only
  // while a line carries a tail that no longer applies.
  //
  // A line used to be TRUNCATED to that prefix and the truncation persisted immediately, so anything
  // that made an early entry illegal - an opponent taking your hex, or (before
  // `dropPlayedAnalysisPrefix`) your own move making entry 1 unplayable - silently deleted every
  // move after it, with no way back. Nothing is thrown away now: the strip already flags a line whose
  // `applied` is short of its `moves` (AnalysisLineTabs.vue's `~`), the dead tail gets another chance
  // on every re-anchor, and it is dropped only when the player themselves edits the line.
  analysisAppliedCount = 0;
  // Charge 1 presses made while a turn is half-composed (see `chargeAnalysisPower`). They are applied
  // to the board as displayed and only become an `adjust` entry once that turn completes, so the
  // charge lands where the player is looking rather than ahead of the turn in progress.
  analysisPendingCharge = 0;
  // One summary per line for the tab strip, recomputed only when a line actually changes - see
  // `refreshAnalysisLineSummaries` for why this is a plain field rather than a computed getter.
  analysisLineSummaries: AnalysisLineSummary[] = [];
  // Memo behind that refresh, so editing the open line does not re-replay the four that did not
  // change. A Map rather than a plain object precisely because Vue 2 leaves it unobserved: this is a
  // cache, and every read of it is already followed by an assignment to the reactive field above.
  // Emptied on entry/exit rather than pruned - a sandbox session is short and the keys are cheap.
  analysisSummaryCache: Map<string, AnalysisLineSummary> = new Map();
  // The assumed-power tally (§12, engine `analysisAssumedPower`) as of `analysisComposeBase`. It has
  // to be tracked separately because that base is a plain-JSON snapshot and the tally is deliberately
  // absent from `PlayerData.toJSON()` - so a turn composed on top of the base would otherwise start
  // counting again from 0 and hide everything the line had already assumed. Kept in memory only,
  // like the base itself: it is re-derived on every replay.
  analysisComposeAssumedPower = 0;

  // Phase 4 (§2.7) - the real sealed-bid backend, stashed on entry and restored on exit, so a
  // simultaneous auction phase (Preference Split/Silent) submits ordinary local moves instead of
  // going through the server while composing inside the sandbox - the same "stash, take over,
  // restore" shape as analysisBackup above, applied to this one piece of global store state.
  analysisSealedBidBackendBackup: SealedBidBackend | null = null;
  // Ordinary real moves reconcile automatically. A saved plan from a divergent history is
  // held for explicit recovery without overwriting storage while the prompt is unanswered.
  analysisNotice: string | null = null;
  analysisPendingRestore: AnalysisLineSet | null = null;
  // The sandbox rolled the clone into a later round than the real game is in, because this seat had
  // already passed (`advancePastOwnPass`). Nothing in such a line is committable - the real game has
  // not reached that round - so this is what `analysisCommittableMoves` reads to say so.
  analysisRolledForward = false;

  @Prop({ default: false })
  tutorial: boolean;

  @Prop({ default: false })
  interactionDisabled: boolean;

  @Prop()
  options: EngineOptions;

  mounted() {
    const undoListener = this.$store.subscribeAction(({ type, payload }) => {
      if (type === "undo") {
        this.undoMove();
      }
    });
    this.$on("hook:beforeDestroy", () => undoListener());

    // Only fires when the desktop/mobile breakpoint is actually crossed, so `setupActionsAtTop`
    // (which moves the round-0 action area between two mount points) can't thrash on every resize
    // pixel and remount Commands mid-turn.
    const viewportListener = watchDesktopViewport((isDesktop) => {
      this.isDesktopViewport = isDesktop;
    });
    this.$on("hook:beforeDestroy", () => viewportListener());
  }

  created(this: Game) {
    const unsub = this.$store.subscribeAction(({ type, payload }) => {
      if (type === "externalData") {
        const pending = this.$store.state.pendingPlan as PremoveCommand | null;
        if (pending && payload.automation?.plans[this.myLockedSeat]?.requestId === pending.requestId) {
          if (this.analysisMode && this.analysisSubmission === pending.requestId) {
            // Saving a queue does not play it. Keep all variations until real moves arrive.
            this.exitAnalysisMode();
          }
          this.analysisSubmission = null;
          this.$store.commit("planSaved");
        }
        if (this.replayData) {
          this.replayData.backup = JSON.parse(JSON.stringify(payload));
          return;
        }
        if (this.analysisMode) {
          // A reconnect/tab-refocus refetch dispatches this with the SAME real state as when
          // sandbox mode was entered - not an actual new move - and used to force-close the
          // sandbox unconditionally on every such refetch, which is the reported "minimize/reopen
          // closes sandbox mode with no move made" bug. Only a real change in the move history means
          // anything actually happened; an identical history is a no-op refresh and must leave the
          // takeover alone.
          // The REAL history the origin was cloned from, not the clone's own - `settleAnalysisClone`
          // and `advancePastOwnPass` push every opponent decline/booster/pass they auto-play onto
          // `analysisOrigin.moveHistory`, so that list is longer than the real one in most async
          // games (anything entered during a leech pause, or after this seat had passed). Comparing
          // against it made `unchanged` false for a refetch that carried no move at all, and the
          // handler then force-closed the sandbox: this is the "minimize/reopen closes sandbox mode
          // with no move made" bug, which the check below was written to fix and only fixed for the
          // games where nothing had to be auto-played.
          const originHistory = this.analysisRealHistory;
          const incomingHistory = payload.moveHistory ?? [];
          const unchanged =
            originHistory.length === incomingHistory.length &&
            originHistory.every((move, index) => move === incomingHistory[index]);
          if (unchanged) {
            this.analysisBackup = JSON.parse(JSON.stringify(payload));
            return;
          }
          // An opponent's turn is not, by itself, a reason to throw the player out of the sandbox -
          // see `reanchorAnalysisLine`. It re-bases the line onto the new real state in place and
          // takes over the whole handler when it can, so nothing below (including the handleData at
          // the end) runs and the takeover simply carries on.
          if (this.reanchorAnalysisLine(payload)) {
            return;
          }
          this.analysisMode = false;
          this.analysisBackup = null;
          this.analysisOrigin = null;
          this.analysisComposeBase = null;
          this.analysisComposeAssumedPower = 0;
          this.analysisSeat = null;
          this.analysisPendingRestore = null;
          this.analysisPendingCharge = 0;
          this.analysisRealHistory = [];
          this.analysisNotice = "The position changed. Your draft is saved; open Planning to review it.";
          this.$store.commit("setSealedBidBackend", this.analysisSealedBidBackendBackup);
          this.analysisSealedBidBackendBackup = null;
          this.$store.commit("setAnalysisMode", false);
        }
        this.handleData(Engine.fromData(payload));
        return;
      }
      if (type === "analysisMove") {
        this.applyAnalysisMove(payload as string);
        return;
      }
      if (type === "replayStart") {
        this.startReplay();
        return;
      }
      if (type === "replayEnd") {
        const restore = payload || this.replayData?.backup;
        this.replayData = null;
        this.handleData(Engine.fromData(restore));
        return;
      }
      if (type === "replayTo") {
        this.replayTo(payload as number);
      }
    });

    this.$once("hook:beforeDestroy", unsub);
  }

  startReplay() {
    if (this.analysisMode) this.exitAnalysisMode();
    if (this.replayData) {
      return;
    }
    this.$store.dispatch("replayInfo", {
      start: 1,
      end: this.engine.moveHistory.length,
      current: this.engine.moveHistory.length,
    });

    this.replayData = {
      current: this.engine.moveHistory.length,
      backup: JSON.parse(JSON.stringify(this.engine)),
    };
  }

  replayTo(dest: number) {
    if (!this.replayData) {
      this.startReplay();
    }
    const current = this.replayData.current;

    this.replayData.current = dest;

    const backup = this.replayData.backup;
    this.$store.dispatch("replayInfo", {
      start: 1,
      end: backup.moveHistory.length,
      current: dest,
    });

    if (dest === current) {
      return;
    }
    if (dest < current) {
      this.handleData(Engine.fromData(JSON.parse(JSON.stringify(backup))).replayedTo(dest, true));
      return;
    }

    for (const move of backup.moveHistory.slice(current, dest)) {
      this.engine.move(move);
    }
    this.handleData(Engine.fromData(JSON.parse(JSON.stringify(this.engine))));
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get uiMode(): UiMode {
    return this.$store.state.preferences.uiMode;
  }

  get expansions() {
    return this.engine.expansions;
  }

  get researchBoardWidth() {
    return ResearchField.values(this.expansions).length * 60;
  }

  // Lost Fleet adds one extension column (Scoring Board Extension + round/final scoring tiles) to
  // the six 60-unit research tracks. Giving the nested SVG its exact width avoids preserveAspectRatio
  // letterboxing inside the outer board - that letterboxing was the main source of the empty mobile
  // gutters around the research art. The 70 here MUST match ResearchBoard.vue's EXTENSION_COLUMN_WIDTH
  // (it's sized to the extension column's actual content so the board stays centered in its panel).
  get researchBoardContentWidth() {
    return this.researchBoardWidth + (this.engine.options.lostFleet ? 70 : 0);
  }

  // ResearchBoard.vue's own real content height (440, or up to 471 for Lost Fleet's round/final
  // scoring column) - declaring this instead of a stale hardcoded height keeps that nested SVG at
  // true 1:1 scale, so it always reserves enough room for however tall Lost Fleet's extra 7th
  // column gets.
  get researchBoardViewHeight() {
    return researchBoardHeight(this.engine);
  }

  // The 6 tracks' own fixed content height, independent of researchBoardViewHeight above - used to
  // anchor the power/QIC action row to the tracks' own bottom edge (see the template comment by
  // its transform) instead of Lost Fleet's taller, 7th-column-inflated board height.
  get baseResearchBoardHeight() {
    return BASE_RESEARCH_BOARD_HEIGHT;
  }

  get researchBoardCanvasMinX() {
    // Base game: the pre-Lost-Fleet framing (0) - the -50 inset only exists so Lost Fleet's
    // extension column can hang left of the tracks without clipping.
    return this.engine.options.lostFleet ? -50 : 0;
  }

  get researchBoardCanvasWidth() {
    // Base game: the pre-Lost-Fleet framing (tracks + 120 for the side ScoringBoard). Lost Fleet
    // has no side board, so its canvas can end exactly at the extension column.
    return this.engine.options.lostFleet ? this.researchBoardContentWidth : this.researchBoardWidth + 120;
  }

  get researchBoardCanvasHeight() {
    if (!this.engine.options.lostFleet) {
      // Pre-Lost-Fleet value: 440 of tracks + the action row below them. 550 was a Lost-Fleet
      // accommodation that left ~110 units of empty space at the base-game board's bottom.
      return 505;
    }

    // Reserve room for the action row's ACTUAL painted bottom edge, not its bare translate: each
    // octagon is translated to y = baseResearchBoardHeight + 5 but (per BOARD_ACTION_INNER_OFFSET
    // above) paints ~28 units lower, and its own box reaches ~19 units past that center - so its true
    // bottom is baseResearchBoardHeight + 5 + 28 + 19. Keep five units of breathing room under it (the
    // old `+ 34` assumed the octagon sat at its translate and stopped ~48 units too high, which let the
    // row spill past the panel into the ship boards below). A taller final-scoring column still wins.
    const actionRowBottom = this.baseResearchBoardHeight + 5 + BOARD_ACTION_INNER_OFFSET + BOARD_ACTION_OCTAGON_BOTTOM;
    return Math.max(this.researchBoardViewHeight, Math.ceil(actionRowBottom + 5));
  }

  get researchBoardCanvasViewBox() {
    return `${this.researchBoardCanvasMinX} 0 ${this.researchBoardCanvasWidth} ${this.researchBoardCanvasHeight}`;
  }

  // Sizes the ship board so it renders at the research board's own px-per-unit - both live full-width
  // in the same `.lost-fleet-ships-row`, so matching px-per-unit means the ship SVG takes
  // SHIP_BOARD_VIEWBOX_WIDTH / researchBoardCanvasWidth of the row's width. That's what makes the
  // ship's action octagons match the base-game power-action octagons exactly (owner request), and its
  // Standard Tech tile match the research board's tech tiles. Exposed as a CSS custom property that
  // `.lost-fleet-ships-row > .lost-fleet-ships` (Game.vue's own stylesheet) reads as a fixed
  // flex-basis - the Pool sidebar (`.lost-fleet-pool-sidebar`) gets whatever's left over.
  get lostFleetShipsStyle(): Record<string, string> {
    const width = (SHIP_BOARD_VIEWBOX_WIDTH / this.researchBoardCanvasWidth) * 100;
    return { "--lf-ship-width": `${width}%` };
  }

  get totalStickyFooterHeight() {
    return this.stickyBarHeight;
  }

  /** Someone else is on turn in an offline copy of an online game - nothing to play, and nothing
   * else (Commands) would otherwise appear to say why. */
  get offlineMirrorWaiting(): boolean {
    return !this.analysisMode && !!this.$store.state.offlineMirror && !!this.turnPlayer && !this.ended && !this.canPlay;
  }

  get logPlacement(): LogPlacement {
    return this.$store.state.preferences.logPlacement;
  }

  get autoClick(): boolean[][] {
    return this.$store.getters.autoClick;
  }

  setAutoClick(value: boolean[][]) {
    this.$store.commit("setAutoClick", value);
  }

  get actions(): BoardActionEnum[] {
    return BoardActionEnum.values(this.expansions);
  }

  // Horizontal shift applied to the whole action row. The base game keeps its long-standing
  // left-anchored framing (a ScoringBoard fills the space to the row's right - shift 0). Lost Fleet
  // has no side ScoringBoard; per the owner's brief the row is left-aligned (previously it was
  // centered, which read as floating between two gutters). We align the leftmost octagon's real
  // painted left edge (see BOARD_ACTION_INNER_OFFSET) with the research tracks' own left content
  // inset above it, so the whole board reads as one left-anchored block.
  get boardActionRowXShift(): number {
    if (!this.engine.options.lostFleet) {
      return 0;
    }
    // The research tracks' colored tiles begin ~2 units in from the ResearchBoard SVG's own origin
    // (its inner viewBox 0 maps to researchBoardCanvasMinX), so target that same left edge here.
    const trackLeftInset = 2;
    const targetOctagonLeft = this.researchBoardCanvasMinX + trackLeftInset;
    const firstOctagonLeft = BOARD_ACTION_BASE_X + BOARD_ACTION_INNER_OFFSET + BOARD_ACTION_OCTAGON_LEFT;
    return targetOctagonLeft - firstOctagonLeft;
  }

  get ended() {
    return this.engine.phase === Phase.EndGame;
  }

  // The BGS launcher marks hosted games explicitly; the iframe URL is shared between games.
  get isHostedMode(): boolean {
    return this.$store.state.hosted;
  }

  get orderedPlayers(): Player[] {
    return orderedPlayers(this.engine);
  }

  // Lost Fleet only, desktop only (see the template comment by its usage) - narrows the buttons
  // column to match the map's own col-md-7 and orders it ahead of the ship boards, instead of the
  // plain full-width col-12 every other game mode still uses.
  get commandsColumnClass(): string[] {
    // Shares the row with the restored compact TurnOrder (col-md-4) - old pre-Gaia-9 widths.
    return this.engine.options.lostFleet
      ? ["order-2", "order-md-1", "col-12", "col-md-7"]
      : ["col-12", "col-md-8", "order-1", "order-md-2"];
  }

  /** Mobile-only: during round 0 the pick/ban action area is rendered directly under the setup
   * status strip instead of in the commands column, which on mobile sits below the entire
   * map+research row. Desktop layout is unchanged. */
  get setupActionsAtTop(): boolean {
    return !this.isDesktopViewport && !this.ended && isBeforeRound1(this.engine);
  }

  get canPlay() {
    if (this.interactionDisabled) return false;
    if (this.ended) {
      return false;
    }

    if (this.analysisMode) {
      return isBeforeRound1(this.engine) || this.engine.playerToMove === this.analysisSeat;
    }

    const lockedSeat = this.$store.state.player?.index;
    if (lockedSeat !== undefined) {
      return lockedSeat >= 0 && lockedSeat === this.engine.playerToMove;
    }

    // A hosted viewer with NO locked seat is a spectator: the host always sends a `player` message
    // (empty object when the user owns no seat), so `state.player` is set in hosted mode but stays
    // null in self-contained/hot-seat play. Returning true here is what let a spectator see (and
    // press) the current player's action buttons - the "I see the current move" bug.
    if (this.$store.state.player !== null) {
      return false;
    }

    return true;
  }

  get hasMap() {
    return !!this.engine.map;
  }

  get classes() {
    const preferences = this.$store.state.preferences;
    const classes = ["gaia-viewer-game"];
    if (preferences) {
      if (preferences.noFactionFill) {
        classes.push("no-faction-fill");
      }
      if (preferences.accessibleSpaceMap) {
        classes.push("accessible-space-map");
      }
    }
    // Planning controls identify the mode; the map keeps its normal appearance.
    if (this.analysisMode) {
      classes.push("analysis-mode-active");
    }
    // Scopes the Lost-Fleet-only layout overrides (65/35 map split, ship rows) so the base game's
    // board layout stays exactly the pre-expansion one.
    if (this.engine.options.lostFleet) {
      classes.push("lost-fleet");
    }
    return classes;
  }

  get player() {
    return currentPlayer(this.engine);
  }

  get turnPlayer() {
    const player = this.player;
    if (player == null) {
      return undefined;
    }

    return this.engine.players[player];
  }

  get sessionPlayer() {
    const player = this.$store.state.player;
    if (player) {
      if (player.index !== undefined) {
        return this.engine.players[player.index];
      }
    }
  }

  get myLockedSeat(): number | undefined {
    const index = this.$store.state.player?.index;
    return index !== undefined && index >= 0 && index < this.engine.players.length ? index : undefined;
  }

  get realEngine(): Engine {
    return this.analysisBackup ?? this.replayData?.backup ?? this.engine;
  }

  get premoveAvailable(): boolean {
    const real = this.realEngine;
    return (
      !this.tutorial &&
      this.isHostedMode &&
      real.automation?.version === 1 &&
      this.myLockedSeat !== undefined &&
      !real.ended &&
      (real.round > 0 ||
        (real.automation.setupPremoves && [Phase.SetupBuilding, Phase.SetupBooster].includes(real.phase)))
    );
  }

  get showPremovePanel(): boolean {
    return (
      this.analysisMode ||
      ((this.premoveAvailable || this.analysisOffered) &&
        (!this.canPlay || !!this.myPremovePlan?.moves.length || !!this.$store.state.pendingPlan))
    );
  }

  get myPremovePlan(): PremovePlan | undefined {
    return this.realEngine.automation?.plans[this.myLockedSeat];
  }

  get premoveNoticeStorageKey(): string {
    // BGS reuses one viewer iframe URL, so use the game's seed plus the player's seat.
    return `premove-notice:${JSON.stringify([this.realEngine.moveHistory[0], this.myLockedSeat])}`;
  }

  submitPremoves(moves: string[], timings?: PremoveTiming[]) {
    const real = this.realEngine;
    const seat = this.myLockedSeat;
    if (seat === undefined || this.$store.state.pendingPlan) return;
    const requestId = globalThis.crypto.randomUUID();
    this.$store.dispatch("submitPlan", {
      type: "premoves",
      requestId,
      moves,
      ...(timings ? { timings } : {}),
      round: real.round,
      turn: real.automation?.turns[seat] ?? 0,
      revision: real.automation?.plans[seat]?.revision ?? 0,
    } as PremoveCommand);
    return requestId;
  }

  cancelPremoves(from = 0) {
    this.submitPremoves((this.myPremovePlan?.moves ?? []).slice(0, from), this.myPremovePlan?.timings?.slice(0, from));
  }

  viewPremoves() {
    if (this.replayData) return;
    const moves = this.myPremovePlan?.moves ?? [];
    if (!moves.length) return;
    if (!this.analysisMode) this.enterAnalysisMode();
    const matching = this.analysisLines.findIndex((entries) => {
      const planned = entries.filter((entry) => entry.kind === "move");
      return moves.every((move, index) => planned[index]?.move === move);
    });
    if (matching >= 0) {
      this.selectAnalysisLine(matching);
      return;
    }
    if (this.analysisEntries.length) {
      if (this.analysisLines.length >= MAX_ANALYSIS_LINES) {
        this.analysisNotice = "Close a plan before opening your queued moves.";
        return;
      }
      this.addAnalysisLine();
    }
    this.setAnalysisEntries(moves.map((move) => ({ kind: "move", move })));
  }

  get analysisOffered(): boolean {
    if (this.tutorial) return false;
    if (this.analysisMode || this.ended) {
      return false;
    }
    if (this.myLockedSeat !== undefined) {
      return true;
    }
    // No locked seat. In self-contained/hot-seat play that is everybody - the device is simply passed
    // to whoever's turn it is - so the sandbox stays offered and enters as the seat on turn. In a
    // HOSTED game it means a spectator, who has no seat of their own: entering would hand them a
    // sandbox of somebody else's seat, with a Commit button that dispatches a move on that player's
    // behalf. Nothing to analyse there, so it is not offered at all.
    return !this.isHostedMode && this.canPlay;
  }

  /** Include the unfinished turn in resource deltas; read live data to retain power assumptions. */
  get analysisStatus(): AnalysisStatus | null {
    if (!this.analysisMode) {
      return null;
    }
    const data = this.engine?.players[this.analysisSeat]?.data;
    return data
      ? computeAnalysisStatus(
          data,
          chargedPowerTotal(this.analysisAppliedEntries) + this.analysisPendingCharge,
          this.analysisOrigin?.players[this.analysisSeat]?.data
        )
      : null;
  }

  // Immediate moves need real resources now; future premoves are checked again at execution.
  get analysisCommitPlan(): AnalysisCommitPlan {
    const empty: AnalysisCommitPlan = { live: null, queued: [], dropped: [], cut: null, limit: "line" };
    if (
      !this.analysisMode ||
      !this.analysisOrigin ||
      this.analysisSeat === null ||
      (this.analysisRolledForward && !this.realEngine.automation?.roundPremoves) ||
      this.$store.state.pendingPlan
    ) {
      return empty;
    }
    // The applied prefix, not the stored line: a tail that does not replay describes a position the
    // sandbox itself never reached, so it can hardly describe moves the real game would accept.
    const entries = this.analysisAppliedEntries;
    const { moves, cut } = analysisCommitPrefix(
      this.analysisOrigin,
      entries,
      this.analysisSeat,
      this.analysisBaseRound,
      this.premoveAvailable ? (this.analysisSeatIsOnTurnForReal ? 1 : 0) : Infinity
    );
    const plan = planAnalysisCommit({
      committable: moves,
      cut,
      lineMoves: entries.filter((e): e is AnalysisMoveEntry => e.kind === "move").map((e) => e.move),
      onTurn: this.analysisSeatIsOnTurnForReal,
      hosted: this.premoveAvailable,
      queueRoom: MAX_PREMOVES - (this.analysisSeatIsOnTurnForReal ? 1 : 0),
    });
    if (this.realEngine.automation?.roundPremoves) {
      const submitted = plan.live === null ? plan.queued : [plan.live, ...plan.queued];
      const moveEntries = entries.filter((entry) => entry.kind === "move");
      plan.timings = submitted.map((_, index) => {
        const { engine } = replayAnalysisLine(
          this.analysisOrigin,
          entries.slice(0, entries.indexOf(moveEntries[index])),
          this.analysisSeat,
          this.analysisBaseRound
        );
        return { round: engine.round, phase: engine.phase };
      });
    }
    return plan;
  }

  /** The plan above as one flat list - what the Commit button counts to decide whether it is
   * offered at all. */
  get analysisCommittableMoves(): string[] {
    const plan = this.analysisCommitPlan;
    return plan.live === null ? plan.queued : [plan.live, ...plan.queued];
  }

  /** Whether the REAL game (not the sandbox clone, whose turn order is always this seat alone) is
   * waiting on the sandbox seat right now - i.e. whether a committed move can be played live at all.
   * Read off `analysisBackup`, which is the untouched real state stashed at entry. */
  get analysisSeatIsOnTurnForReal(): boolean {
    if (!this.analysisBackup || this.analysisSeat === null) {
      return false;
    }
    const real = Engine.fromData(JSON.parse(JSON.stringify(this.analysisBackup)));
    return (
      real.playerToMove === this.analysisSeat &&
      real.round === this.analysisOrigin?.round &&
      real.phase === this.analysisOrigin?.phase
    );
  }

  commitAnalysisLine() {
    if (!this.analysisMode) {
      return;
    }
    const { live, queued, timings } = this.analysisCommitPlan;
    if (live === null && queued.length === 0) {
      return;
    }
    if (this.premoveAvailable) {
      this.analysisSubmission = this.submitPremoves(live === null ? queued : [live, ...queued], timings) ?? null;
      return;
    }
    this.exitAnalysisMode();
    if (live !== null) this.$store.dispatch("move", live);
  }

  enterAnalysisMode() {
    if (this.replayData || this.analysisMode || !this.analysisOffered) {
      return;
    }
    const seat = this.myLockedSeat !== undefined ? this.myLockedSeat : this.engine.playerToMove;
    if (seat === undefined || seat === null) {
      return;
    }
    this.analysisBackup = JSON.parse(JSON.stringify(this.engine));
    this.analysisOrigin = Engine.fromData(JSON.parse(JSON.stringify(this.engine)));
    this.analysisSeat = seat;
    this.analysisRealHistory = [...this.engine.moveHistory];
    this.analysisBaseMoveCount = this.analysisRealHistory.length;
    // Enable planning options before regenerating available commands. Normal costs still apply.
    markAnalysisSeat(this.analysisOrigin, seat);
    // Already passed this round -> roll the clone into the next one instead of handing back a turn in
    // a round this seat is out of (owner instruction, see `advancePastOwnPass`). Must come before the
    // solo switch, which is what used to erase the record of the pass.
    this.analysisRolledForward = advancePastOwnPass(this.analysisOrigin, seat);
    // Solo round flow (§2.5/§3.1) plus opponents' pending decisions - see `settleAnalysisClone` for
    // why that is three calls and not two. Entering while the real game was parked on somebody else's
    // leech answer (the state a live async game spends most of its time in) used to open a sandbox
    // with no commands for this seat at all and no way to play anything.
    settleAnalysisClone(this.analysisOrigin, seat);
    // Read the first playable round from the settled clone, including when entry rolls past
    // our own pass. Setup itself is not a playable round.
    this.analysisBaseRound = Math.max(this.analysisOrigin.round, Round.Round1);
    // Sealed-bid auctions (§2.7) - null the real backend for the duration, so a Preference Split/
    // Silent bid phase submits an ordinary local move instead of going through the server; restored
    // on exit. `analysisMode` (store state, not just this component) is what SealedBidPanel.ts's
    // `mySeats` reads to let every seat's bid be entered here, not just this session's locked one.
    this.analysisSealedBidBackendBackup = this.$store.state.sealedBidBackend;
    this.$store.commit("setSealedBidBackend", null);
    this.$store.commit("setAnalysisMode", true);
    this.analysisMode = true;
    this.analysisNotice = null;
    this.analysisPendingRestore = null;
    this.analysisPendingCharge = 0;
    this.analysisSummaryCache = new Map();
    this.resolveAnalysisStaleness(seat, loadAnalysisLines(seat, this.analysisStorageScope));
  }

  /** Keep planning open across real moves. Every variation loses only the matching actions
   * already played, then replays against the new board. Divergent histories still need review. */
  private reanchorAnalysisLine(payload: any): boolean {
    const seat = this.analysisSeat;
    if (seat === null || !this.analysisOrigin) {
      return false;
    }
    const originHistory = this.analysisRealHistory;
    const incomingHistory: string[] = payload.moveHistory ?? [];
    // Strictly-further-along-the-same-history, the same test the offline mirror uses before it
    // accepts a refresh (offline-mirror.ts's compareMoveHistories): anything else is a divergence.
    //
    // Compared against the REAL history the origin was cloned from, never the clone's own: opening
    // the sandbox during a leech pause, or after this seat had already passed, plays opponents'
    // answers on the clone and pushes each of them onto `analysisOrigin.moveHistory`. That made the
    // clone's history both longer than the real one and different from it, so this test failed on
    // every subsequent opponent turn and the sandbox force-closed instead of re-anchoring - in
    // exactly the states an async game sits in most of the time.
    if (
      incomingHistory.length <= originHistory.length ||
      !originHistory.every((move, index) => move === incomingHistory[index])
    ) {
      return false;
    }
    const incoming = markAnalysisSeat(Engine.fromData(JSON.parse(JSON.stringify(payload))), seat);
    const newMoves = incomingHistory.slice(originHistory.length);
    let played = 0;
    this.analysisLines = this.analysisLines.map((entries) => {
      const result = dropPlayedAnalysisPrefix(incoming, entries, seat, newMoves);
      played = Math.max(played, result.dropped);
      return result.entries;
    });
    const ownMove = ownMoveCount(incoming, newMoves, seat) > 0;

    this.analysisBackup = JSON.parse(JSON.stringify(payload));
    // Unlike `enterAnalysisMode`, nobody chose this moment: the new state can be parked on an
    // opponent's leech answer, which the sandbox would otherwise render as the opponent's own
    // accept/decline buttons with the player unable to continue. `settleAnalysisClone` resolves that
    // and then re-applies the solo turn order, which resolving alone does not do - this path used to
    // stop one call short and hand the board back with the opponent still on turn.
    this.analysisRolledForward = advancePastOwnPass(incoming, seat);
    settleAnalysisClone(incoming, seat);
    this.analysisOrigin = incoming;
    this.analysisRealHistory = [...incomingHistory];
    this.analysisBaseMoveCount = incomingHistory.length;
    // The origin every line is measured against just changed, so every cached tab summary is stale.
    // The memo keys carry `analysisBaseMoveCount`, so this is belt-and-braces rather than the only
    // thing keeping them honest - but it also stops the old origin's entries sitting in memory for
    // the rest of the session.
    this.analysisSummaryCache = new Map();

    // §13: only the OPEN line is replayed here. The others keep their entries and are re-measured
    // the first time each is opened - re-anchoring all of them up front would make an opponent's
    // turn cost one replay per tab instead of one. Their tabs stay honest in the meantime, since
    // `summarizeAnalysisLine` replays each against this same new origin.
    const entries = this.analysisEntries;
    const draft = ownMove ? "" : this.currentMove;
    const pendingCharge = ownMove ? 0 : this.analysisPendingCharge;
    const applied = this.setAnalysisEntries(entries, { prune: false });
    this.analysisPendingCharge = pendingCharge;
    if (draft) this.applyAnalysisMove(draft);
    this.analysisNotice =
      played > 0
        ? `Removed ${played} already played ${played === 1 ? "move" : "moves"} from matching plans. Remaining moves were updated for the current board.`
        : entries.length > 0
          ? "The board changed. Your plans were updated."
          : null;
    if (applied < entries.length) {
      this.analysisNotice = "The board changed. Some planned moves no longer apply; they are kept for you to edit.";
    }
    return true;
  }

  /** Restore all variations on the current board, trimming moves played manually or by a queue.
   * Only a rollback/divergence needs an explicit restore; ordinary progress is automatic. */
  private resolveAnalysisStaleness(seat: number, stored: AnalysisLineSet | null) {
    const fresh = (options: { persist?: boolean } = {}) =>
      this.setAnalysisLineSet(emptyAnalysisLineSet(this.analysisBaseRound, this.analysisBaseMoveCount), options);
    if (!stored) {
      fresh();
      return;
    }
    if (
      stored.baseMoveCount === this.analysisBaseMoveCount &&
      (stored.baseMove === undefined || stored.baseMove === this.analysisRealHistory[stored.baseMoveCount - 1])
    ) {
      this.setAnalysisLineSet(stored, { prune: false });
      return;
    }
    if (
      stored.baseMoveCount > this.analysisBaseMoveCount ||
      (stored.baseMove !== undefined && this.analysisRealHistory[stored.baseMoveCount - 1] !== stored.baseMove)
    ) {
      fresh({ persist: false });
      this.analysisPendingRestore = stored;
      return;
    }
    const newMoves = this.analysisRealHistory.slice(stored.baseMoveCount);
    let played = 0;
    const lines = stored.lines.map((entries) => {
      const result = dropPlayedAnalysisPrefix(this.analysisOrigin, entries, seat, newMoves);
      played = Math.max(played, result.dropped);
      return result.entries;
    });
    const active = lines[normalizeAnalysisLineSet(stored).active] ?? [];
    const applied = this.setAnalysisLineSet({ ...stored, lines }, { prune: false });
    this.analysisNotice =
      played > 0
        ? `Removed ${played} already played ${played === 1 ? "move" : "moves"} from matching plans.`
        : "The board changed. Your plans were updated.";
    if (applied < active.length) {
      this.analysisNotice = "The board changed. Some planned moves no longer apply; they are kept for you to edit.";
    }
  }

  /** A divergent history cannot prove which moves were played. Restore without deleting any. */
  restoreAnalysisLine() {
    if (!this.analysisPendingRestore) return;
    const stored = this.analysisPendingRestore;
    this.analysisPendingRestore = null;
    this.setAnalysisLineSet(stored, { prune: false });
  }

  discardPendingAnalysisLine() {
    this.analysisPendingRestore = null;
    clearAnalysisLine(this.analysisSeat, this.analysisStorageScope);
    this.persistAnalysisLines();
  }

  dismissAnalysisNotice() {
    this.analysisNotice = null;
  }

  /** Decision #2 - discards the board preview but keeps the line (already persisted as each entry
   * committed); re-entering restores it. */
  exitAnalysisMode() {
    if (!this.analysisMode) {
      return;
    }
    const backup = this.analysisBackup;
    this.analysisMode = false;
    this.analysisBackup = null;
    this.analysisOrigin = null;
    this.analysisComposeBase = null;
    this.analysisComposeAssumedPower = 0;
    this.analysisSeat = null;
    this.analysisPendingRestore = null;
    this.analysisRolledForward = false;
    // The strip's in-memory state only. Nothing is being thrown away: every line was persisted as it
    // was played, so re-entering reads them all back - including which one was open (§13).
    this.analysisLines = [[]];
    this.analysisActiveLine = 0;
    this.analysisAppliedCount = 0;
    this.analysisPendingCharge = 0;
    this.analysisRealHistory = [];
    this.analysisLineSummaries = [];
    this.analysisSummaryCache = new Map();
    this.$store.commit("setSealedBidBackend", this.analysisSealedBidBackendBackup);
    this.analysisSealedBidBackendBackup = null;
    this.$store.commit("setAnalysisMode", false);
    this.handleData(Engine.fromData(backup));
  }

  // Partial turns are always replayed from their stable base.
  applyAnalysisMove(move: string) {
    if (!this.analysisComposeBase) {
      return;
    }
    const copy = markAnalysisSeat(
      Engine.fromData(JSON.parse(JSON.stringify(this.analysisComposeBase))),
      this.analysisSeat,
      this.analysisComposeAssumedPower
    );
    if (move) {
      try {
        copy.move(move);
        copy.generateAvailableCommandsIfNeeded();
      } catch {
        return;
      }
    }
    // Charge 1 presses made during this turn land HERE - after the move, on the position the player
    // is looking at - rather than as a line entry ahead of it. See `chargeAnalysisPower`.
    const pending = this.analysisPendingCharge;
    if (pending > 0) {
      try {
        applyLeechAdjustment(copy, this.analysisSeat, pending);
        copy.clearAvailableCommands();
        copy.generateAvailableCommands();
      } catch {
        // Same treatment an illegal adjust entry gets in replayAnalysisLine: drop it, keep the board.
      }
    }
    if (copy.newTurn && (move || pending > 0)) {
      // The turn is complete (or there was no turn and this is a bare charge), so the pending charge
      // becomes a real line entry - after the move, which is the order it was played in and the order
      // that replays back to exactly what was on screen. Cleared before `setAnalysisEntries` only for
      // clarity; that method zeroes it too.
      this.analysisPendingCharge = 0;
      this.setAnalysisEntries([
        ...this.analysisAppliedEntries,
        ...(move ? [{ kind: "move", move } as AnalysisEntry] : []),
        ...(pending > 0 ? [{ kind: "adjust", charge: pending } as AnalysisEntry] : []),
      ]);
      return;
    }
    this.handleData(copy);
  }

  /**
   * The round-0 faction seed (§11) - "analyse as this faction". Builds the whole seat lineup here,
   * at compose time, from the clone as it currently stands, and stores it in the entry: the pool it
   * is drawn from changes as the line is edited, so re-deriving it on every replay could quietly
   * hand the line a different table than the one the player set up.
   *
   * A line can only ever hold one seed, and only as its first entry - it is a jump straight past
   * faction selection, so anything already played in the line was played in the setup it replaces.
   * Rather than refuse a second one, choosing again REPLACES the line, which is what "actually, show
   * me Itars instead" means (and how the picker is labelled once one is applied).
   */
  seedAnalysisFaction(faction: Faction) {
    if (!this.analysisMode || !factionSeedAvailable(this.engine)) {
      return;
    }
    let lineup: Faction[];
    try {
      lineup = buildAnalysisLineup(this.engine, this.analysisSeat, faction);
    } catch {
      return;
    }
    this.setAnalysisEntries([{ kind: "faction", lineup }]);
  }

  /** The faction picker's options (§11) - empty whenever the seed does not apply, which is what
   * Commands.vue's `analysisSeedActive` gates the whole picker on. Names come from the viewer's own
   * `factionName`, so the picker reads like every other faction label in the app. */
  get analysisFactionChoices(): { faction: Faction; name: string }[] {
    if (!this.analysisMode || !factionSeedAvailable(this.engine)) {
      return [];
    }
    return analysisFactionPool(this.engine, this.analysisSeat).map((faction) => ({
      faction,
      name: factionName(faction),
    }));
  }

  /**
   * Sandbox "Charge 1" button (Commands.vue) - one leech adjustment (§4.4) per press, the same
   * fiction the header's charged total already reads, just player-triggered instead of implicit.
   *
   * The charge is applied to the position ON SCREEN. That sounds like a restatement of what the
   * button does, and it is exactly what it did not do (owner-reported bug, 2026-08-20). The entry
   * used to be appended to the line and the whole line replayed, which puts the charge BEFORE any
   * turn currently half-composed - and a half-composed turn is the normal state here, because a free
   * action (burn, a power spend, a resource conversion) leaves the button chain back at the top-level
   * menu with the turn still open, which is precisely when `showAnalysisChargeButtons` shows this
   * button at all. So a player who had spent 4 power that turn, and was therefore looking at a full
   * bowl 1, saw the charge move a token from bowl 2 to bowl 3: correct for the position before the
   * spend, nonsense against the one on screen.
   *
   * A press during a turn is therefore held in `analysisPendingCharge` and applied by
   * `applyAnalysisMove` after that turn's own moves, becoming an `adjust` entry behind the move once
   * the turn completes. With no turn in progress the base engine is already `newTurn`, so the same
   * path commits it straight to the line - which is what it always did, and still the common case.
   */
  chargeAnalysisPower() {
    if (!this.analysisMode) {
      return;
    }
    this.analysisPendingCharge += 1;
    this.applyAnalysisMove(this.currentMove);
  }

  /** Sandbox "Undo Charge" button - unlike the generic Undo above, only takes back a charge, so it
   * can never discard a real move. A charge pressed during the turn in progress is taken back from
   * `analysisPendingCharge` (it is not a line entry yet); otherwise the line's last entry is popped,
   * and only when that entry is itself a charge. */
  undoAnalysisCharge() {
    if (!this.analysisMode) {
      return;
    }
    if (this.analysisPendingCharge > 0) {
      this.analysisPendingCharge -= 1;
      this.applyAnalysisMove(this.currentMove);
      return;
    }
    const entries = this.analysisAppliedEntries;
    if (entries.length === 0 || entries[entries.length - 1].kind !== "adjust") {
      return;
    }
    this.editAnalysisLineKeepingComposedTurn(entries.slice(0, -1));
  }

  /**
   * `setAnalysisEntries`, but the half-composed turn currently on the board survives it.
   *
   * A turn in progress lives only in the displayed engine plus `currentMove` - it is not a line
   * entry until it completes - and `setAnalysisEntries` replays the line from `analysisOrigin`, so
   * on its own it wipes that turn out. For Undo/Reset that is the point; for Undo Charge it is the
   * reported bug: press it after clicking into a build or an action and the half-built turn silently
   * vanished, taking its resource and power changes with it, so the bowls jumped by whatever that
   * turn had spent rather than by the 1 power just taken back - looking for all the world like the
   * charge had gone missing or arrived twice.
   *
   * Re-applying the same partial move string against the edited base is all it takes: the composed
   * turn was legal with MORE power than it now has, so `applyAnalysisMove` may find it no longer
   * replays - which it already treats as a no-op, leaving the board on the edited line.
   *
   * Charge 1 no longer comes through here at all: a charge pressed mid-turn belongs AFTER that turn,
   * not ahead of it, and lives in `analysisPendingCharge` until the turn completes. See
   * `chargeAnalysisPower`.
   */
  private editAnalysisLineKeepingComposedTurn(entries: AnalysisEntry[]) {
    const composed = this.currentMove;
    this.setAnalysisEntries(entries);
    if (composed) {
      this.applyAnalysisMove(composed);
    }
  }

  /** Undo (§1 decision #3) - pop the last entry, replay. A line carrying a tail that no longer
   * applies loses that tail first, in one press: those entries are not on the board, so popping the
   * last of them would look like Undo doing nothing at all. */
  undoLastAnalysisEntry() {
    const entries = this.analysisEntries;
    if (!this.analysisMode) return;
    if (this.currentMove || this.analysisPendingCharge) {
      this.setAnalysisEntries(entries);
      return;
    }
    if (!entries.length) return;
    const applied = Math.min(this.analysisAppliedCount, entries.length);
    this.setAnalysisEntries(applied < entries.length ? entries.slice(0, applied) : entries.slice(0, -1));
  }

  /** Reset (§1 decision #3) - clear the line, replay nothing (back to analysisOrigin as-is). */
  resetAnalysisLine() {
    if (!this.analysisMode) return;
    this.setAnalysisEntries([]);
  }

  /** The line currently on the board - the open tab's entries (§13). A getter rather than a field so
   * that every pre-tabs caller of `analysisEntries` (the header's move count, Undo/Reset gating,
   * `chargedPowerTotal`, the commit plan) keeps meaning "the line you are looking at" without
   * needing to know the strip exists. */
  get analysisEntries(): AnalysisEntry[] {
    return this.analysisLines[this.analysisActiveLine] ?? [];
  }

  /** The part of the open line that is actually ON the board - `analysisEntries` minus any tail that
   * no longer replays. Everything that reads the line to describe the current position (the move
   * count, the charged-power total, the commit plan) reads this; `analysisEntries` is what gets
   * stored. Editing the line builds on this, which is what finally drops a dead tail - and does it
   * on the player's own press rather than silently, behind their back, the moment they opened the
   * tab. */
  get analysisAppliedEntries(): AnalysisEntry[] {
    return this.analysisEntries.slice(0, this.analysisAppliedCount);
  }

  /** The single path that changes the open line's `analysisEntries`: replays the given entries from
   * `analysisOrigin` (never mutates an Engine in place - see replayAnalysisLine), persists the
   * result, and updates the displayed board. Undo/Reset/a newly-committed turn all go through this,
   * so they can never disagree about what the line replays to.
   *
   * `prune` (the default) trims `entries` down to the prefix that actually replayed - during
   * ordinary play that is the whole list anyway, since a just-appended or just-undone entry always
   * replays cleanly against the same `analysisOrigin` it was validated against, so the trim only
   * ever bites when the player has just edited a line that was already carrying a dead tail.
   *
   * `prune: false` is for the paths that ADOPT a line rather than edit one - a stored set on
   * re-entry, a restore, a re-anchor after somebody else moved, switching tabs. Those used to trim
   * too, and the trim was persisted on the spot: an opponent taking the hex your line's third move
   * wanted deleted moves 3..N the instant you looked at that tab, permanently, with no undo. Nothing
   * is deleted now - the tail is kept, `analysisAppliedCount` records where the board stops, the
   * strip flags the line, and the tail gets another chance every time the origin moves on.
   *
   * Returns `applied` so `resolveAnalysisStaleness`/`restoreAnalysisLine` can say what came back. */
  private setAnalysisEntries(entries: AnalysisEntry[], options: { prune?: boolean; persist?: boolean } = {}): number {
    const { engine, applied } = replayAnalysisLine(
      this.analysisOrigin,
      entries,
      this.analysisSeat,
      this.analysisBaseRound
    );
    const kept = options.prune === false ? entries : entries.slice(0, applied);
    this.analysisAppliedCount = applied;
    // A pending mid-turn charge belongs to the turn that was being composed; replacing the line
    // replaces that turn too (see `editAnalysisLineKeepingComposedTurn`, which re-applies it after).
    this.analysisPendingCharge = 0;
    // Replaced rather than spliced: `analysisLines` is a plain array field, and Vue 2 does not
    // observe an index assignment on one - the tab strip's own summary for this line would keep
    // rendering the pre-edit figure.
    this.analysisLines = this.analysisLines.map((line, index) => (index === this.analysisActiveLine ? kept : line));
    this.analysisComposeBase = JSON.parse(JSON.stringify(engine));
    // Read off the live engine before the snapshot above can drop it - see the field's own comment.
    this.analysisComposeAssumedPower = assumedPowerOf(engine, this.analysisSeat);
    // `persist: false` puts a line on the board WITHOUT writing it to storage - see
    // `resolveAnalysisStaleness`'s restore-prompt branch, the only caller that needs it.
    if (options.persist !== false) {
      this.persistAnalysisLines();
    }
    this.refreshAnalysisLineSummaries();
    this.handleData(engine);
    return applied;
  }

  /** Adopts a whole set at once - a stored one on entry, or the re-anchored one after an opponent's
   * turn - and puts its active line on the board. Everything that replaces more than the open line
   * goes through here, so `analysisLines`/`analysisActiveLine`/storage/the strip can never end up
   * describing different sets. Returns what `setAnalysisEntries` returned for the active line. */
  private setAnalysisLineSet(set: AnalysisLineSet, options: { prune?: boolean; persist?: boolean } = {}): number {
    const normalized = normalizeAnalysisLineSet(set);
    this.analysisLines = normalized.lines;
    this.analysisActiveLine = normalized.active;
    return this.setAnalysisEntries(this.analysisEntries, options);
  }

  get analysisStorageScope(): string | undefined {
    return this.isHostedMode ? (this.analysisBackup ?? this.engine)?.moveHistory[0] : undefined;
  }

  private persistAnalysisLines() {
    saveAnalysisLines(
      this.analysisSeat,
      {
        lines: this.analysisLines,
        active: this.analysisActiveLine,
        baseRound: this.analysisBaseRound,
        baseMoveCount: this.analysisBaseMoveCount,
        baseMove: this.analysisRealHistory[this.analysisBaseMoveCount - 1],
      },
      this.analysisStorageScope
    );
  }

  /**
   * Recomputes the strip's per-line outcomes (§13).
   *
   * Deliberately a field refreshed at the few points a line can change, not a computed getter:
   * `analysisOrigin` is a live `Engine` sitting in a component field, so a getter that touched it
   * would re-run on every reactive change anywhere inside that object graph - and each run replays
   * EVERY line, i.e. multiplies the sandbox's per-move engine work by the number of open tabs. The
   * memo below then keeps even these refreshes to just the line that actually changed: keyed on the
   * origin's own move count (so a re-anchor invalidates every entry at once, exactly as it should)
   * plus the line's contents.
   */
  private refreshAnalysisLineSummaries() {
    if (!this.analysisOrigin || this.analysisSeat === null) {
      this.analysisLineSummaries = [];
      return;
    }
    const cache = this.analysisSummaryCache;
    this.analysisLineSummaries = this.analysisLines.map((entries, index) => {
      const key = `${this.analysisBaseMoveCount}:${index}:${JSON.stringify(entries)}`;
      const hit = cache.get(key);
      if (hit) {
        return hit;
      }
      const summary = summarizeAnalysisLine(
        this.analysisOrigin,
        entries,
        this.analysisSeat,
        this.analysisBaseRound,
        index
      );
      cache.set(key, summary);
      return summary;
    });
  }

  /** Open another line (§13). A plain replay of that line from the same origin - which is the whole
   * reason switching is instant and why nothing has to be saved first.
   *
   * A half-composed turn on the board is dropped by this, deliberately and silently: it is not a
   * line entry until it completes (see `applyAnalysisMove`), so it belongs to the line being left
   * and carrying it into a different one would apply it to a board it was never composed against. */
  selectAnalysisLine(index: number) {
    if (!this.analysisMode || index === this.analysisActiveLine || !this.analysisLines[index]) {
      return;
    }
    this.analysisActiveLine = index;
    // `prune: false`: merely LOOKING at a tab must never edit it. Switching used to trim the opened
    // line to whatever still replayed and persist that on the spot, so a line invalidated by an
    // opponent's move was silently shortened by the act of checking on it.
    this.setAnalysisEntries(this.analysisEntries, { prune: false });
  }

  /**
   * The strip's `+` - fork the open line into a new one, and open that (owner instruction,
   * 2026-08-20). It started as an EMPTY new line, on the reasoning that "new line" is what the
   * control says; in use that was backwards. The comparison you actually want is almost always
   * "three moves in, X or Y?", and an empty tab makes you re-click the shared prefix by hand for
   * every alternative - tedious, and worse, a misclick while re-entering it compares two lines that
   * do not share the prefix you think they do. Copying makes forking the default and costs nothing,
   * because Reset already blanks a line in one press for the times you did want to start over.
   *
   * Deep-copied rather than sharing the entry objects: nothing edits an entry in place today (every
   * path replaces the whole array), but two lines pointing at the same objects is a trap waiting for
   * the first path that does, and the entries are small plain data.
   */
  addAnalysisLine() {
    if (!this.analysisMode || this.analysisLines.length >= MAX_ANALYSIS_LINES) {
      return;
    }
    // Forks what is ON the board, not what is stored: a tail that does not replay is not part of the
    // position being forked, and copying it into the new line would start it already broken.
    const fork: AnalysisEntry[] = JSON.parse(JSON.stringify(this.analysisAppliedEntries));
    this.analysisLines = [...this.analysisLines, fork];
    this.analysisActiveLine = this.analysisLines.length - 1;
    this.setAnalysisEntries(fork);
  }

  /** Delete a line. Never the last one - the strip always has an open tab (see
   * `normalizeAnalysisLineSet`), so "delete Line 1 when it is the only line" is Reset, which already
   * exists on the map corner. */
  closeAnalysisLine(index: number) {
    if (!this.analysisMode || this.analysisLines.length <= 1 || !this.analysisLines[index]) {
      return;
    }
    const lines = this.analysisLines.filter((_, i) => i !== index);
    // Closing a tab left of the open one would otherwise shift the open line out from under the
    // index and put a different line on the board than the one the player was looking at.
    const active =
      this.analysisActiveLine > index
        ? this.analysisActiveLine - 1
        : Math.min(this.analysisActiveLine, lines.length - 1);
    this.analysisLines = lines;
    this.analysisActiveLine = active;
    this.setAnalysisEntries(this.analysisEntries, { prune: false });
  }

  handleData(data: Engine, keepMoveHistory?: boolean) {
    for (const sector of document.getElementsByClassName("sector") as any as Element[]) {
      sector.classList.add("notransition");
    }

    this.clearCurrentMove = false;

    // Compute currentMove (popping the last move off the history for display) before
    // committing: the stored state is no longer deeply reactive, so this must happen
    // before the render rather than triggering a second reactive update afterwards.
    if (data.newTurn) {
      this.currentMove = "";
      this.hideLog = false;
      this.setAutoClick([]);
    } else {
      this.currentMove = data.pendingMove || data.moveHistory[data.moveHistory.length - 1] || "";
      data.moveHistory.pop();
    }

    this.$store.commit("receiveData", data);

    setTimeout(() => {
      for (const sector of document.getElementsByClassName("sector") as any as Element[]) {
        sector.classList.remove("notransition");
      }
    });
  }

  handleCommand(command: string, warnings?: BuildWarning[]) {
    if (command.startsWith(Command.Init) || this.engine.round <= 0) {
      this.addMove(command);
      return;
    }

    const move = parseCommands(command)[0];

    if (move.command === Command.EndTurn) {
      this.addMove(this.currentMove + ".");
      return;
    }

    if (this.currentMove && !this.clearCurrentMove) {
      this.addMove(this.currentMove + `. ${command.slice(move.faction.length + 1)}`);
    } else {
      this.clearCurrentMove = false;
      this.addMove(command);
    }
  }

  undoMove() {
    console.log("undo");

    const back = new ExecuteBack();
    this.$store.dispatch("back", back);

    if (back.performed) {
      return;
    }

    const click = this.autoClick;

    const isAutoClickMove = () => {
      const a = click.pop();
      return a && a.every((c) => c);
    };

    do {
      if (this.currentMove.includes(".")) {
        this.currentMove = this.currentMove.slice(0, this.currentMove.lastIndexOf("."));
      } else {
        this.currentMove = "";
      }
    } while (isAutoClickMove());
    this.setAutoClick(click);

    this.addMove(this.currentMove);
  }

  addMove(command: string) {
    this.$store.commit("clearContext");
    const type = this.analysisMode ? "analysisMove" : "move";
    this.$store.dispatch(type, command);
  }
}
</script>

<style lang="scss">
@import "../stylesheets/frontend.scss";
@import "../stylesheets/planets.css";

// Phase 2's plain counter readout (§4) - superseded by the proper sticky-header/map-overlay
// surfaces in Phase 5; this just needs its per-resource spans to not run into each other.
.analysis-counter {
  display: inline-flex;
  gap: 0.5rem;
  font-variant-numeric: tabular-nums;
}

.space-map,
.scoring-research-board {
  max-height: 600px;

  width: 100%;
  display: block;
  height: auto;
}

.game-board-side-column {
  min-width: 0;
}

// Ship boards sit in a FIXED-width left share of this row - `--lf-ship-width` (lostFleetShipsStyle)
// pins it to the exact px-per-unit the research board itself renders at, so the action octagons match
// the base-game power/QIC octagons exactly (owner request) rather than just approximately. The
// round-booster / federation-token Pool sidebar gets whatever's left over, replacing the empty gutter
// that otherwise sat unused to the ships' right. A small gap (owner request: "sit closer... without
// overlapping") keeps the two visually distinct without wasting width the sidebar could use instead.
// `min-width: 0` on the sidebar is the standard flexbox fix that lets it shrink below its content's
// natural width instead of overflowing the row (Pool's flex-wrap content has an intrinsic width).
.lost-fleet-ships-row {
  display: flex;
  // `stretch` (not flex-start) lets the sidebar column match the ship boards' height, so the notes
  // sheet at its bottom can grow to fill the leftover space and the column ends level with the ships.
  align-items: stretch;
  gap: 0.25rem;

  > .lost-fleet-ships {
    flex: 0 0 var(--lf-ship-width, 68%);
    // Keep the ship stack pinned to the top of its (now stretched) flex track rather than centered.
    align-self: flex-start;
  }

  > .lost-fleet-pool-sidebar {
    flex: 1 1 auto;
    min-width: 0;
  }
}

// The sidebar's inner stack: just the Pool now (the notes sheet was removed - per-game notes are
// the hosting platform's job).
.lf-sidebar-col {
  display: flex;
  flex-direction: column;
}

.medium-map,
.small-map {
  flex-wrap: nowrap;
}

@media (max-width: 767px) {
  .small-map,
  .medium-map {
    flex-wrap: wrap;
  }

  // The launcher wraps the game in Bootstrap's container-fluid (15px on either side). Give the
  // boards most of that width back while retaining a deliberate 2px edge gutter, so their rounded
  // outlines do not feel glued to the phone bezel.
  .row.no-gutters.game-board-layout {
    width: calc(100% + 26px);
    margin-right: -13px;
    margin-left: -13px;
  }

  // A concrete intrinsic size on the research SVG plus a non-shrinking vertical flex stack keeps
  // Safari from laying out the ship grid before the research board's painted height has resolved.
  // That was the source of the iPhone-only overlap between the two boards.
  .game-board-side-column {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  // `.research-panel` is the research board's own swipe drawer wrapper (ResearchPanel.vue), which
  // is what actually sits in this column now - the research SVG is its first face.
  .game-board-side-column > .research-panel,
  .game-board-side-column > .lost-fleet-ships-row {
    flex: 0 0 auto;
  }

  .gaia-viewer-game .game-board-layout .scoring-research-board {
    width: 100%;
    max-width: none;
    max-height: none;
    margin-right: 0;
    margin-left: 0;
  }

  .game-board-layout .space-map {
    border-radius: 0.5rem;
  }
}

// ---------------------------------------------------------------------------
// Wide-screen layout (PROGRESS.md: desktop space-usage pass). Phones and tablets keep the stacked
// layout above untouched - everything here is inside a `min-width: 992px` query, and scoped to
// `.game-board-layout` so other embeddings of the same `.gaia-viewer-game` class (e.g. a small
// setup-preview board in its own row) keep their own proportions.
//
// What it fixes: `.space-map`'s 600px height cap (SetupPreviewBoard.vue's unscoped rule is where
// it effectively comes from app-wide) made the near-square map draw at 600x600 inside a 1103px-wide
// column on a 1080p screen - 45% of the map container was empty background, and the map column
// finished 618px short of the research/ships column beside it. `.player-board`'s 700px cap left
// another ~260px unused in each board cell.
//
// 65/35 is the split at which the two columns finish level: the map's height is ~1x its width
// (viewBox aspect 1.007), the side column's is ~1.93x its own (research 1.16 + ship stack 0.77).
// At 1920 that lands the map at 1229x1220 against a 1289px side column, with both filled edge to
// edge instead of centered in their boxes.
// ---------------------------------------------------------------------------
@media (min-width: 992px) {
  // Lost Fleet only: the map needs more of the row (65%) because the side column also carries the
  // ship boards; the base game keeps its long-standing col-md-7 / col-md-5 split.
  .gaia-viewer-game.lost-fleet .game-board-layout {
    align-items: flex-start;

    > .space-map {
      max-height: none;
      flex: 0 0 65%;
      max-width: 65%;
    }

    > .game-board-side-column {
      flex: 0 0 35%;
      max-width: 35%;
    }

    .scoring-research-board {
      max-height: none;
    }
  }

  .gaia-viewer-game .player-info .player-board {
    max-width: none;
  }
}
</style>
