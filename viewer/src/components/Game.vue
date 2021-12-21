<template>
  <div :class="classes" id="root">
    <b-modal id="chart-button" title="Victory Points, Resources, and more" size="xl">
      <Charts />
    </b-modal>
    <Rules id="rules" />

    <template v-if="uiMode === 'graphical'">
      <div
        :class="['row', 'no-gutters', 'justify-content-center', engine.players.length > 2 ? 'medium-map' : 'small-map']"
        v-if="hasMap"
      >
        <SpaceMap :class="['mb-1', 'space-map', 'col-md-7']" />
        <svg class="scoring-research-board" :viewBox="`0 0 480 505`">
          <ResearchBoard height="450" ref="researchBoard" x="-50" />
          <ScoringBoard class="ml-4" width="90" x="380" y="-25" />
          <BoardAction
            :scale="17"
            :transform="`translate(${45 * i + 6}, 455)`"
            v-for="(action, i) in actions"
            :key="action"
            :action="action"
          />
        </svg>
      </div>
      <div class="row mt-2">
        <TurnOrder v-if="!ended && engine.players.length > 0" class="col-md-4 order-4 order-md-1" />
        <div class="col-md-8 order-1 order-md-2">
          <Commands @command="handleCommand" v-if="canPlay" :currentMove="currentMove" />
          <div v-else-if="player != null && !ended" class="current-player">
            <h5>Current player</h5>
            <svg viewBox="-1.2 -1.2 2.5 4.5">
              <PlayerCircle :player="engine.players[player]" />
            </svg>
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
import TurnOrder from "./TurnOrder.vue";
import { parseCommands } from "../logic/recent";
import { LogPlacement } from "../data";
import { ExecuteBack } from "../logic/buttons/types";
import { currentPlayer } from "@gaia-project/engine/wrapper";
import { UiMode } from "../store";
import Table from "./Table.vue";
import { orderedPlayers } from "../data/player";

@Component<Game>({
  created(this: Game) {
    const unsub = this.$store.subscribeAction(({ type, payload }) => {
      if (type === "externalData") {
        this.handleData(Engine.fromData(payload));
        return;
      }
      if (type === "replayStart") {
        this.$store.dispatch("replayInfo", {
          start: 1,
          end: this.engine.moveHistory.length,
          current: this.engine.moveHistory.length,
        });

        this.replayData = {
          current: this.engine.moveHistory.length,
          backup: JSON.parse(JSON.stringify(this.engine)),
        };
        return;
      }
      if (type === "replayEnd") {
        const restore = payload || this.replayData?.backup;
        this.replayData = null;
        this.handleData(Engine.fromData(restore));
        return;
      }
      if (type === "replayTo") {
        const dest: number = payload;
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

        return;
      }
    });

    this.$once("hook:beforeDestroy", unsub);
  },
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
  // When joining a game
  name = "";

  replayData: { current: number; backup: Engine } = null;

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

  get engine(): Engine {
    return this.$store.state.data;
  }

  get uiMode(): UiMode {
    return this.$store.state.preferences.uiMode;
  }

  get expansions() {
    return this.$store.state.data.expansions;
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

  get orderedPlayers(): Player[] {
    return orderedPlayers(this.engine);
  }

  get canPlay() {
    return !this.ended && (!this.$store.state.player || this.sessionPlayer === this.engine.players[this.player]);
  }

  get hasMap() {
    return !!this.$store.state.data.map;
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

  get sessionPlayer() {
    const player = this.$store.state.player;
    if (player) {
      if (player.index !== undefined) {
        return this.engine.players[player.index];
      }
    }
  }

  handleData(data: Engine, keepMoveHistory?: boolean) {
    for (const sector of (document.getElementsByClassName("sector") as any) as Element[]) {
      sector.classList.add("notransition");
    }

    this.$store.commit("receiveData", data);

    this.clearCurrentMove = false;

    if (data.newTurn) {
      this.currentMove = "";
      this.hideLog = false;
      this.setAutoClick([]);
    } else {
      this.currentMove = data.moveHistory.pop() ?? "";
    }

    setTimeout(() => {
      for (const sector of (document.getElementsByClassName("sector") as any) as Element[]) {
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
      return a && a.every(c => c);
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
    this.$store.dispatch("move", command);
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
