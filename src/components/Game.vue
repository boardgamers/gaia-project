<template>
  <div :class="`${globalStyles}`">
    <div :class="['row', 'no-gutters', 'justify-content-center', engine.players.length > 2 ? 'medium-map' : 'small-map']" v-if="hasMap">
      <SpaceMap :class="['mb-1', 'space-map', 'col-md-7']" />
      <svg class="scoring-research-board" :viewBox="`0 0 480 505`" >
        <ResearchBoard height="450" ref="researchBoard" x=-50  />
        <ScoringBoard class="ml-4" width="90" x="380" y=-25 />
        <BoardAction :scale="17" :transform="`translate(${30 + 45*i}, 480)`" v-for="(action, i) in actions" :key="action" :action="action" />
      </svg>
    </div>
    <div class="row mt-2">
      <TurnOrder v-if="!ended && engine.players.length > 0" class="col-md-4 order-4 order-md-1" />
      <div class="col-md-8 order-1 order-md-2">
        <Commands @command="handleCommand" @undo="undoMove" v-if="canPlay" />
      </div>
      <template v-if="sessionPlayer === undefined">
        <PlayerInfo v-for="player in orderedPlayers" :player='player' :key="player.player" class="col-md-6 order-6" />
      </template>
      <template v-else>
        <PlayerInfo :player='sessionPlayer' class="col-md-6 order-3"/>
        <PlayerInfo v-for="player in orderedPlayers.filter(pl => pl !== sessionPlayer)" :player='player' :key="player.player" class="col-md-6 order-6" />
      </template>
      <Pool class="col-12 order-10 mt-4" />
      <AdvancedLog class="col-12 order-last mt-4" />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import Engine, { Command, Phase, factions, Player, EngineOptions, Expansion, BoardAction as BoardActionEnum } from '@gaia-project/engine';
import AdvancedLog from './AdvancedLog.vue';
import BoardAction from './BoardAction.vue';
import Commands from './Commands.vue';
import Pool from './Pool.vue';
import PlayerInfo from './PlayerInfo.vue';
import ResearchBoard from './ResearchBoard.vue';
import ScoringBoard from './ScoringBoard.vue';
import SpaceMap from './SpaceMap.vue';
import TurnOrder from './TurnOrder.vue';
import { resolve } from 'dns';

@Component<Game>({
  created (this: Game) {
    const unsub = this.$store.subscribeAction(({ type, payload }) => {
      if (type === "gaiaViewer/externalData") {
        this.handleData(Engine.fromData(payload));
        return;
      }
      if (type === "gaiaViewer/replayStart") {
        this.$store.dispatch("gaiaViewer/replayInfo", { start: 1, end: this.engine.moveHistory.length, current: this.engine.moveHistory.length });

        this.replayData = {
          current: this.engine.moveHistory.length,
          backup: JSON.parse(JSON.stringify(this.engine))
        };
        return;
      }
      if (type === "gaiaViewer/replayEnd") {
        const restore = payload || this.replayData?.backup;
        this.replayData = null;
        this.handleData(Engine.fromData(restore));
        return;
      }
      if (type === "gaiaViewer/replayTo") {
        const dest: number = payload;
        const current = this.replayData.current;

        this.replayData.current = dest;

        this.$store.dispatch("gaiaViewer/replayInfo", { start: 1, end: this.replayData.backup.moveHistory.length, current: dest });

        if (dest === current) {
          return;
        }
        if (dest < current) {
          this.handleData(new Engine(this.replayData.backup.moveHistory.slice(0, dest), { ...this.replayData.backup.options, noFedCheck: true }));
          return;
        }

        for (const move of this.replayData.backup.moveHistory.slice(current, dest)) {
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
    PlayerInfo,
    Pool,
    ResearchBoard,
    ScoringBoard,
    SpaceMap,
    TurnOrder
  }
})
export default class Game extends Vue {
  public currentMove = "";
  clearCurrentMove = false;
  // When joining a game
  name = "";

  replayData: {current: number; backup: Engine} = null;

  @Prop()
  options: EngineOptions;

  get engine (): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get expansions () {
    return this.$store.state.gaiaViewer.data.expansions;
  }

  get actions (): BoardActionEnum[] {
    return BoardActionEnum.values(this.expansions);
  }

  get ended () {
    return this.engine.phase === Phase.EndGame;
  }

  get orderedPlayers () {
    const engine = this.engine;

    if (!engine.round || !engine.turnOrder) {
      return engine.players;
    }
    const turnOrder = engine.turnOrder;

    // Do not switch boards anymore now that there's two in  a row
    // if (engine.turnOrder.indexOf(this.player) !== -1) {
    //   turnOrder = turnOrder.slice(turnOrder.indexOf(this.player)).concat(turnOrder.slice(0, turnOrder.indexOf(this.player)));
    // }

    return turnOrder.concat(engine.passedPlayers).map(player => engine.players[player]);
  }

  get canPlay () {
    return !this.ended && (!this.$store.state.gaiaViewer.player || this.sessionPlayer === this.engine.players[this.player]);
  }

  get hasMap () {
    return !!this.$store.state.gaiaViewer.data.map;
  }

  get globalStyles () {
    const preferences = this.$store.state.gaiaViewer.preferences;
    const styles = [];
    if (preferences) {
      if (preferences.noFactionFill) {
        styles.push('no-faction-fill');
      }
      if (preferences.accessibleSpaceMap) {
        styles.push('accessible-space-map');
      }
    }
    return styles.join(" ");
  }

  get player () {
    return this.engine.availableCommands?.[0]?.player;
  }

  get sessionPlayer () {
    const player = this.$store.state.gaiaViewer.player;
    if (player) {
      if (player.index !== undefined) {
        return this.engine.players[player.index];
      }
    }
  }

  handleData (data: Engine, keepMoveHistory?: boolean) {
    console.log("handle data", keepMoveHistory);

    for (const sector of document.getElementsByClassName('sector') as any as Element[]) {
      sector.classList.add("notransition");
    }

    this.$store.commit('gaiaViewer/receiveData', data);

    this.clearCurrentMove = false;

    if (data.newTurn) {
      this.currentMove = "";
    } else {
      this.currentMove = data.moveHistory.pop();
    }

    setTimeout(() => {
      for (const sector of document.getElementsByClassName('sector') as any as Element[]) {
        sector.classList.remove("notransition");
      }
    });
  }

  handleCommand (command: string) {
    if (command.startsWith(Command.Init) || this.engine.round <= 0) {
      this.addMove(command);
      return;
    }

    const move = this.parseMove(command);

    if (move.command === Command.EndTurn) {
      this.addMove(this.currentMove + ".");
      return;
    }

    if (this.currentMove && !this.clearCurrentMove) {
      this.addMove(this.currentMove + `. ${command.slice(move.player.length + 1)}`);
    } else {
      this.clearCurrentMove = false;
      this.addMove(command);
    }
  }

  undoMove () {
    if (this.currentMove.includes(".")) {
      this.currentMove = this.currentMove.slice(0, this.currentMove.lastIndexOf("."));
    } else {
      this.currentMove = "";
    }
    this.addMove(this.currentMove);
  }

  addMove (command: string) {
    this.$store.commit("gaiaViewer/clearContext");
    this.$store.dispatch("gaiaViewer/move", command);
  }

  parseMove (command: string): {player: string; command: string; args: string[]} {
    command = command.trim();

    if (command.includes('.')) {
      return this.parseMove(command.slice(0, command.indexOf('.')));
    }

    const split = command.split(' ');

    return {
      player: split[0],
      command: split[1],
      args: split.slice(2)
    };
  }
}
</script>

<style lang="scss">

@import "../stylesheets/frontend.scss";

.space-map, .scoring-research-board {
  max-height: 600px;

  width: 100%;
  // this is needed for Safari
  height: intrinsic;
}

.medium-map, .small-map {
  flex-wrap: nowrap;
}

@media (max-width: 767px) {
  .small-map, .medium-map {
    flex-wrap: wrap;
  }
}

</style>
