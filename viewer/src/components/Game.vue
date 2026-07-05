<template>
  <div :class="classes" id="root">
    <b-modal id="chart-button" title="Victory Points, Resources, and more" size="xl">
      <Charts />
    </b-modal>
    <Rules id="rules" />
    <Rules id="trade" type="trade" />

    <template v-if="uiMode === 'graphical'">
      <div
        :class="['row', 'no-gutters', 'justify-content-center', engine.players.length > 2 ? 'medium-map' : 'small-map']"
        v-if="hasMap"
      >
        <SpaceMap :class="['mb-1', 'space-map', 'col-md-7']" />
        <div class="col-md-5">
          <!-- For Lost Fleet, ResearchBoard itself grows a 7th column (Scoring Board Extension +
               round scoring tiles - see ResearchBoard.vue) in the space ScoringBoard's final
               scoring used to occupy here, before final scoring moved onto the map itself
               (SpaceMap.vue's bottom-right corner) - so ScoringBoard only renders for the base
               game here. -->
          <svg
            class="scoring-research-board"
            :viewBox="`-50 0 ${researchBoardWidth + (engine.options.lostFleet ? 110 : 120) + 50} ${
              engine.options.lostFleet ? researchBoardViewHeight + 60 : 550
            }`"
          >
            <ResearchBoard :height="researchBoardViewHeight" ref="researchBoard" x="-50" />
            <ScoringBoard v-if="!engine.options.lostFleet" class="ml-4" width="90" :x="researchBoardWidth + 20" />
            <!-- Right under the 6 tracks' own bottom edge (BASE_RESEARCH_BOARD_HEIGHT, a fixed
                 5-unit gap) - NOT researchBoardViewHeight, which Lost Fleet's 7th column (round
                 scoring + final scoring, positioned further right) can inflate well past where the
                 tracks themselves actually end, leaving a large visible gap here otherwise. -->
            <BoardAction
              :scale="17"
              :transform="`translate(${45 * i - 20}, ${baseResearchBoardHeight + 5})`"
              v-for="(action, i) in actions"
              :key="action"
              :action="action"
            />
          </svg>
        </div>
      </div>
      <div class="row mt-2" v-if="engine.options.lostFleet">
        <LostFleetShips class="col-12" />
      </div>
      <div class="row mt-2">
        <!-- Mobile order flips once real gameplay starts (round 1+): before that, Commands holds
             the actual setup UI (player count / faction pick / starting build), so it stays first
             like before. From round 1 on, its action buttons live in the mobile sticky bar instead
             (see Commands.vue's showStickyMobileBar) - this column then renders only a spacer
             reserving that bar's height, which used to sit first here, directly under the ship
             board, as a large dead gap before Turn Order. Swapping the order once gameplay starts
             puts Turn Order there instead, with that now-content-free spacer pushed after it. -->
        <TurnOrder
          v-if="!ended && engine.players.length > 0"
          :class="['col-md-4', 'order-md-1', gameplayStarted ? 'order-1' : 'order-2']"
        />
        <div :class="['col-md-8', 'order-md-2', gameplayStarted ? 'order-2' : 'order-1']">
          <div v-if="premoveMode" class="alert alert-info premove-banner">
            <strong>PREMOVE</strong> — plays automatically on your turn.
            <div class="small" v-if="!premoveReady">Build the move you want, then queue it below.</div>
            <div class="mt-2">
              <button
                type="button"
                class="btn btn-sm btn-primary mr-2"
                :disabled="!premoveReady"
                @click="queueCurrentPremove"
              >
                Queue this move
              </button>
              <button type="button" class="btn btn-sm btn-outline-secondary" @click="cancelPremoveMode">Cancel</button>
            </div>
          </div>
          <Commands
            @command="handleCommand"
            v-if="canPlay"
            :currentMove="currentMove"
            :hide-spacer="true"
            @sticky-bar-height="stickyBarHeight = $event"
          />
          <div v-else-if="turnPlayer && !ended" class="current-player">
            <h5>Current player</h5>
            <svg viewBox="-1.2 -1.2 2.5 4.5">
              <PlayerCircle :player="turnPlayer" />
            </svg>
            <div v-if="premoveOffered" class="premove-offer mt-2">
              <button type="button" class="btn btn-sm btn-outline-primary" @click="startPremove">Plan my move ▸</button>
              <div class="text-muted small mt-1" v-if="!premoveExplainerDismissed">
                Premoves play automatically when your turn comes, even if you're offline. If the board changed and
                your move is no longer legal, it's skipped and we'll notify you.
                <button type="button" class="btn btn-link btn-sm p-0" @click="dismissPremoveExplainer">Got it</button>
              </div>
            </div>
          </div>
          <div v-if="myQueuedPremoves.length" class="premove-queue small mt-2">
            <div v-for="p in myQueuedPremoves" :key="`${p.seat}-${p.seq}`">
              Queued: {{ p.move }}
              <button
                type="button"
                class="btn btn-link btn-sm p-0 text-danger"
                @click="cancelQueuedPremove(p.seat, p.seq)"
              >
                ✕
              </button>
            </div>
          </div>
          <div v-if="myUnreadFailures.length" class="alert alert-warning premove-failures small mt-2">
            <div v-for="f in myUnreadFailures" :key="f.id">
              Your premove couldn't be played: {{ f.reason }}
              <button type="button" class="btn btn-link btn-sm p-0" @click="markFailureRead(f.id)">Dismiss</button>
            </div>
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
        <Pool class="col-12 order-10 mt-4" />
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
      <div class="mobile-sticky-actions-spacer" :style="{ '--sticky-bar-height': stickyBarHeight + 'px' }" aria-hidden="true"></div>
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
  ResearchField,
} from "@gaia-project/engine";
import AdvancedLog from "./AdvancedLog.vue";
import BoardAction from "./BoardAction.vue";
import Commands from "./Commands.vue";
import Pool from "./Pool.vue";
import Rules from "./Rules.vue";
import PlayerCircle from "./PlayerCircle.vue";
import PlayerInfo from "./PlayerInfo.vue";
import ResearchBoard from "./ResearchBoard.vue";
import ScoringBoard from "./ScoringBoard.vue";
import SpaceMap from "./SpaceMap.vue";
import LostFleetShips from "./LostFleetShips.vue";
import TurnOrder from "./TurnOrder.vue";
import { BASE_RESEARCH_BOARD_HEIGHT, researchBoardHeight } from "../logic/utils";
import { parseCommands } from "../logic/recent";
import { LogPlacement } from "../data";
import { ExecuteBack } from "../logic/buttons/types";
import { currentPlayer } from "@gaia-project/engine/wrapper";
import { UiMode } from "../store";
import Table from "./Table.vue";
import { orderedPlayers } from "../data/player";
import { PremoveFailureRow, PremoveRow } from "../hosted/types";

const PREMOVE_EXPLAINER_DISMISSED_KEY = "premoveExplainerDismissed";

@Component<Game>({
  components: {
    AdvancedLog,
    BoardAction,
    Commands,
    PlayerCircle,
    PlayerInfo,
    Pool,
    ResearchBoard,
    ScoringBoard,
    SpaceMap,
    LostFleetShips,
    TurnOrder,
    Rules,
    Table,
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
  // When joining a game
  name = "";

  replayData: { current: number; backup: Engine } = null;

  // Premove (PREMOVE_PLAN.md) - hosted mode only. `premoveBackup` is the real engine state to
  // restore to once the preview is queued or cancelled (same "stash the real state, swap
  // state.data to a preview, restore later" shape as replayData above).
  premoveMode = false;
  premoveBackup: Engine = null;
  premoveSeat: number = null;
  premoveReady = false;
  premoveDraftMove = "";
  premoveExplainerDismissed =
    typeof localStorage !== "undefined" && localStorage.getItem(PREMOVE_EXPLAINER_DISMISSED_KEY) === "true";

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

  get ended() {
    return this.engine.phase === Phase.EndGame;
  }

  /** Round 1+ - mirrors Commands.vue's showStickyMobileBar threshold closely enough for mobile
   * layout ordering (see the row using it above): once true, that component's action buttons live
   * in the fixed mobile sticky bar rather than in-flow here. */
  get gameplayStarted(): boolean {
    return this.engine.round >= 1;
  }

  get orderedPlayers(): Player[] {
    return orderedPlayers(this.engine);
  }

  get canPlay() {
    return !this.ended && (!this.$store.state.player || this.sessionPlayer === this.engine.players[this.player]);
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
   * on turn. A user who owns ALL seats (test game) or none at all never gets a lock at all
   * (`state.player` stays null), so `premoveOffered` below is automatically false for both - no
   * extra plumbing needed to satisfy "suppress where it makes no sense" (PREMOVE_PLAN.md §7.7).
   */
  get myLockedSeat(): number | undefined {
    return this.$store.state.player?.index;
  }

  get premoveOffered(): boolean {
    return (
      !this.premoveMode &&
      !this.canPlay &&
      !this.ended &&
      this.myLockedSeat !== undefined &&
      this.engine.previewAvailableCommandsFor(this.myLockedSeat) !== null
    );
  }

  get myQueuedPremoves(): PremoveRow[] {
    return (this.$store.state.premoves as PremoveRow[]) ?? [];
  }

  get myUnreadFailures(): PremoveFailureRow[] {
    return (this.$store.state.premoveFailures as PremoveFailureRow[]) ?? [];
  }

  startPremove() {
    const seat = this.myLockedSeat;
    if (seat === undefined) {
      return;
    }
    this.premoveBackup = JSON.parse(JSON.stringify(this.engine));
    this.premoveSeat = seat;
    this.premoveMode = true;
    this.premoveReady = false;

    const clone = Engine.fromData(JSON.parse(JSON.stringify(this.engine)));
    clone.currentPlayer = seat;
    clone.tempCurrentPlayer = undefined;
    // Force a fresh regeneration, not generateAvailableCommandsIfNeeded(): the JSON clone still
    // carries the REAL currentPlayer's cached availableCommands, which would otherwise be reused
    // as-is despite currentPlayer now being reassigned (same trap Engine.previewAvailableCommandsFor
    // itself avoids for exactly this reason).
    clone.generateAvailableCommands();
    this.handleData(clone);
  }

  cancelPremoveMode() {
    if (!this.premoveBackup) {
      return;
    }
    this.premoveMode = false;
    this.premoveReady = false;
    this.premoveSeat = null;
    const backup = this.premoveBackup;
    this.premoveBackup = null;
    this.handleData(Engine.fromData(backup));
  }

  applyPremoveMove(move: string) {
    const copy = Engine.fromData(JSON.parse(JSON.stringify(this.engine)));
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
    this.$store.dispatch("queuePremove", { seat: this.premoveSeat, move: this.premoveDraftMove });
    this.cancelPremoveMode();
  }

  cancelQueuedPremove(seat: number, seq: number) {
    this.$store.dispatch("cancelPremove", { seat, seq });
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
  // this is needed for Safari
  height: intrinsic;
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
}

.current-player {
  & > svg {
    max-width: 50px;
  }
}
</style>
