<template>
  <div :class="{['no-faction-fill']: $store.state.gaiaViewer.preferences && $store.state.gaiaViewer.preferences.noFactionFill}">
    <div :class="['row', 'no-gutters', 'justify-content-center', data.players.length > 2 ? 'medium-map' : 'small-map']" v-if="hasMap">
      <SpaceMap :class="['mb-1', 'space-map']" />
      <svg class="scoring-research-board" :viewBox="`0 0 ${scoringX + 90} 450`">
        <ResearchBoard :height="450" ref="researchBoard"/>
        <ScoringBoard class="ml-4" height="450" width="90" :x="scoringX" />
      </svg>
    </div>
    <div class="row mt-2">
      <TurnOrder v-if="!ended && data.players.length > 0" class="col-md-4 order-4 order-md-1" />
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
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import Engine,{ Command,Phase,factions, Player, EngineOptions, Expansion } from '@gaia-project/engine';

import AdvancedLog from './AdvancedLog.vue';
import Commands from './Commands.vue';
import Pool from './Pool.vue';
import PlayerInfo from './PlayerInfo.vue';
import ResearchBoard from './ResearchBoard.vue';
import ScoringBoard from './ScoringBoard.vue';
import SpaceMap from './SpaceMap.vue';
import TurnOrder from './TurnOrder.vue';

@Component<Game>({
  computed: {
    data() {
      return this.$store.state.gaiaViewer.data;
    },
    ended() {
      return this.data.phase === Phase.EndGame;
    },
    scoringX() {
      return this.data.expansions ? 505 : 385;
    },
    orderedPlayers() {
      const data = this.data;

      if (!data.round || !data.turnOrder) {
        return data.players;
      }
      let turnOrder = data.turnOrder;

      // Do not switch boards anymore now that there's two in  a row
      // if (data.turnOrder.indexOf(this.player) !== -1) {
      //   turnOrder = turnOrder.slice(turnOrder.indexOf(this.player)).concat(turnOrder.slice(0, turnOrder.indexOf(this.player)));
      // }

      return turnOrder.concat(data.passedPlayers).map(player => data.players[player]);
    },
    canPlay() {
      return !this.ended && (!this.$store.state.gaiaViewer.player || this.sessionPlayer === this.data.players[this.player]);
    },
    hasMap() {
      return !!this.$store.state.gaiaViewer.data.map;
    },
    player() {
      return this.data.availableCommands?.[0]?.player;
    },
    sessionPlayer() {
      const player = this.$store.state.gaiaViewer.player;
      if (player) {
        if (player.index !== undefined) {
          return this.data.players[player.index];
        }
        if (player.auth) {
          return this.data.players.find(pl => pl.auth === player.auth);
        }
      }
    }
  },
  created(this: Game) {
    const unsub = this.$store.subscribeAction(({type, payload}) => {
      if (type === "gaiaViewer/externalData") {
        this.handleData(Engine.fromData(payload));
      }
    });

    this.$once("hook:beforeDestroy", unsub);
  },
  components: {
    AdvancedLog,
    Commands,
    PlayerInfo,
    Pool,
    ResearchBoard,
    ScoringBoard,
    SpaceMap,
    TurnOrder,
  }
})
export default class Game extends Vue {
  public currentMove = "";
  clearCurrentMove = false;
  // When joining a game
  name = "";

  @Prop()
  options: EngineOptions;

  handleData(data: Engine, keepMoveHistory?: boolean) {
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

  handleCommand(command: string) {
    if (command.startsWith(Command.Init) || this.data.round <= 0) {
      this.addMove(command);
      return;
    }

    const move = this.parseMove(command);

    if (move.command === Command.EndTurn) {
      this.addMove(this.currentMove + ".");
      return;
    }

    if (this.currentMove && !this.clearCurrentMove) {
      this.addMove(this.currentMove + `. ${command.slice(move.player.length+1)}`);
    } else {
      this.clearCurrentMove = false;
      this.addMove(command);
    }
  }

  undoMove() {
    if (this.currentMove.includes(".")) {
      this.currentMove = this.currentMove.slice(0, this.currentMove.lastIndexOf("."));
    } else {
      this.currentMove = "";
    }
    this.addMove(this.currentMove);
  }

  addMove(command: string) {
    this.$store.commit("gaiaViewer/clearContext");
    this.$store.dispatch("gaiaViewer/move", command);
  }

  parseMove(command: string): {player: string, command: string, args: string[]} {
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

// Used for type augmentation from computed properties
export default interface Game {
  data: Engine;
  player: number;

  canPlay: boolean;
  ended: boolean;
}
</script>

<style lang="scss">

@import "../stylesheets/frontend.scss";

.space-map, .scoring-research-board {
  max-height: 550px;

  width: 100%;
  // Unfortunately, necessary for chrome, otherwise would be nicer!
  height: 100%;
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
