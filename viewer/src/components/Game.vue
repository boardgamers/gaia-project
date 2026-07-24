<template>
  <div :class="classes" id="root">
    <b-modal id="chart-button" title="Victory Points, Resources, and more" size="xl">
      <Charts />
    </b-modal>
    <Rules id="rules" />
    <Rules id="trade" type="trade" />

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
          <div v-if="premoveMode" class="alert alert-info premove-banner">
            <strong>{{ premoveEditSeq !== null ? "EDITING PREMOVE" : "PREMOVE" }}</strong> — plays automatically on your
            turn.
            <div class="small" v-if="!premoveReady">Build the move you want, then end the turn to queue it.</div>
            <div class="small text-warning" v-if="premoveEditDownstreamCount > 0">
              This will also discard the {{ premoveEditDownstreamCount }} premove{{
                premoveEditDownstreamCount === 1 ? "" : "s"
              }}
              queued after it.
            </div>
          </div>
          <Commands
            @command="handleCommand"
            v-if="canPlay"
            :currentMove="currentMove"
            :hide-spacer="true"
            :show-premove-cancel="premoveMode"
            :show-premove-confirm="premoveMode && premoveReady"
            :premove-confirm-label="premoveEditSeq !== null ? 'Save changes' : 'Queue now'"
            @cancel-premove="cancelPremoveMode"
            @confirm-premove="queueCurrentPremove"
            @sticky-bar-height="stickyBarHeight = $event"
          />
          <!-- The old "Current player" heading + circle here was redundant with the turn-order
               banner at the top of the page (PROGRESS.md Gaia 10) - removed, keeping only the
               premove explainer this block also carried. -->
          <div
            v-else-if="turnPlayer && !ended && premoveOffered && !premoveExplainerDismissed"
            class="text-muted small"
          >
            Premoves play automatically when your turn comes, even if you're offline. If the board changed and your move
            is no longer legal, it's skipped and we'll notify you.
            <button type="button" class="btn btn-link btn-sm p-0" @click="dismissPremoveExplainer">Got it</button>
          </div>
          <div v-if="showPremoveBar && !premoveMode" class="mt-2">
            <PremoveBar
              :seat="myLockedSeat"
              :compose-mode-preference="premoveModePreference"
              :sticky-mobile="!canPlay"
              :bottom-offset="0"
              @mode-preference="setPremoveModePreference"
              @start-new="onStartNewPremove"
              @start-edit="startEditPremove"
              @bar-height="premoveBarHeight = $event"
            />
          </div>
          <div v-if="premoveEditCascadeNotice !== null" class="alert alert-light small mt-2 py-1 px-2">
            Premove updated - {{ premoveEditCascadeNotice }} queued move{{
              premoveEditCascadeNotice === 1 ? "" : "s"
            }}
            after it {{ premoveEditCascadeNotice === 1 ? "was" : "were" }} discarded since they depended on it.
            <button type="button" class="btn btn-link btn-sm p-0" @click="premoveEditCascadeNotice = null">
              Dismiss
            </button>
          </div>
          <div v-if="myUnreadFailures.length" class="alert alert-warning premove-failures small mt-2">
            <div v-for="f in myUnreadFailures" :key="f.id">
              Your premove couldn't be played: {{ f.reason }}
              <button type="button" class="btn btn-link btn-sm p-0" @click="markFailureRead(f.id)">Dismiss</button>
            </div>
          </div>
          <div v-if="premovePlayedNotice" class="alert alert-light premove-played small mt-2 py-1 px-2">
            Played automatically from your queue{{ premovePlayedNoticeSuffix }}: {{ premovePlayedNotice.move }}
            <button type="button" class="btn btn-link btn-sm p-0" @click="dismissPremovePlayedNotice">Dismiss</button>
          </div>
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
import ScoringBoard from "./ScoringBoard.vue";
import SpaceMap from "./SpaceMap.vue";
import LostFleetShips, { SHIP_BOARD_VIEWBOX_WIDTH } from "./LostFleetShips.vue";
import LostFleetNotes from "./LostFleetNotes.vue";
import TurnOrder from "./TurnOrder.vue";
import { BASE_RESEARCH_BOARD_HEIGHT, researchBoardHeight } from "../logic/utils";
import { parseCommands } from "../logic/recent";
import { LogPlacement } from "../data";
import { ExecuteBack } from "../logic/buttons/types";
import { currentPlayer } from "@gaia-project/engine/wrapper";
import { UiMode } from "../store";
import Table from "./Table.vue";
import { orderedPlayers } from "../data/player";
import { PremoveFailureRow, PremoveMode, PremoveRow } from "../hosted/types";
import { buildSequentialChainPreview } from "../logic/premove-preview";
import PremoveBar from "./PremoveBar.vue";
import AutoLeechFab from "./AutoLeechFab.vue";

const PREMOVE_EXPLAINER_DISMISSED_KEY = "premoveExplainerDismissed";
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
    ScoringBoard,
    SpaceMap,
    LostFleetShips,
    LostFleetNotes,
    TurnOrder,
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
  premoveExplainerDismissed =
    typeof localStorage !== "undefined" && localStorage.getItem(PREMOVE_EXPLAINER_DISMISSED_KEY) === "true";
  // Phase 3 (§10.1/§10.6) - which mode a FRESH queue (no existing rows yet) should be composed
  // into; once a seat has rows, their shared `mode` column is authoritative instead (see
  // PremoveModal's own `mode` getter). Remembered per-browser like the explainer dismissal above.
  premoveModePreference: PremoveMode =
    (typeof localStorage !== "undefined" && (localStorage.getItem(PREMOVE_MODE_PREFERENCE_KEY) as PremoveMode)) ||
    "sequential";

  @Prop()
  options: EngineOptions;

  mounted() {
    const undoListener = this.$store.subscribeAction(({ type, payload }) => {
      if (type === "undo") {
        this.undoMove();
      }
    });
    this.$on("hook:beforeDestroy", () => undoListener());
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
        this.handleData(Engine.fromData(payload));
        return;
      }
      if (type === "premoveMove") {
        this.applyPremoveMove(payload as string);
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

  get showOffTurnAutoLeechFab(): boolean {
    return !this.canPlay && !this.ended && this.engine.round >= Round.Round1 && this.myLockedSeat !== undefined;
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

  get canPlay() {
    if (this.ended) {
      return false;
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
      this.engine.round >= Round.Round1 &&
      this.myLockedSeat !== undefined &&
      !this.ended &&
      (this.myQueuedPremoves.length > 0 || this.premoveOffered)
    );
  }

  /** How many entries editing the seat's currently-being-edited Sequential premove would discard -
   * 0 outside an edit, in Priority mode (no cascade there), or if editing the last entry. */
  get premoveEditDownstreamCount(): number {
    if (this.premoveEditSeq === null || this.effectivePremoveMode !== "sequential") {
      return 0;
    }
    return this.myQueuedPremoves.filter((p) => p.seq > this.premoveEditSeq).length;
  }

  get premovePlayedNotice(): { seat: number; move: string; rank?: number; totalRanks?: number } | null {
    return this.$store.state.premovePlayedNotice ?? null;
  }

  get premovePlayedNoticeSuffix(): string {
    const notice = this.premovePlayedNotice;
    return notice?.rank && notice.totalRanks && notice.totalRanks > 1
      ? ` (priority ${notice.rank} of ${notice.totalRanks})`
      : "";
  }

  dismissPremovePlayedNotice() {
    this.$store.commit("dismissPremovePlayedNotice");
  }

  setPremoveModePreference(mode: PremoveMode) {
    this.premoveModePreference = mode;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PREMOVE_MODE_PREFERENCE_KEY, mode);
    }
  }

  get myUnreadFailures(): PremoveFailureRow[] {
    return (this.$store.state.premoveFailures as PremoveFailureRow[]) ?? [];
  }

  /** Starts composing a brand-new queued entry (PremoveBar's "+ Sequential"/"+ Priority" buttons).
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

  markFailureRead(id: string) {
    this.$store.dispatch("markPremoveFailureRead", id);
  }

  dismissPremoveExplainer() {
    this.premoveExplainerDismissed = true;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PREMOVE_EXPLAINER_DISMISSED_KEY, "true");
    }
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
    // Premove (PREMOVE_PLAN.md): while composing a premove, commands accumulate against the
    // preview clone only (handled locally by this component's own subscribeAction handler above)
    // and never reach the launcher's real "move" forwarding to the backend.
    this.$store.dispatch(this.premoveMode ? "premoveMove" : "move", command);
  }
}
</script>

<style lang="scss">
@import "../stylesheets/frontend.scss";
@import "../stylesheets/planets.css";

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

  .game-board-side-column > .scoring-research-board,
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
</style>
