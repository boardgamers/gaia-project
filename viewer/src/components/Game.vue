<template>
  <div :class="classes" id="root">
    <b-modal id="chart-button" title="Victory Points, Resources, and more" size="xl">
      <Charts />
    </b-modal>
    <Rules id="rules" />
    <Rules id="trade" type="trade" />

    <!-- Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md) - enter/exit/undo/reset controls plus
         Phase 2's resource-diff counter (§4), still in plain form. The striped visual treatment and
         the counter's real surfaces (headline in the sticky header, full breakdown pinned to the
         map) are Phase 5 - this bar is a functional placeholder until then. -->
    <div v-if="analysisMode || analysisOffered" class="row">
      <div class="col-12">
        <b-alert
          :show="true"
          :variant="analysisMode ? 'warning' : 'light'"
          class="analysis-mode-bar d-flex align-items-center flex-wrap"
        >
          <template v-if="analysisMode">
            <strong class="mr-2">ANALYSIS — not saved</strong>
            <span class="mr-2 small text-muted">
              {{ analysisEntries.length }} move{{ analysisEntries.length === 1 ? "" : "s" }}
            </span>
            <span v-if="analysisCounter" class="mr-2 small analysis-counter">
              <span :class="{ 'text-danger': analysisCounter.credits.displayed < 0 }"
                >c {{ analysisCounter.credits.displayed }}</span
              >
              <span :class="{ 'text-danger': analysisCounter.ores.displayed < 0 }"
                >o {{ analysisCounter.ores.displayed }}</span
              >
              <span :class="{ 'text-danger': analysisCounter.knowledge.displayed < 0 }"
                >k {{ analysisCounter.knowledge.displayed }}</span
              >
              <span :class="{ 'text-danger': analysisCounter.qics.displayed < 0 }"
                >q {{ analysisCounter.qics.displayed }}</span
              >
              <span :class="{ 'text-danger': analysisCounter.victoryPoints.displayed < 0 }"
                >vp {{ analysisCounter.victoryPoints.displayed }}</span
              >
              <span
                >pw {{ analysisCounter.power.after.area1 }}/{{ analysisCounter.power.after.area2 }}/{{
                  analysisCounter.power.after.area3
                }}</span
              >
              <strong v-if="!analysisCounter.feasible" class="text-danger ml-1">
                infeasible from move {{ analysisCounter.infeasibleFromMove }}
              </strong>
            </span>
            <b-button
              size="sm"
              class="mr-2"
              variant="outline-secondary"
              :disabled="analysisEntries.length === 0"
              @click="undoLastAnalysisEntry"
            >
              Undo last move
            </b-button>
            <b-button
              size="sm"
              class="mr-2"
              variant="outline-secondary"
              :disabled="analysisEntries.length === 0"
              @click="resetAnalysisLine"
            >
              Reset
            </b-button>
            <b-button size="sm" variant="secondary" @click="exitAnalysisMode">Exit analysis mode</b-button>
            <div v-if="analysisPassCapped" class="w-100 small text-muted mt-1">
              Two-round cap reached — Pass is hidden here; Exit or Reset to start a new line.
            </div>
          </template>
          <b-button v-else size="sm" variant="outline-secondary" @click="enterAnalysisMode"
            >Enter analysis mode</b-button
          >
        </b-alert>
      </div>
    </div>

    <template v-if="uiMode === 'graphical'">
      <!-- Turn Order, at the very top of the page (PROGRESS.md Gaia 9) - it used to live further
           down, sharing a row with Commands and order-flipping against it on mobile; a fixed top
           banner is simpler and also gives each player's circle room for a presence dot (green =
           actively viewing this game right now, yellow = present in the lobby or another game,
           grey = no live presence at all - see hosted/presence.ts). Hosted mode instead folds this
           into HostedBar.vue's own top banner (PROGRESS.md Gaia 10), so this standalone banner only
           renders for self-contained/hot-seat play now. -->
      <div class="row" v-if="!ended && engine.players.length > 0 && !isHostedMode">
        <div class="col-12 turn-order-banner">
          <TurnOrder />
        </div>
      </div>
      <!-- Round 0 only (ban/pick/bid/starting buildings/booster): says whose turn it is and what
           they have to do, plus the auction/ban explainer buttons. Deliberately above the map
           rather than down in the commands column - during setup the board matters least and
           "whose turn, doing what" matters most, and the commands column is both below the whole
           map+research row on mobile AND only rendered for the player on turn (`canPlay`), so
           everyone else used to have nothing but a green ring on a turn-order circle to go on.
           Rendered here (not in HostedBar.vue) so hosted and self-contained/hot-seat play get the
           same strip - HostedBar only exists in hosted mode. -->
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
              <rect
                aria-hidden="true"
                class="research-actions-panel"
                :x="researchBoardCanvasMinX + 1"
                y="1"
                :width="researchBoardCanvasWidth - 2"
                :height="researchBoardCanvasHeight - 2"
                rx="9"
                ry="9"
              />
              <ResearchBoard
                :height="researchBoardViewHeight"
                :width="engine.options.lostFleet ? researchBoardContentWidth : undefined"
                ref="researchBoard"
                x="-50"
              />
              <ScoringBoard v-if="!engine.options.lostFleet" class="ml-4" width="90" :x="researchBoardWidth + 20" />
              <!-- Right under the 6 tracks' own bottom edge (BASE_RESEARCH_BOARD_HEIGHT, a fixed
                   5-unit gap) - NOT researchBoardViewHeight, which Lost Fleet's 7th column (round
                   scoring + final scoring, positioned further right) can inflate well past where the
                   tracks themselves actually end, leaving a large visible gap here otherwise. -->
              <BoardAction
                :scale="17"
                :transform="`translate(${45 * i - 20 + boardActionRowXShift}, ${baseResearchBoardHeight + 5})`"
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
            <!-- Right sidebar column: the round-booster/federation Pool on top, then a yellow notes
                 sheet that grows to fill the rest so the column bottoms out level with the ship
                 boards (and so never runs past them on mobile - its height naturally differs with the
                 ship count at 2 vs 3-4 players). -->
            <div class="lost-fleet-pool-sidebar lf-sidebar-col">
              <Pool compact />
              <LostFleetNotes />
            </div>
          </div>
        </div>
      </div>
      <div class="row mt-2">
        <!-- Turn Order used to live in this row (col-md-4, order-flipped against this column on
             mobile) - it's now a banner at the very top of the page instead (Game.vue's
             turn-order-banner, PROGRESS.md Gaia 9). On desktop, a Lost Fleet game narrows this
             column to match the map's own `col-md-7` (`commandsColumnClass`) instead of stretching
             full-width under the research track too - the ship boards live in the research column
             above now (see the map+research row), not here, so this row's remaining col-md-5 is
             simply left empty on desktop. -->
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
            @cancel-premove="cancelTriggerComposeActive ? cancelCancelTriggerCompose() : cancelPremoveMode()"
            @confirm-premove="cancelTriggerComposeActive ? confirmCancelTriggerCompose() : queueCurrentPremove()"
            @sticky-bar-height="stickyBarHeight = $event"
          />
          <!-- The old "Current player" heading + circle here was redundant with the turn-order
               banner at the top of the page (PROGRESS.md Gaia 10) - removed, keeping only the
               premove explainer this block also carried. -->
          <!-- An offline copy of an online game (hosted/offline-mirror.ts) plays only the seats
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
      <AutoLeechFab v-if="showOffTurnAutoLeechFab" :bottom-offset="offTurnAutoLeechBottomOffset" />
    </template>
    <div v-else class="d-flex flex-column">
      <SetupStatus v-if="!ended" />
      <SpaceMap v-if="hasMap" :class="['mb-1', 'space-map', 'col-md-7']" />
      <AdvancedLog :currentMove="currentMove" :hideLog.sync="hideLog" v-if="logPlacement === 'top'" />
      <Commands @command="handleCommand" v-if="canPlay" :currentMove="currentMove" />
      <Table />
      <AdvancedLog :currentMove="currentMove" :hideLog.sync="hideLog" v-if="logPlacement === 'bottom'" />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, {
  BoardAction as BoardActionEnum,
  BuildWarning,
  Command,
  EngineOptions,
  Phase,
  Player,
  PlayerEnum,
  Round,
  ResearchField,
} from "@gaia-project/engine";
import AdvancedLog from "./AdvancedLog.vue";
import BoardAction from "./BoardAction.vue";
import Commands from "./Commands.vue";
import Pool from "./Pool.vue";
import Rules from "./Rules.vue";
import PlayerInfo from "./PlayerInfo.vue";
import ResearchBoard from "./ResearchBoard.vue";
import ResearchPanel from "./ResearchPanel.vue";
import ScoringBoard from "./ScoringBoard.vue";
import SpaceMap from "./SpaceMap.vue";
import LostFleetShips, { SHIP_BOARD_VIEWBOX_WIDTH } from "./LostFleetShips.vue";
import LostFleetNotes from "./LostFleetNotes.vue";
import TurnOrder from "./TurnOrder.vue";
import SetupStatus from "./SetupStatus.vue";
import FactionBrowser from "./FactionBrowser.vue";
import PreferenceSplitBid from "./PreferenceSplitBid.vue";
import SilentAuctionBid from "./SilentAuctionBid.vue";
import PreferenceSplitSummary from "./PreferenceSplitSummary.vue";
import SilentAuctionSummary from "./SilentAuctionSummary.vue";
import { BASE_RESEARCH_BOARD_HEIGHT, isBeforeRound1, researchBoardHeight } from "../logic/utils";
import { isDesktopViewport, watchDesktopViewport } from "../hosted/viewport";
import { parseCommands } from "../logic/recent";
import { LogPlacement } from "../data";
import { ExecuteBack } from "../logic/buttons/types";
import { currentPlayer } from "@gaia-project/engine/wrapper";
import { SealedBidBackend, UiMode } from "../store";
import Table from "./Table.vue";
import { orderedPlayers } from "../data/player";
import { factionName } from "../data/factions";
import {
  CancelTriggerKind,
  CancelTriggerLeechConfig as CancelTriggerLeechConfigType,
  CancelTriggerRow,
  PremoveMode,
  PremoveRow,
} from "../hosted/types";
import { buildSequentialChainPreview } from "../logic/premove-preview";
import {
  AnalysisCounter,
  AnalysisEntry,
  AnalysisResourceSnapshot,
  AnalysisWallet,
  applySoloRoundFlow,
  computeAnalysisCounter,
  grantSandboxWallet,
  loadAnalysisLine,
  markAnalysisSeat,
  passAllowed,
  replayAnalysisLine,
  saveAnalysisLine,
} from "../logic/analysis";
// The three CancelTrigger* step components are registered by PremoveBar now, not here - they render
// inside the sheet rather than in a modal this component owned.
import PremoveBar from "./PremoveBar.vue";
import AutoLeechFab from "./AutoLeechFab.vue";

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
    BoardAction,
    Commands,
    PlayerInfo,
    Pool,
    ResearchBoard,
    ResearchPanel,
    ScoringBoard,
    SpaceMap,
    LostFleetShips,
    LostFleetNotes,
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
    Charts: () => import("./Charts.vue"),
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
  analysisEntries: AnalysisEntry[] = [];
  // Phase 2 (§4) - the sandbox wallet granted on entry (null until entry, since it's derived from
  // the real state at that moment - see enterAnalysisMode) and one resource snapshot per
  // successfully applied line entry, both kept in memory only (never persisted - §3.3 stores only
  // the entry list, and both of these are cheaply re-derived from it on every replay).
  analysisWallet: AnalysisWallet = null;
  analysisSnapshots: AnalysisResourceSnapshot[] = [];
  // Phase 4 (§2.7) - the real sealed-bid backend, stashed on entry and restored on exit, so a
  // simultaneous auction phase (Preference Split/Silent) submits ordinary local moves instead of
  // going through the server while composing inside the sandbox - the same "stash, take over,
  // restore" shape as analysisBackup above, applied to this one piece of global store state.
  analysisSealedBidBackendBackup: SealedBidBackend | null = null;

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
        if (this.analysisMode) {
          this.analysisMode = false;
          this.analysisBackup = null;
          this.analysisOrigin = null;
          this.analysisComposeBase = null;
          this.analysisSeat = null;
          this.analysisWallet = null;
          this.analysisSnapshots = [];
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
    return -50;
  }

  get researchBoardCanvasWidth() {
    // Keep the base game's long-standing research + ScoringBoard framing unchanged. Lost Fleet no
    // longer renders that side board, so its canvas can end exactly at the extension column.
    return this.engine.options.lostFleet ? this.researchBoardContentWidth : this.researchBoardWidth + 170;
  }

  get researchBoardCanvasHeight() {
    if (!this.engine.options.lostFleet) {
      return 550;
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
    return (
      !this.analysisMode &&
      !this.canPlay &&
      !this.ended &&
      this.engine.round >= Round.Round1 &&
      this.myLockedSeat !== undefined
    );
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
    return this.engine.options.lostFleet ? ["order-2", "order-md-1", "col-12", "col-md-7"] : ["col-12"];
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
    // playerToMove moves to an opponent's setup turn.
    if (this.analysisMode) {
      return true;
    }

    const lockedSeat = this.$store.state.player?.index;
    if (lockedSeat !== undefined) {
      return lockedSeat >= 0 && lockedSeat === this.engine.playerToMove;
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
    // Bounds-checked, not a raw passthrough: hosted.ts briefly locks every viewer to an
    // out-of-range placeholder seat (index -1) while it waits to learn the real one (see its own
    // "close a race" comment) - premoveOffered/myQueuedPremoves/etc. below would otherwise treat
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

  /** The entry button's gate: offered on this seat's own real turn, matching the feature's entry
   * point ("you press a button, the board becomes yours") - round 1+ move-phase turns per Phase 3,
   * and (Phase 4, decision #6) any setup sub-phase too: "pick any faction, place mines, take a
   * booster, play on." Excludes the other two board-takeover modes (§3.6) - premove/cancel-trigger
   * compose force `canPlay` true via a forced-turn clone, which would otherwise make this readable
   * as offered mid-compose. This is the ONLY mutual-exclusion mechanism (matching how premove/
   * cancel-trigger already stay exclusive of each other purely through `showPremoveSheet`'s
   * visibility gating, not a runtime cancel) - hiding the entry point is enough, since nothing can
   * dispatch `analysisMode` without it. */
  get analysisOffered(): boolean {
    return !this.analysisMode && !this.premoveMode && !this.cancelTriggerComposeActive && !this.ended && this.canPlay;
  }

  /** Phase 2 (§4) - null while there is no wallet to diff against (not yet entered, or entry
   * happened outside RoundMove - see enterAnalysisMode). Recomputed from `analysisComposeBase`
   * (already up to date after every setAnalysisEntries call) rather than cached, since it is cheap
   * and this keeps it structurally impossible to disagree with what is on screen. */
  get analysisCounter(): AnalysisCounter | null {
    if (!this.analysisMode || !this.analysisWallet || !this.analysisComposeBase) {
      return null;
    }
    const data = this.analysisComposeBase.players[this.analysisSeat]?.data;
    if (!data) {
      return null;
    }
    return computeAnalysisCounter(data, this.analysisWallet, this.analysisSnapshots);
  }

  /** The two-round cap (§3.7) - true once Pass has been stripped from the current position's
   * available commands, so the panel can explain why the button is gone instead of leaving it
   * looking like it simply vanished. */
  get analysisPassCapped(): boolean {
    return (
      this.analysisMode && this.analysisBaseRound !== null && !passAllowed(this.engine.round, this.analysisBaseRound)
    );
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
    // §3.7 - "setup gives you setup plus round 1": a setup-phase entry (round 0) counts as if it
    // started at round 1 for the two-round cap and staleness purposes, since setup is not itself a
    // playable "round" to spend that budget on.
    this.analysisBaseRound = Math.max(this.engine.round, Round.Round1);
    this.analysisBaseMoveCount = this.engine.moveHistory.length;
    // Sandbox wallet (§3.1 step 4/§4.1) - only granted when entry lands already in RoundMove; a
    // setup-phase entry (§2.6/decision #6) withholds it, since extra resources would allow builds
    // setup does not permit.
    const enteringAtRoundMove = this.analysisOrigin.phase === Phase.RoundMove;
    this.analysisWallet = enteringAtRoundMove ? grantSandboxWallet(this.analysisOrigin, seat) : null;
    // Solo round flow (§2.5/§3.1) - safe to call unconditionally, setup or not: pre-seeding
    // `passedPlayers` is a no-op until the engine's own `beginRoundStartPhase` next consults it
    // (still ahead for a setup entry, already past for a round >= 1 one), and the turnOrder shrink +
    // available-commands regenerate inside it only fire when already in RoundMove - which also
    // covers refreshing the stale pre-wallet-grant command list Engine.fromData copied over.
    applySoloRoundFlow(this.analysisOrigin, seat);
    // Sealed-bid auctions (§2.7) - null the real backend for the duration, so a Preference Split/
    // Silent bid phase submits an ordinary local move instead of going through the server; restored
    // on exit. `analysisMode` (store state, not just this component) is what SealedBidPanel.ts's
    // `mySeats` reads to let every seat's bid be entered here, not just this session's locked one.
    this.analysisSealedBidBackendBackup = this.$store.state.sealedBidBackend;
    this.$store.commit("setSealedBidBackend", null);
    this.$store.commit("setAnalysisMode", true);
    // Staleness handling (§3.5) beyond "discard on any mismatch" is Phase 6 - a stored line whose
    // baseMoveCount no longer matches the live game just starts fresh rather than replaying.
    const stored = loadAnalysisLine(seat);
    const entries = stored && stored.baseMoveCount === this.analysisBaseMoveCount ? stored.entries : [];
    this.analysisMode = true;
    this.setAnalysisEntries(entries);
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
    this.analysisSeat = null;
    this.analysisWallet = null;
    this.analysisSnapshots = [];
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
      this.analysisSeat
    );
    if (move) {
      try {
        copy.move(move);
        copy.generateAvailableCommandsIfNeeded();
      } catch {
        return;
      }
      if (copy.newTurn) {
        this.setAnalysisEntries([...this.analysisEntries, { kind: "move", move }]);
        return;
      }
    }
    this.handleData(copy);
  }

  /** Undo (§1 decision #3) - pop the last entry, replay. */
  undoLastAnalysisEntry() {
    if (!this.analysisMode || this.analysisEntries.length === 0) {
      return;
    }
    this.setAnalysisEntries(this.analysisEntries.slice(0, -1));
  }

  /** Reset (§1 decision #3) - clear the line, replay nothing (back to analysisOrigin as-is). */
  resetAnalysisLine() {
    if (!this.analysisMode || this.analysisEntries.length === 0) {
      return;
    }
    this.setAnalysisEntries([]);
  }

  /** The single path that changes `analysisEntries`: replays the given entries from
   * `analysisOrigin` (never mutates an Engine in place - see replayAnalysisLine), persists the
   * result, and updates the displayed board. Undo/Reset/a newly-committed turn all go through this,
   * so they can never disagree about what the line replays to. */
  private setAnalysisEntries(entries: AnalysisEntry[]) {
    const { engine, snapshots, wallet } = replayAnalysisLine(
      this.analysisOrigin,
      entries,
      this.analysisSeat,
      this.analysisBaseRound,
      this.analysisWallet
    );
    this.analysisEntries = entries;
    this.analysisSnapshots = snapshots;
    this.analysisWallet = wallet;
    this.analysisComposeBase = JSON.parse(JSON.stringify(engine));
    saveAnalysisLine(this.analysisSeat, {
      entries,
      baseRound: this.analysisBaseRound,
      baseMoveCount: this.analysisBaseMoveCount,
    });
    this.handleData(engine);
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

.research-actions-panel {
  fill: var(--ui-board-canvas);
  stroke: var(--ui-board-border);
  stroke-width: 1;
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

// The sidebar's inner stack: Pool takes its natural height, while LostFleetNotes starts from a zero
// flex basis and grows into only the remaining height. That keeps the ships (not the textarea's
// intrinsic height) in control of the row bottom in the shorter three-ship mobile layout.
.lf-sidebar-col {
  display: flex;
  flex-direction: column;

  // Tighten the Pool's own bottom margin (1em in the base game) to a compact sidebar gap above the
  // notes sheet, so the two read as one stacked column rather than two far-apart boxes.
  > div > .pool.compact {
    margin-bottom: 0.4rem;
  }
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
// `.game-board-layout` so hosted/SetupPreviewBoard.vue (same `.gaia-viewer-game` class, its own
// row) keeps its small preview proportions.
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
  .gaia-viewer-game .game-board-layout {
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
