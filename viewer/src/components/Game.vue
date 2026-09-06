<template>
  <div :class="classes" id="root">
    <b-modal id="chart-button" title="Victory Points, Resources, and more" size="xl">
      <Charts />
    </b-modal>
    <Rules id="rules" />

    <!-- Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §12) - only staleness notices and the
         saved-line prompt live here now, because both have to be readable while sandbox mode is NOT
         active, and Commands.vue is not rendered then. Everything the player actually presses inside
         the sandbox - the controls, the status numbers, and round 0's faction choice - is in
         Commands.vue's header and action area (owner instruction); entering and leaving is the map's
         own corner button. -->
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
            v-if="setupActionsAtTop && canPlay"
            @command="handleCommand"
            :currentMove="currentMove"
            :hide-spacer="true"
            :analysis-mode="analysisMode"
            :analysis-status="analysisStatus"
            :analysis-move-count="analysisAppliedEntries.length"
            :analysis-committable-moves="analysisCommittableMoves.length"
            :analysis-commit-plan="analysisCommitPlan"
            :analysis-faction-choices="analysisFactionChoices"
            :analysis-line-summaries="analysisLineSummaries"
            :analysis-active-line="analysisActiveLine"
            @analysis-seed-faction="seedAnalysisFaction"
            @analysis-commit="commitAnalysisLine"
            @analysis-charge="chargeAnalysisPower"
            @analysis-undo-charge="undoAnalysisCharge"
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
        <SpaceMap
          :class="['mb-1', 'space-map', 'col-md-7']"
          :analysis-offered="analysisOffered"
          :analysis-active="analysisMode"
          :analysis-can-edit="analysisAppliedEntries.length > 0"
          @analysis-toggle="toggleAnalysisMode"
          @analysis-undo="undoLastAnalysisEntry"
          @analysis-reset="resetAnalysisLine"
        />
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
          <!-- The two `alert` banners that used to sit here - one blue for composing a premove, one
               amber for composing a cancel rule - are gone. They described what the bottom bar was
               doing while living at the top of the page, which on a phone is usually scrolled out of
               sight while you compose against it. Both now render inside Commands.vue's own sticky
               bar header (`premove-context`), so the status and the buttons it describes are the
               same object. -->
          <Commands
            @command="handleCommand"
            v-if="canPlay && !setupActionsAtTop"
            :currentMove="currentMove"
            :hide-spacer="true"
            :show-premove-cancel="premoveMode || cancelTriggerComposeActive"
            :show-premove-confirm="(premoveMode && premoveReady) || (cancelTriggerComposeActive && cancelTriggerReady)"
            :premove-confirm-label="
              cancelTriggerComposeActive ? 'Continue' : premoveEditSeq !== null ? 'Save changes' : 'Queue now'
            "
            :premove-context="premoveContext"
            :analysis-mode="analysisMode"
            :analysis-status="analysisStatus"
            :analysis-move-count="analysisAppliedEntries.length"
            :analysis-committable-moves="analysisCommittableMoves.length"
            :analysis-commit-plan="analysisCommitPlan"
            :analysis-faction-choices="analysisFactionChoices"
            :analysis-line-summaries="analysisLineSummaries"
            :analysis-active-line="analysisActiveLine"
            @analysis-seed-faction="seedAnalysisFaction"
            @analysis-commit="commitAnalysisLine"
            @analysis-charge="chargeAnalysisPower"
            @analysis-undo-charge="undoAnalysisCharge"
            @analysis-select-line="selectAnalysisLine"
            @analysis-add-line="addAnalysisLine"
            @analysis-close-line="closeAnalysisLine"
            @cancel-premove="cancelTriggerComposeActive ? cancelCancelTriggerCompose() : cancelPremoveMode()"
            @confirm-premove="cancelTriggerComposeActive ? confirmCancelTriggerCompose() : queueCurrentPremove()"
            @sticky-bar-height="stickyBarHeight = $event"
          />
          <!-- The old "Current player" heading + circle here was redundant with the turn-order
               banner at the top of the page (PROGRESS.md Gaia 10) - removed, keeping only the
               premove explainer this block also carried. -->
          <!-- An offline copy of an online game plays only the seats
               this account holds, and has no premove machinery to offer instead - so without this
               the action area is simply empty while an opponent is on turn, which reads as broken. -->
          <div v-else-if="offlineMirrorWaiting" class="text-muted small">
            Waiting for {{ turnPlayer.name || "the other player" }}. This is your offline copy of an online game, so you
            play only your own seats here; their move arrives the next time you open the game with a connection.
          </div>
          <!-- The premove sheet: the ONE surface the off-turn flow lives on. The cancel-rule
               `b-modal` that used to follow this block is gone - its three stages are steps inside
               the sheet now (`stage`), so the flow never leaves the bottom of the screen. The
               cascade / failure / played-automatically `alert`s that used to follow it are gone for
               the same reason: they rendered in this in-flow column, i.e. above a sheet pinned to the
               bottom of the viewport, which is precisely where they would not be read. They are
               notices inside the sheet body now. -->
          <div v-if="showPremoveSheet" class="mt-2">
            <PremoveBar
              :seat="myLockedSeat"
              :compose-mode-preference="premoveModePreference"
              :sticky-mobile="!canPlay"
              :bottom-offset="0"
              :stage="cancelTriggerStage"
              :watched-seat="cancelTriggerWatchedSeat"
              :draft-move="cancelTriggerDraftMove"
              :editing-atoms="cancelTriggerEditingAtoms"
              :editing-leech-config="cancelTriggerEditingLeechConfig"
              :edit-cascade-notice="premoveEditCascadeNotice"
              @mode-preference="setPremoveModePreference"
              @start-new="onStartNewPremove"
              @start-edit="startEditPremove"
              @start-cancel-trigger="startCancelTriggerPicker"
              @start-edit-cancel-trigger="startEditCancelTrigger"
              @pick-opponent="pickCancelTriggerOpponent"
              @pick-leech="pickCancelTriggerLeech"
              @arm-refine="armCancelTriggerFromRefine"
              @arm-leech="armLeechTrigger"
              @close-cancel-trigger="closeCancelTriggerStep"
              @dismiss-cascade="premoveEditCascadeNotice = null"
              @bar-height="premoveBarHeight = $event"
            />
          </div>
          <!-- Desktop's round-0 slot (mobile's is up under the status strip). Placed after the
               block above rather than inside its v-if/v-else-if chain, so the offline-mirror
               "waiting for X" message still gets to render alongside it. Rendered on turn too (it
               then shows only the already-picked factions, which the picker above no longer
               offers). -->
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
      <!-- Reserves the mobile sticky action bar's height (see Commands.vue's hide-spacer prop)
           at the true end of the page instead of right after Turn Order, where it used to leave a
           large dead gap before the first faction board. Same class/CSS-var contract as the
           in-place spacer it replaces here, so the same media query still collapses it to 0 on
           wide viewports. -->
      <div
        class="mobile-sticky-actions-spacer"
        :style="{ '--sticky-bar-height': totalStickyFooterHeight + 'px' }"
        aria-hidden="true"
      ></div>
      <AutoLeechFab
        v-if="showOffTurnAutoLeechFab"
        :bottom-offset="offTurnAutoLeechBottomOffset"
        :show-passed-cap-options="myLockedSeatHasPassed"
      />
    </template>
    <div v-else class="d-flex flex-column">
      <SetupStatus v-if="!ended" />
      <SpaceMap
        v-if="hasMap"
        :class="['mb-1', 'space-map', 'col-md-7']"
        :analysis-offered="analysisOffered"
        :analysis-active="analysisMode"
        :analysis-can-edit="analysisAppliedEntries.length > 0"
        @analysis-toggle="toggleAnalysisMode"
        @analysis-undo="undoLastAnalysisEntry"
        @analysis-reset="resetAnalysisLine"
      />
      <AdvancedLog :currentMove="currentMove" :hideLog.sync="hideLog" v-if="logPlacement === 'top'" />
      <Commands
        @command="handleCommand"
        v-if="canPlay"
        :currentMove="currentMove"
        :analysis-mode="analysisMode"
        :analysis-status="analysisStatus"
        :analysis-move-count="analysisAppliedEntries.length"
        :analysis-committable-moves="analysisCommittableMoves.length"
        :analysis-commit-plan="analysisCommitPlan"
        :analysis-faction-choices="analysisFactionChoices"
        :analysis-line-summaries="analysisLineSummaries"
        :analysis-active-line="analysisActiveLine"
        @analysis-seed-faction="seedAnalysisFaction"
        @analysis-commit="commitAnalysisLine"
        @analysis-charge="chargeAnalysisPower"
        @analysis-undo-charge="undoAnalysisCharge"
        @analysis-select-line="selectAnalysisLine"
        @analysis-add-line="addAnalysisLine"
        @analysis-close-line="closeAnalysisLine"
      />
      <Table />
      <AdvancedLog :currentMove="currentMove" :hideLog.sync="hideLog" v-if="logPlacement === 'bottom'" />
    </div>
  </div>
</template>

<script lang="ts">
import Engine, {
  BoardAction as BoardActionEnum,
  BuildWarning,
  Command,
  EngineOptions,
  Faction,
  Phase,
  Player,
  PlayerEnum,
  ResearchField,
  Round,
} from "@gaia-project/engine";
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
  analysisLineSetSize,
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
  moveBelongsToSeat,
  normalizeAnalysisLineSet,
  ownMoveCount,
  planAnalysisCommit,
  replayAnalysisLine,
  saveAnalysisLines,
  settleAnalysisClone,
  summarizeAnalysisLine,
} from "../logic/analysis";
import { ExecuteBack } from "../logic/buttons/types";
import type {
  CancelTriggerKind,
  CancelTriggerLeechConfig as CancelTriggerLeechConfigType,
  CancelTriggerRow,
  PremoveMode,
  PremoveRow,
} from "../logic/hosted-types";
import { buildSequentialChainPreview } from "../logic/premove-preview";
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
// The three CancelTrigger* step components are registered by PremoveBar now, not here - they render
// inside the sheet rather than in a modal this component owned.
import AutoLeechFab from "./AutoLeechFab.vue";
import PremoveBar from "./PremoveBar.vue";

const PREMOVE_MODE_PREFERENCE_KEY = "premoveModePreference";

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
    PremoveBar,
    AutoLeechFab,
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
  premoveBarHeight = 0;
  // When joining a game
  name = "";

  replayData: { current: number; backup: Engine } = null;

  // Premove (PREMOVE_PLAN.md) - hosted mode only. `premoveBackup` is the real engine state to
  // restore to once the preview is queued or cancelled (same "stash the real state, swap
  // state.data to a preview, restore later" shape as replayData above). `premoveComposeBase` is
  // the FORCED preview clone startPremove() builds (this seat's turn, any prior queued moves in
  // a Sequential chain already applied) - applyPremoveMove() must always replay the full
  // accumulated move string from this stable base, never from `this.engine` (which handleData()
  // mutates on every partial-move call, so replaying the full string on top of it would
  // re-execute an already-applied partial move) nor from `premoveBackup` (which lacks the
  // "force this seat's turn" override and any prior chain moves).
  premoveMode = false;
  premoveBackup: Engine = null;
  premoveComposeBase: Engine = null;
  premoveSeat: number = null;
  premoveReady = false;
  premoveDraftMove = "";
  // Premove UI redesign (Gaia 9) - null while composing a brand-new entry; the existing row's
  // `seq` while editing one instead (queueCurrentPremove below dispatches editPremove rather than
  // queuePremove in that case). "Stage until confirmed": nothing about the existing row changes
  // until the edit is actually confirmed, so backing out of an edit leaves it untouched.
  premoveEditSeq: number | null = null;
  // One-shot dismissible notice ("N discarded") shown after confirming a Sequential edit that had
  // downstream entries - the count is captured at confirm time since the rows are already gone by
  // the time the notice renders.
  premoveEditCascadeNotice: number | null = null;
  // Phase 3 (§10.1/§10.6) - which mode a FRESH queue (no existing rows yet) should be composed
  // into; once a seat has rows, their shared `mode` column is authoritative instead (see
  // PremoveBar's own `mode` getter). Remembered per-browser.
  premoveModePreference: PremoveMode =
    (typeof localStorage !== "undefined" && (localStorage.getItem(PREMOVE_MODE_PREFERENCE_KEY) as PremoveMode)) ||
    "sequential";

  // Premove cancel rules (§8) - the picker/leech-config/refine screens are steps of the premove
  // sheet's body (`cancelTriggerStage`, passed to PremoveBar as `stage`); they used to be three
  // screens of a b-modal owned here. Composing a move rule takes the board over the same way
  // premove composing does (`cancelTriggerComposeSeat`/`cancelTriggerBackup`/
  // `cancelTriggerComposeBase` mirror premoveSeat/premoveBackup/premoveComposeBase above, but
  // forced to the WATCHED opponent's seat against a resource-relaxed clone instead of this
  // session's own seat).
  cancelTriggerStage: "picker" | "leech" | "refine" | null = null;
  cancelTriggerWatchedSeat: number | null = null;
  cancelTriggerComposeSeat: number | null = null;
  cancelTriggerBackup: Engine = null;
  cancelTriggerComposeBase: Engine = null;
  cancelTriggerReady = false;
  cancelTriggerDraftMove = "";
  // null while composing a brand-new trigger; the existing row's seq while editing one (mirrors
  // premoveEditSeq above).
  cancelTriggerEditingSeq: number | null = null;
  cancelTriggerEditingAtoms: string[] = [];
  cancelTriggerEditingLeechConfig: CancelTriggerLeechConfigType | null = null;

  // Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md) - a non-committing local sandbox: "you
  // press a button, the board becomes yours" (§0). Follows the same "stash the real engine, take
  // the board over, replay from a stable base, restore on exit" shape as premove/cancel-trigger
  // above, but the stable base is `analysisOrigin` (the engine at the moment analysis mode was
  // entered), and the accumulated result is a persisted LINE of many completed turns
  // (`analysisEntries`), not one queued move. `analysisComposeBase` is origin + every committed
  // entry replayed on top - the base the currently in-progress turn composes against, mirroring
  // premoveComposeBase's role for premove. There is no separate "ready"/"confirm" step the way
  // premove has: the moment a turn completes (`newTurn`) it is appended to the line automatically,
  // same as self-contained.ts's own `engine = copy` on a completed move.
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
  // Phase 6 (§3.5) - staleness on re-entry. `analysisNotice` is a one-line, dismissible explanation
  // shown after the line was auto-replayed against a changed board (or cleared, or a forced exit
  // happened) - null the rest of the time. `analysisPendingRestore` holds a stored line that was
  // deliberately NOT auto-replayed because this seat's own real moves happened since it was saved
  // (the one row of §3.5's table that must prompt instead of silently replaying); non-null only
  // while that prompt is showing.
  analysisNotice: string | null = null;
  analysisPendingRestore: AnalysisLineSet | null = null;
  // The sandbox rolled the clone into a later round than the real game is in, because this seat had
  // already passed (`advancePastOwnPass`). Nothing in such a line is committable - the real game has
  // not reached that round - so this is what `analysisCommittableMoves` reads to say so.
  analysisRolledForward = false;

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
        // Real state just arrived - a premove-in-progress preview is no longer meaningful (the
        // board may have changed), so drop it rather than risk building a turn against stale data.
        if (this.premoveMode) {
          this.premoveMode = false;
          this.premoveBackup = null;
          this.premoveSeat = null;
          this.premoveReady = false;
          this.premoveEditSeq = null;
        }
        // Same reasoning for a cancel-trigger move in progress - only the board-takeover half,
        // since the modal (picker/leech-config, which don't depend on stale board state) can stay
        // open. A refine screen mid-edit is genuinely stale too, so that closes as well.
        if (this.cancelTriggerComposeSeat !== null) {
          this.cancelTriggerComposeSeat = null;
          this.cancelTriggerBackup = null;
          this.cancelTriggerComposeBase = null;
          this.cancelTriggerReady = false;
          if (this.cancelTriggerStage === "refine") {
            this.cancelTriggerStage = null;
          }
        }
        // Analysis mode (§3.5/§3.6) - unlike premove/cancel-trigger above, the LINE survives this
        // (decision #2: exiting keeps it, only the live takeover ends) - it was already persisted
        // to localStorage as each entry committed, so nothing here needs to save it again. Mirrors
        // exitAnalysisMode's own cleanup (sealed-bid backend restore, analysisMode store flag) since
        // this is the OTHER path back to the real board, not just a "discard the preview" click.
        // §3.5's "re-anchor and show a notice" (as opposed to premove's silent nuke): the line's
        // baseMoveCount still anchors it to this seat's own future moves, so re-entering runs it
        // straight back through resolveAnalysisStaleness's normal table - nothing needs to happen to
        // the stored line itself here, only a notice explaining why the takeover just closed.
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
          this.analysisNotice =
            "A new move arrived, so sandbox mode closed. Your saved line is still there - Enter sandbox mode to continue where you left off.";
          this.$store.commit("setSealedBidBackend", this.analysisSealedBidBackendBackup);
          this.analysisSealedBidBackendBackup = null;
          this.$store.commit("setAnalysisMode", false);
        }
        this.handleData(Engine.fromData(payload));
        return;
      }
      if (type === "premoveMove") {
        this.applyPremoveMove(payload as string);
        return;
      }
      if (type === "cancelTriggerMove") {
        this.applyCancelTriggerMove(payload as string);
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
    return this.stickyBarHeight + this.premoveBarHeight;
  }

  /** Someone else is on turn in an offline copy of an online game - nothing to play, and nothing
   * else (premove bar, Commands) would otherwise appear to say why. */
  get offlineMirrorWaiting(): boolean {
    return !this.analysisMode && !!this.$store.state.offlineMirror && !!this.turnPlayer && !this.ended && !this.canPlay;
  }

  get showOffTurnAutoLeechFab(): boolean {
    // Owner decision (2026-09): the off-turn Auto-leech FAB is removed from the viewer - the
    // platform's own sidebar now exposes the same auto-leech preferences (see Commands.vue's
    // showAutoLeechSelect). Kept as `false` so the FAB component + preference storage stay intact.
    return false;
  }

  get myLockedSeatHasPassed(): boolean {
    const seat = this.myLockedSeat;
    return seat !== undefined && (this.engine.passedPlayers ?? []).includes(seat);
  }

  get offTurnAutoLeechBottomOffset(): number {
    // ChatNotesPanel independently measures the same off-turn premove bar and uses barHeight + 12,
    // or 24px when there is no sticky bar. Mirror that contract so the two adjacent mobile
    // controls share a baseline instead of drifting into each other vertically.
    return this.premoveBarHeight > 0 ? this.premoveBarHeight + 12 : 24;
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

  // Hosted mode (a "?game=" URL) has its own top banner (HostedBar.vue) with Turn Order folded
  // into it (PROGRESS.md Gaia 10, replacing the old separate standalone banner below) - only
  // self-contained/hot-seat play (no such banner exists) still renders Turn Order here.
  get isHostedMode(): boolean {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("game");
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
    if (this.ended) {
      return false;
    }

    // Composing a cancel trigger plays as the WATCHED opponent's seat, forced onto a disposable
    // clone (§8.3) - never this session's own locked seat, so the ordinary check below would
    // always read false while composing one.
    if (this.cancelTriggerComposeSeat !== null) {
      return true;
    }

    // Analysis mode's setup-phase pass-and-play (§2.6/decision #7) walks EVERY seat's turn inside
    // the clone - a real locked seat would otherwise hide Commands entirely the moment the clone's
    // playerToMove moves to an opponent's setup turn. Round 1 onwards is the opposite: only this seat
    // ever plays, and the only way another seat can be on turn is a decision `resolveOpponentDecisions`
    // could not resolve (§12). Rendering their buttons there is what left a leech offer's accept/
    // decline prompt on screen with the player unable to continue their own line - so the analysis
    // seat's own turn is the gate from round 1 on, and an unresolved pause simply shows nothing to
    // press rather than somebody else's decision.
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
    // Analysis mode (§5.2/§2.10) - scopes the dimmed map stripes (theme.scss) to only this live
    // game, not every setup/open-game preview that shares the same .space-map/.space-map-canvas
    // background rule.
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

  /**
   * Premove (PREMOVE_PLAN.md). The seat this session would premove for: exactly the seat
   * `seatToLock` (host.ts) already resolved into `$store.state.player.index` - whichever of this
   * user's owned seats must act next, falling back to their first owned seat while someone else is
   * on turn. A user who owns ALL seats (test game) never gets a lock at all (`state.player` stays
   * null); a spectator who owns none gets locked to the out-of-range placeholder seat `-1` instead
   * (see `seatToLock`'s doc comment) - the bounds check below excludes both, so `premoveOffered` is
   * automatically false for both - no extra plumbing needed to satisfy "suppress where it makes no
   * sense" (PREMOVE_PLAN.md §7.7).
   */
  get myLockedSeat(): number | undefined {
    const index = this.$store.state.player?.index;
    // Bounds-checked, not a raw passthrough: a hosting app may briefly lock every viewer to an
    // out-of-range placeholder seat (index -1) while it waits to learn the real one (closing a
    // race) - premoveOffered/myQueuedPremoves/etc. below would otherwise treat
    // -1 as a real locked seat and crash calling into the engine with an invalid player index.
    return index !== undefined && index >= 0 && index < this.engine.players.length ? index : undefined;
  }

  get premoveOffered(): boolean {
    return (
      !this.premoveMode &&
      !this.analysisMode &&
      !this.canPlay &&
      !this.ended &&
      this.engine.round >= Round.Round1 &&
      this.myLockedSeat !== undefined &&
      this.myQueuedPremoves.length < 3 &&
      this.engine.previewAvailableCommandsFor(this.myLockedSeat) !== null
    );
  }

  get myQueuedPremoves(): PremoveRow[] {
    const seat = this.myLockedSeat;
    if (seat === undefined) {
      return [];
    }
    return ((this.$store.state.premoves as PremoveRow[]) ?? [])
      .filter((p) => p.seat === seat)
      .sort((a, b) => a.seq - b.seq);
  }

  /** Phase 3 (§10.1) - the mode a NEW composed entry joins: an existing queue's own mode (all of a
   * seat's rows share one), or the remembered preference for a fresh queue. */
  get effectivePremoveMode(): PremoveMode {
    return this.myQueuedPremoves.length > 0 ? this.myQueuedPremoves[0].mode : this.premoveModePreference;
  }

  get showPremoveBar(): boolean {
    return (
      !this.analysisMode &&
      this.engine.round >= Round.Round1 &&
      this.myLockedSeat !== undefined &&
      !this.ended &&
      (this.myQueuedPremoves.length > 0 || this.premoveOffered)
    );
  }

  /**
   * Whether the premove sheet renders at all. Two rules, both about keeping exactly one sheet on
   * screen:
   *
   *  - a cancel-rule step (`cancelTriggerStage`) shows the sheet even when there is nothing
   *    queued, because those steps live inside it now rather than in a modal of their own;
   *  - composing anything hides it, because Commands.vue's own sticky bar IS the sheet during
   *    compose (it carries the move buttons, the confirm pair and now the status band too). Without
   *    the second rule a seat with a queued premove got both bars stacked on top of each other while
   *    composing a cancel rule - `canPlay` is forced true during that compose, so Commands renders,
   *    while `myQueuedPremoves.length > 0` kept this one alive as well.
   */
  get showPremoveSheet(): boolean {
    if (this.premoveMode || this.cancelTriggerComposeActive) {
      return false;
    }
    return this.showPremoveBar || this.cancelTriggerStage !== null;
  }

  /** The status line + caveats Commands.vue's sticky bar header shows while the board is taken over
   * for composing. This is the content of the two `alert` banners that used to sit at the top of the
   * commands column, moved onto the bar it was describing all along. */
  get premoveContext(): { title: string; notes: string[]; variant: "premove" | "trigger" } | null {
    if (this.cancelTriggerComposeActive) {
      return {
        variant: "trigger",
        title: `Cancel rule — playing as ${this.cancelTriggerWatchedFactionName}`,
        notes: this.cancelTriggerReady ? [] : ["Build the move to watch for, then end the turn to continue."],
      };
    }
    if (!this.premoveMode) {
      return null;
    }
    const notes: string[] = [];
    if (!this.premoveReady) {
      notes.push("Build the move you want, then end the turn to queue it.");
    }
    if (this.premoveComposeCaveat) {
      notes.push(this.premoveComposeCaveat);
    }
    if (this.premoveEditDownstreamCount > 0) {
      notes.push(
        `This also discards the ${this.premoveEditDownstreamCount} entr${
          this.premoveEditDownstreamCount === 1 ? "y" : "ies"
        } queued after it.`
      );
    }
    const modeLabel = this.effectivePremoveMode === "sequential" ? "chain" : "fallback";
    return {
      variant: "premove",
      title:
        this.premoveEditSeq !== null
          ? "Editing a queued move"
          : `Adding move ${Math.min(this.myQueuedPremoves.length + 1, 3)} of 3 · ${modeLabel}`,
      notes,
    };
  }

  /** Composing a premove while the game is paused on someone else's charge/income decision is
   * allowed (Engine.previewAvailableCommandsFor), but the preview is built as if that decision were
   * already settled - say so rather than let the board quietly disagree with what lands later.
   * Reads the phase off `premoveBackup` (the real state snapshotted at compose time), because
   * `this.engine` is the forced preview clone while composing and always reads RoundMove. */
  get premoveComposeCaveat(): string | null {
    const phase = (this.premoveBackup as Engine | null)?.phase;
    if (!this.premoveMode || phase === undefined || phase === Phase.RoundMove) {
      return null;
    }
    return phase === Phase.RoundLeech
      ? "A power-charge decision is still open — this previews the board as if it had already been answered."
      : "This round's income hasn't been handed out yet — this preview can show fewer resources than you'll actually have.";
  }

  /** How many entries editing the seat's currently-being-edited Sequential premove would discard -
   * 0 outside an edit, in Priority mode (no cascade there), or if editing the last entry. */
  get premoveEditDownstreamCount(): number {
    if (this.premoveEditSeq === null || this.effectivePremoveMode !== "sequential") {
      return 0;
    }
    return this.myQueuedPremoves.filter((p) => p.seq > this.premoveEditSeq).length;
  }

  // The "played automatically" / failure / cancelled notices used to be read and dismissed here.
  // They are rendered by PremoveBar now (straight off the store), so that everything reporting what
  // happened while you were away arrives on the sheet rather than in this in-flow column.

  setPremoveModePreference(mode: PremoveMode) {
    this.premoveModePreference = mode;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PREMOVE_MODE_PREFERENCE_KEY, mode);
    }
  }

  /** Starts composing a brand-new queued entry (the sheet's "+ Add move" button).
   * `switchingModes` is true when the caller just triggered a mode switch (which clears the
   * existing queue via a separate async dispatch) - in that case `priorMoves` is forced empty
   * rather than read from `myQueuedPremoves`, since those rows may not have been cancelled in the
   * store yet and are about to disappear regardless. */
  onStartNewPremove({ mode, switchingModes }: { mode: PremoveMode; switchingModes: boolean }) {
    const seat = this.myLockedSeat;
    if (seat === undefined || (!switchingModes && this.myQueuedPremoves.length >= 3)) {
      return;
    }
    this.premoveEditSeq = null;
    this.premoveBackup = JSON.parse(JSON.stringify(this.engine));
    this.premoveSeat = seat;
    this.premoveMode = true;
    this.premoveReady = false;

    // Phase 3 (§10.1) - sequential chains: preview the next slot against a clone with every
    // already-queued move applied first. Priority previews always against the SAME fresh current
    // state (empty priorMoves), since every rank is an alternative for the one upcoming turn.
    const priorMoves = !switchingModes && mode === "sequential" ? this.myQueuedPremoves.map((p) => p.move) : [];
    const clone = buildSequentialChainPreview(this.engine, seat, priorMoves);
    this.premoveComposeBase = JSON.parse(JSON.stringify(clone));
    this.handleData(clone);
  }

  /** Starts editing an existing queued entry (PremoveBar's "Edit" button) - previews against a
   * clone with every entry BEFORE this one already applied (Sequential) or the fresh current state
   * (Priority), exactly like composing a new entry at this same position would. Nothing is sent to
   * the server yet ("stage until confirmed") - queueCurrentPremove only calls editPremove once the
   * edit is actually confirmed. */
  startEditPremove(seq: number) {
    const seat = this.myLockedSeat;
    const row = this.myQueuedPremoves.find((p) => p.seq === seq);
    if (seat === undefined || !row) {
      return;
    }
    this.premoveEditSeq = seq;
    this.premoveBackup = JSON.parse(JSON.stringify(this.engine));
    this.premoveSeat = seat;
    this.premoveMode = true;
    this.premoveReady = false;

    const priorMoves =
      row.mode === "sequential" ? this.myQueuedPremoves.filter((p) => p.seq < seq).map((p) => p.move) : [];
    const clone = buildSequentialChainPreview(this.engine, seat, priorMoves);
    this.premoveComposeBase = JSON.parse(JSON.stringify(clone));
    this.handleData(clone);
  }

  cancelPremoveMode() {
    if (!this.premoveBackup) {
      return;
    }
    this.premoveMode = false;
    this.premoveReady = false;
    this.premoveSeat = null;
    this.premoveComposeBase = null;
    this.premoveEditSeq = null;
    const backup = this.premoveBackup;
    this.premoveBackup = null;
    this.handleData(Engine.fromData(backup));
  }

  applyPremoveMove(move: string) {
    // Always replay the FULL accumulated move string from the stable compose-base snapshot taken
    // once in startPremove(), never from `this.engine` - handleData() below commits the (mutated,
    // partial-move-applied) result back into `this.engine` on every call, so cloning from
    // `this.engine` here would re-execute an already-applied partial move on top of itself and
    // throw "Cannot execute a move after executing an incomplete move" the moment a premove needs
    // more than one click to compose. `premoveBackup` alone isn't right either - it lacks the
    // "force this seat's turn" override and any prior Sequential-chain moves that
    // buildSequentialChainPreview baked into premoveComposeBase.
    const copy = Engine.fromData(JSON.parse(JSON.stringify(this.premoveComposeBase)));
    if (move) {
      try {
        copy.move(move);
        copy.generateAvailableCommandsIfNeeded();
      } catch {
        // Invalid partial command while composing a premove - Commands.vue only offers legal
        // buttons in the first place, so this shouldn't normally happen; just ignore it.
        return;
      }
    }
    this.premoveReady = copy.newTurn;
    // `move` is always the FULL accumulated turn line so far (handleCommand builds it up with
    // ". " before ever calling addMove) - capture it now, before handleData resets currentMove to
    // "" the instant a turn completes (same as it does for a real committed move).
    if (copy.newTurn) {
      this.premoveDraftMove = move;
    }
    this.handleData(copy);
  }

  queueCurrentPremove() {
    if (!this.premoveReady || this.premoveSeat === null) {
      return;
    }
    if (this.premoveEditSeq !== null) {
      const discarded = this.premoveEditDownstreamCount;
      this.$store.dispatch("editPremove", {
        seat: this.premoveSeat,
        seq: this.premoveEditSeq,
        move: this.premoveDraftMove,
      });
      this.premoveEditCascadeNotice = discarded > 0 ? discarded : null;
    } else {
      this.$store.dispatch("queuePremove", {
        seat: this.premoveSeat,
        move: this.premoveDraftMove,
        mode: this.effectivePremoveMode,
      });
    }
    this.cancelPremoveMode();
  }

  // ---------------------------------------------------------------------------
  // Premove cancel rules (§8)
  // ---------------------------------------------------------------------------

  get cancelTriggerComposeActive(): boolean {
    return this.cancelTriggerComposeSeat !== null;
  }

  get cancelTriggerWatchedFactionName(): string {
    const seat = this.cancelTriggerWatchedSeat;
    if (seat === null) {
      return "";
    }
    const faction = this.engine.players[seat]?.faction;
    return faction ? factionName(faction) : `seat ${seat}`;
  }

  get myCancelTriggers(): CancelTriggerRow[] {
    const seat = this.myLockedSeat;
    if (seat === undefined) {
      return [];
    }
    return ((this.$store.state.cancelTriggers as CancelTriggerRow[]) ?? []).filter((t) => t.seat === seat);
  }

  /** The sheet's "⚠ Cancel if…" button - swaps its body to the picker step (§8.2). */
  startCancelTriggerPicker() {
    this.cancelTriggerEditingSeq = null;
    this.cancelTriggerEditingAtoms = [];
    this.cancelTriggerEditingLeechConfig = null;
    this.cancelTriggerStage = "picker";
  }

  /** The sheet's armed-rules "Edit" - reopens the config step (leech) or the refine step (move,
   * skipping re-composing the board since the move text is already stored) pre-filled with the
   * rule's current selection. */
  startEditCancelTrigger(seq: number) {
    const row = this.myCancelTriggers.find((t) => t.seq === seq);
    if (!row) {
      return;
    }
    this.cancelTriggerEditingSeq = seq;
    if (row.kind === "leech") {
      this.cancelTriggerEditingLeechConfig = row.config as CancelTriggerLeechConfigType;
      this.cancelTriggerStage = "leech";
    } else {
      this.cancelTriggerWatchedSeat = row.watched_seat;
      this.cancelTriggerDraftMove = row.move;
      this.cancelTriggerEditingAtoms = row.atoms;
      this.cancelTriggerStage = "refine";
    }
  }

  closeCancelTriggerStep() {
    this.cancelTriggerStage = null;
  }

  pickCancelTriggerLeech() {
    this.cancelTriggerStage = "leech";
  }

  /** Picker's faction chip - closes the picker and starts composing on the board, playing as the
   * watched opponent against a resource-relaxed clone (§8.3). */
  pickCancelTriggerOpponent(seat: number) {
    this.cancelTriggerStage = null;
    this.cancelTriggerBackup = JSON.parse(JSON.stringify(this.engine));
    this.cancelTriggerWatchedSeat = seat;
    this.cancelTriggerComposeSeat = seat;
    this.cancelTriggerReady = false;

    const clone = Engine.fromData(JSON.parse(JSON.stringify(this.engine)));
    // Resource-relaxed: inflate credits/ore/knowledge/QIC/power so affordability never limits what
    // can be described - the line is only ever pattern-matched afterward, never executed (§8.3).
    const data = clone.players[seat]?.data;
    if (data) {
      data.credits = 30;
      data.ores = 15;
      data.knowledge = 15;
      data.qics = 10;
      data.power.area1 = 4;
      data.power.area2 = 4;
      data.power.area3 = 4;
    }
    clone.forcePremovePreviewTurn(seat as PlayerEnum);
    clone.generateAvailableCommands();

    this.cancelTriggerComposeBase = JSON.parse(JSON.stringify(clone));
    this.handleData(clone);
  }

  /** Mirrors applyPremoveMove - always replays the full accumulated move string from the stable
   * compose-base snapshot, never from `this.engine` (which handleData mutates on every partial
   * call) nor from `cancelTriggerBackup` (which lacks the forced-turn override). */
  applyCancelTriggerMove(move: string) {
    const copy = Engine.fromData(JSON.parse(JSON.stringify(this.cancelTriggerComposeBase)));
    if (move) {
      try {
        copy.move(move);
        copy.generateAvailableCommandsIfNeeded();
      } catch {
        return;
      }
    }
    this.cancelTriggerReady = copy.newTurn;
    if (copy.newTurn) {
      this.cancelTriggerDraftMove = move;
    }
    this.handleData(copy);
  }

  cancelCancelTriggerCompose() {
    if (!this.cancelTriggerBackup) {
      return;
    }
    const backup = this.cancelTriggerBackup;
    this.cancelTriggerComposeSeat = null;
    this.cancelTriggerBackup = null;
    this.cancelTriggerComposeBase = null;
    this.cancelTriggerReady = false;
    this.cancelTriggerWatchedSeat = null;
    this.handleData(Engine.fromData(backup));
  }

  /** Board's "Continue" confirm - leaves the board (restoring the real state) and opens the refine
   * step (§2.3) rather than arming anything yet. */
  confirmCancelTriggerCompose() {
    if (!this.cancelTriggerReady || !this.cancelTriggerBackup) {
      return;
    }
    const backup = this.cancelTriggerBackup;
    this.cancelTriggerComposeSeat = null;
    this.cancelTriggerBackup = null;
    this.cancelTriggerComposeBase = null;
    this.handleData(Engine.fromData(backup));
    this.cancelTriggerStage = "refine";
  }

  armCancelTriggerFromRefine(atoms: string[]) {
    const seat = this.myLockedSeat;
    const watchedSeat = this.cancelTriggerWatchedSeat;
    if (seat === undefined || watchedSeat === null) {
      return;
    }
    if (this.cancelTriggerEditingSeq !== null) {
      this.$store.dispatch("editCancelTrigger", {
        seat,
        seq: this.cancelTriggerEditingSeq,
        move: this.cancelTriggerDraftMove,
        atoms,
        config: {},
      });
    } else {
      this.$store.dispatch("armCancelTrigger", {
        seat,
        watchedSeat,
        move: this.cancelTriggerDraftMove,
        atoms,
        kind: "move" as CancelTriggerKind,
        config: {},
      });
    }
    this.resetCancelTriggerState();
  }

  armLeechTrigger(config: CancelTriggerLeechConfigType) {
    const seat = this.myLockedSeat;
    if (seat === undefined) {
      return;
    }
    if (this.cancelTriggerEditingSeq !== null) {
      this.$store.dispatch("editCancelTrigger", {
        seat,
        seq: this.cancelTriggerEditingSeq,
        move: "",
        atoms: [],
        config,
      });
    } else {
      this.$store.dispatch("armCancelTrigger", {
        seat,
        watchedSeat: seat,
        move: "",
        atoms: [],
        kind: "leech" as CancelTriggerKind,
        config,
      });
    }
    this.resetCancelTriggerState();
  }

  private resetCancelTriggerState() {
    this.cancelTriggerStage = null;
    this.cancelTriggerWatchedSeat = null;
    this.cancelTriggerDraftMove = "";
    this.cancelTriggerEditingSeq = null;
    this.cancelTriggerEditingAtoms = [];
    this.cancelTriggerEditingLeechConfig = null;
  }

  // ---------------------------------------------------------------------------
  // Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md)
  // ---------------------------------------------------------------------------

  /**
   * The entry button's gate. For a locked (hosted, real-account) seat this is now unconditional -
   * available any phase, any round, **whoever's turn it currently is** - not just "round 1+
   * move-phase turns" or "any setup sub-phase" the way it used to read. That widening turned out to
   * be free, not a new mechanism: `applySoloRoundFlow` (§2.5/§3.1) already forces the clone's
   * `turnOrder`/`currentPlayer` to `seat` outright the moment it reaches `Phase.RoundMove`,
   * regardless of who the real engine's `playerToMove` was at entry, and `grantSandboxWallet` grants
   * directly to `players[seat].data` with no turn dependency either - the ONLY thing that was ever
   * off-turn-hostile was this gate reading `canPlay` (itself genuinely turn-gated, since it also
   * controls `Commands.vue`). A simultaneous sealed-bid round (Silent Auction / Preference Split,
   * §2.7) was the first off-turn case reported - `canPlay` reads false for every seat but whichever
   * one the engine happens to be internally pointing at, even though every seated player has a
   * decision to make at once (`SealedBidPanel.ts`'s own doc comment) - but it turned out to be one
   * instance of a general pattern (any seat, any time) rather than a special case worth its own
   * check. Composing a move/bid once inside already works regardless of turn (Phase 4 nulls the real
   * sealed-bid backend and makes `SealedBidPanel.mySeats` render every seat's form during analysis
   * mode; setup pass-and-play already walks every seat's turn per decision #7) - the gate was always
   * the only thing standing in the way.
   *
   * Excludes the other two board-takeover modes (§3.6) - premove/cancel-trigger compose force
   * `canPlay` true via a forced-turn clone, which would otherwise make this readable as offered
   * mid-compose. This is the ONLY mutual-exclusion mechanism (matching how premove/cancel-trigger
   * already stay exclusive of each other purely through `showPremoveSheet`'s visibility gating, not
   * a runtime cancel) - hiding the entry point is enough, since nothing can dispatch `analysisMode`
   * without it.
   *
   * Pass-and-play / hot-seat (no locked seat) keeps the old `canPlay` gate - `canPlay` itself is
   * already unconditionally true there (no session identity to be "off turn" from; the device is
   * simply passed to whoever's turn it is), so this reduces to "always offered" there too, just
   * without inventing a seat picker for a mode that has no concept of "my seat" to begin with. */
  get analysisOffered(): boolean {
    if (this.analysisMode || this.premoveMode || this.cancelTriggerComposeActive || this.ended) {
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

  /** §12 - the facts the player board cannot show for itself: a compact overdraft summary (the board
   * has the real per-resource numbers, but it scrolls off screen on mobile), how much power the
   * sandbox topped up on its own, and how much the player has told it to assume they charge.
   *
   * Read off the DISPLAYED engine, not `analysisComposeBase`. The base is a plain-JSON snapshot, and
   * `analysisAssumedPower` does not survive `PlayerData.toJSON()` - so reading it there reported 0
   * every single time, which is why a topped-up power cost was invisible. The displayed engine is a
   * live one with the tally intact, and it has the second advantage of covering the turn currently
   * being composed rather than only completed entries: overdrawing mid-compose now shows up while
   * the move is still being built, which is when the player wants to know. */
  get analysisStatus(): AnalysisStatus | null {
    if (!this.analysisMode) {
      return null;
    }
    const data = this.engine?.players[this.analysisSeat]?.data;
    return data
      ? computeAnalysisStatus(data, chargedPowerTotal(this.analysisAppliedEntries) + this.analysisPendingCharge)
      : null;
  }

  /**
   * §6/decision #13's commit path affordability gate, capped further for what this app can actually
   * offer, and expressed as everything the Commit button is about to do: what goes live, what queues
   * behind it, what is left behind and why. `AnalysisCommitConfirm.vue` shows the player exactly this
   * before anything leaves the sandbox and `commitAnalysisLine` then executes the same object, so the
   * log they confirmed and the moves that get played cannot drift apart.
   *
   * Self-contained/hot-seat play has no premove queue at all, so it only ever gets move 1 (§6:
   * "Premoves are hosted-only. In self-contained/offline play, offer move 1 only.") - and only if the
   * real game is actually waiting on this seat, since off turn there is nowhere for a live move to
   * go. Hosted play is capped further by whatever premove room this seat already has left in the real
   * (not analysis) queue, so committing a line never pushes that queue over its own 3-row limit.
   */
  get analysisCommitPlan(): AnalysisCommitPlan {
    const empty: AnalysisCommitPlan = { live: null, queued: [], dropped: [], cut: null, limit: "line" };
    if (!this.analysisMode || !this.analysisOrigin || this.analysisSeat === null || this.analysisRolledForward) {
      return empty;
    }
    // The applied prefix, not the stored line: a tail that does not replay describes a position the
    // sandbox itself never reached, so it can hardly describe moves the real game would accept.
    const entries = this.analysisAppliedEntries;
    const { moves, cut } = analysisCommitPrefix(
      this.analysisOrigin,
      entries,
      this.analysisSeat,
      this.analysisBaseRound
    );
    const queuedForSeat = ((this.$store.state.premoves as PremoveRow[]) ?? []).filter(
      (p) => p.seat === this.analysisSeat
    ).length;
    return planAnalysisCommit({
      committable: moves,
      cut,
      lineMoves: entries.filter((e): e is AnalysisMoveEntry => e.kind === "move").map((e) => e.move),
      onTurn: this.analysisSeatIsOnTurnForReal,
      hosted: this.isHostedMode,
      queueRoom: 3 - queuedForSeat,
    });
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
    return Engine.fromData(JSON.parse(JSON.stringify(this.analysisBackup))).playerToMove === this.analysisSeat;
  }

  /**
   * Decision #13/§6 - the commit path. Exits analysis mode FIRST, discarding the takeover back to
   * the exact real pre-commit state (nothing else could have changed it while analysis mode was
   * active - any real external change would already have force-exited via the `externalData`
   * handler), then dispatches move 1 through the SAME `"move"` pipeline a manually-typed turn
   * already uses (`addMove`) rather than reimplementing its hosted-round-trip/self-contained-
   * persistence behaviour locally, exactly like `queueCurrentPremove` already dispatches through
   * `queuePremove` before calling `cancelPremoveMode`. Moves 2..N (hosted only) queue as Sequential
   * premoves the same way. Unlike a normal exit (decision #2), a commit clears the persisted line -
   * there is nothing left to come back to once part of it has actually been played for real.
   */
  commitAnalysisLine() {
    if (!this.analysisMode) {
      return;
    }
    const seat = this.analysisSeat;
    // Composing off-turn is what the sandbox is FOR, and this used to dispatch move 1 as a live
    // `move` regardless - a move the real game cannot accept, because it is not this seat's turn.
    // The sandbox had already exited and cleared the saved line by then, so the whole line was
    // silently lost. Off turn, every committable move is a premove; nothing goes live. That split
    // lives in `planAnalysisCommit` now, so what the confirmation showed is literally what runs.
    const { live, queued } = this.analysisCommitPlan;
    if (live === null && queued.length === 0) {
      return;
    }
    clearAnalysisLine(seat);
    this.exitAnalysisMode();
    if (live !== null) {
      this.$store.dispatch("move", live);
    }
    for (const move of queued) {
      this.$store.dispatch("queuePremove", { seat, move, mode: "sequential" });
    }
  }

  /** The map-corner button's click handler (§5.4) - one control for both directions, since
   * SpaceMap.vue only ever needs to say "the button was pressed," not decide which way. */
  toggleAnalysisMode() {
    if (this.analysisMode) {
      this.exitAnalysisMode();
    } else {
      this.enterAnalysisMode();
    }
  }

  enterAnalysisMode() {
    if (this.analysisMode || !this.analysisOffered) {
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
    // Mark the seat BEFORE anything below: every step regenerates the available commands, and they
    // must be generated with affordability already lifted (§12) or the board opens showing only what
    // this seat could really pay for.
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
    // §3.7 - "setup gives you setup plus round 1": a setup-phase entry (round 0) counts as if it
    // started at round 1 for the two-round cap and staleness purposes, since setup is not itself a
    // playable "round" to spend that budget on. Read off the CLONE, after the steps above, so a line
    // that was rolled past its own pass gets its two rounds from where it actually starts.
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
    this.resolveAnalysisStaleness(seat, loadAnalysisLines(seat));
  }

  /**
   * Staleness WITHOUT leaving the sandbox (§3.5) - the live counterpart to `resolveAnalysisStaleness`
   * below, which only ever runs on re-entry.
   *
   * An opponent taking their turn used to close sandbox mode outright, every time, and hand back a
   * notice saying so. But the sandbox's whole premise (§2.5's solo round flow) is that opponents do
   * not move inside it, and a line's moves are replayed from scratch against whatever board they are
   * given - so an opponent's turn usually changes nothing about whether the line still works. Being
   * ejected mid-analysis because somebody else built on the far side of the map is the reported bug:
   * the line was treated as invalidated when it plainly was not.
   *
   * So: re-base in place instead. The new real state becomes the origin, the line replays onto it,
   * and the takeover carries on. Only a line that genuinely no longer applies loses anything, and
   * then only the part that does not apply - reported honestly rather than by closing the sandbox.
   *
   * Three cases are deliberately NOT handled here, and fall through to the old force-exit:
   *
   * - **This seat's own move arrived.** The line may be the very thing that was just played (a
   *   commit, or a premove firing), so replaying it would duplicate it. That is exactly the row of
   *   §3.5's table that has to prompt, and the prompt lives on the re-entry path.
   * - **The line's two-round window is gone** (`round > baseRound + 1`, decision #10), which no
   *   amount of re-basing can bring back.
   * - **The history diverged rather than grew** - a rollback, a different game, a re-anchor onto
   *   something that is not a continuation of what the line was built on. Nothing here can be
   *   trusted in that case, so it takes the conservative exit.
   *
   * Returns whether it took ownership of this update; false means the caller should carry on with
   * the force-exit path.
   */
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
    if (incoming.round > this.analysisBaseRound + 1) {
      return false;
    }
    if (incomingHistory.slice(originHistory.length).some((move) => moveBelongsToSeat(incoming, move, seat))) {
      return false;
    }

    this.analysisBackup = JSON.parse(JSON.stringify(payload));
    // Unlike `enterAnalysisMode`, nobody chose this moment: the new state can be parked on an
    // opponent's leech answer, which the sandbox would otherwise render as the opponent's own
    // accept/decline buttons with the player unable to continue. `settleAnalysisClone` resolves that
    // and then re-applies the solo turn order, which resolving alone does not do - this path used to
    // stop one call short and hand the board back with the opponent still on turn.
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
    const applied = this.setAnalysisEntries(entries, { prune: false });
    this.analysisNotice =
      applied < entries.length
        ? `Someone moved, and ${entries.length - applied} of your ${
            entries.length
          } sandbox moves no longer apply - the rest was replayed against the new board. Nothing was deleted; Undo drops what does not fit.`
        : entries.length > 0
          ? "Someone moved. Your sandbox line still applies and was replayed against the new board."
          : null;
    return true;
  }

  /**
   * Staleness on re-entry (§3.5). Compares the stored line's `baseMoveCount` against the live
   * game's current `moveHistory.length` and picks one of four behaviours - `entries`/`baseRound`/
   * `baseMoveCount` on `this` are already set by the caller by this point, so this only ever needs
   * to decide what to replay (if anything) and what, if anything, to tell the player about it:
   *
   * - Unchanged (`baseMoveCount` matches) - restore silently, no notice.
   * - The live game has already moved past the stored line's own two-round window
   *   (`this.engine.round > stored.baseRound + 1`) - clear it; that window is gone regardless of who
   *   moved, so there is nothing left worth replaying.
   * - Only opponents moved since the line was saved - replay automatically (§2.5's solo round flow
   *   makes this safe regardless of how many real opponent turns happened in between), keeping
   *   whichever prefix still applies, with a notice either way.
   * - This seat's own real moves happened since the line was saved - the common "I analysed a line,
   *   then played it" case, where silently replaying it would double the move or throw. Enter with
   *   an empty line and hold the stored one in `analysisPendingRestore` for the player to explicitly
   *   restore or discard instead (mirrors PremoveBar.vue's inline mode-switch confirm, not a raw
   *   `window.confirm`).
   */
  private resolveAnalysisStaleness(seat: number, stored: AnalysisLineSet | null) {
    const fresh = (options: { persist?: boolean } = {}) =>
      this.setAnalysisLineSet(emptyAnalysisLineSet(this.analysisBaseRound, this.analysisBaseMoveCount), options);
    if (!stored || analysisLineSetSize(stored) === 0) {
      fresh();
      return;
    }
    if (stored.baseMoveCount === this.analysisBaseMoveCount) {
      this.setAnalysisLineSet(stored, { prune: false });
      return;
    }
    if (this.engine.round > stored.baseRound + 1) {
      fresh();
      this.analysisNotice =
        stored.lines.length > 1
          ? "Your saved sandbox lines were from an earlier round and no longer apply, so they were cleared."
          : "Your saved sandbox line was from an earlier round and no longer applies, so it was cleared.";
      return;
    }
    const newMoves = this.engine.moveHistory.slice(stored.baseMoveCount);
    if (newMoves.some((move) => moveBelongsToSeat(this.engine, move, seat))) {
      // `persist: false` is the whole point here (owner-reported, 2026-08-20: "it just resets").
      // Opening an empty board and persisting it wrote the empty set straight over the saved line,
      // so the line the prompt was offering to restore had ALREADY been deleted by the time the
      // prompt appeared - it survived only in `analysisPendingRestore`, in memory. Answer the prompt
      // and all was well; do anything else first - leave the sandbox, reload, get force-closed by an
      // incoming move, switch device - and it was gone, with no prompt the next time either. Storage
      // now keeps the line until the player themselves says restore or discard; the first real edit
      // persists over it as usual, because that is the player choosing to start something new.
      fresh({ persist: false });
      this.analysisPendingRestore = stored;
      return;
    }
    // §13: the whole set is adopted, not just the line that was open. The others are replayed lazily
    // - `setAnalysisLineSet` only puts the active one on the board, and each remaining line is
    // measured against the new origin the first time it is opened. Their tabs report the same thing
    // in the meantime, since `summarizeAnalysisLine` replays against this same re-anchored origin.
    const active = stored.lines[normalizeAnalysisLineSet(stored).active] ?? [];
    const applied = this.setAnalysisLineSet(stored, { prune: false });
    this.analysisNotice =
      applied < active.length
        ? `Opponents moved since this line was saved. Replayed ${applied} of ${active.length} moves - the rest no longer applied.`
        : "Opponents moved since this line was saved - replayed against the current board.";
  }

  /**
   * The player's answer to `analysisPendingRestore`'s prompt: replay the stored line anyway.
   *
   * The leading entries this seat has since played FOR REAL are dropped first
   * (`dropPlayedAnalysisPrefix`), which is the whole difference between "restored the rest of my
   * line" and the reported "0 moves restored". Following the line at the table is the case this
   * prompt exists for, and it was the case that worked worst: a straight replay starts at entry 1,
   * which is precisely the move that has just been played and can no longer be played again, so it
   * stopped there - and the more faithfully the line had been followed, the less of it came back.
   *
   * Applied per line, not just the open one: every line in the set shares the same origin, and the
   * moves that have gone live are gone from all of them equally.
   */
  restoreAnalysisLine() {
    const stored = this.analysisPendingRestore;
    if (!stored) {
      return;
    }
    this.analysisPendingRestore = null;
    const normalized = normalizeAnalysisLineSet(stored);
    // How many real moves of this seat's own there are to account for the dropped entries - the
    // budget that stops this from editing a line the player never actually played.
    const budget = ownMoveCount(this.engine, this.engine.moveHistory.slice(stored.baseMoveCount), this.analysisSeat);
    let played = 0;
    const lines = normalized.lines.map((entries) => {
      const result = dropPlayedAnalysisPrefix(
        this.analysisOrigin,
        entries,
        this.analysisSeat,
        this.analysisBaseRound,
        budget
      );
      played = Math.max(played, result.dropped);
      return result.entries;
    });
    const active = lines[normalized.active] ?? [];
    const applied = this.setAnalysisLineSet({ ...normalized, lines }, { prune: false });
    const playedNote =
      played > 0 ? ` ${played} ${played === 1 ? "move was" : "moves were"} already played for real.` : "";
    this.analysisNotice =
      applied < active.length
        ? `Restored ${applied} of ${active.length} remaining moves - the rest no longer applied.${playedNote}`
        : playedNote
          ? `Restored the rest of your saved line.${playedNote}`
          : null;
  }

  /** The player's other answer to `analysisPendingRestore`'s prompt: start fresh instead. The empty
   * line `resolveAnalysisStaleness` already entered with was persisted the moment it called
   * `setAnalysisEntries([])`, so there is nothing left to overwrite here. */
  /** "Discard" on the restore prompt. Now that the prompt no longer destroys the stored line up
   * front (see `resolveAnalysisStaleness`), this is the one place that deletes it - otherwise the
   * discarded line would simply come back the next time the sandbox opened. */
  discardPendingAnalysisLine() {
    this.analysisPendingRestore = null;
    clearAnalysisLine(this.analysisSeat);
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

  /** Mirrors applyPremoveMove/applyCancelTriggerMove - always replays the full accumulated move
   * string from the stable compose-base snapshot. Unlike those two, there is no manual confirm: the
   * instant a turn completes it is committed to the line, exactly as self-contained.ts's own `move`
   * handler commits a completed turn to the real engine. */
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
    if (!this.analysisMode || entries.length === 0) {
      return;
    }
    const applied = Math.min(this.analysisAppliedCount, entries.length);
    this.setAnalysisEntries(applied < entries.length ? entries.slice(0, applied) : entries.slice(0, -1));
  }

  /** Reset (§1 decision #3) - clear the line, replay nothing (back to analysisOrigin as-is). */
  resetAnalysisLine() {
    if (!this.analysisMode || this.analysisEntries.length === 0) {
      return;
    }
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

  private persistAnalysisLines() {
    saveAnalysisLines(this.analysisSeat, {
      lines: this.analysisLines,
      active: this.analysisActiveLine,
      baseRound: this.analysisBaseRound,
      baseMoveCount: this.analysisBaseMoveCount,
    });
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
      if (this.premoveMode && this.premoveReady) {
        this.queueCurrentPremove();
      } else if (this.cancelTriggerComposeActive && this.cancelTriggerReady) {
        this.confirmCancelTriggerCompose();
      }
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
    // Premove (PREMOVE_PLAN.md) / cancel-trigger compose (§8.3): while composing either, commands
    // accumulate against a preview clone only (handled locally by this component's own
    // subscribeAction handler above) and never reach the launcher's real "move" forwarding to the
    // backend - critical for cancel-trigger compose, which plays as an OPPONENT's seat and must
    // never actually commit anything on their behalf.
    const type = this.analysisMode
      ? "analysisMove"
      : this.premoveMode
        ? "premoveMove"
        : this.cancelTriggerComposeActive
          ? "cancelTriggerMove"
          : "move";
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
