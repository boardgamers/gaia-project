<template>
  <div>
    <div :class="['row', 'no-gutters', 'justify-content-center', data.players.length > 2 ? 'medium-map' : 'small-map']" v-if="hasMap">
      <SpaceMap :class="['mb-1', 'space-map']" />
      <svg class="scoring-research-board" :viewBox="`0 0 ${scoringX + 90} 450`">
        <ResearchBoard :height="450" ref="researchBoard"/>
        <ScoringBoard class="ml-4" height="450" width="90" :x="scoringX" />
      </svg>
    </div>
    <div id="errors"></div>
    <div class="row mt-2">
      <div class="col-md-6 order-2 order-md-1">
        <div v-if="sessionPlayer === undefined">
          <div class="turn-order">
            {{turnOrderDesc}}
          </div>
          <PlayerInfo v-for="player in orderedPlayers" :player='player' :key="player.player" />
        </div>
        <div v-else>
          <PlayerInfo :player='sessionPlayer'/>
          <div class="turn-order">
            {{turnOrderDesc}}
          </div>
          <PlayerInfo v-for="player in orderedPlayers.filter(pl => pl !== sessionPlayer)" :player='player' :key="player.player" />
        </div>
        <Pool />
      </div>
      <div class="col-md-6 order-1 order-md-2" id="move-panel">
        <transition name="fade">
          <div>
            <span v-if="ended"><b>Game ended!</b></span>
            <Commands @command="handleCommand" @undo="undoMove" v-else-if="canPlay" />
            <div v-else-if="data.players[player]" class="mb-2">Waiting for {{data.players[player].name}} to play <br/></div>
          </div>
        </transition>
        <div>
          <form id="move-form" @submit.prevent="">
            <div class="card mb-2" v-if="data.moveHistory.length > 0 || !gameId">
              <b-tabs pills card>
                <b-tab v-if="canPlay" title="Current Move">
                  <div class="input-group mb-2" v-if="canPlay">
                    <input type="text" class="form-control" placeholder="Current move" aria-label="Current move" id="current-move" v-model="currentMove">
                    <div class="input-group-append">
                      <!-- <button class="btn btn-danger" type="button" @click="addMove('')">Clear</button> -->
                      <button class="btn btn-primary" type="button" @click="addMove(currentMove)">Send</button>
                    </div>
                  </div>
                </b-tab>
              </b-tabs>
            </div>
          </form>
        </div>
      </div>
      <AdvancedLog class="col-12 order-3 mt-4" />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import Commands from './Commands.vue';
import SpaceMap from './SpaceMap.vue';
import PlayerInfo from './PlayerInfo.vue';
import ResearchBoard from './ResearchBoard.vue';
import ScoringBoard from './ScoringBoard.vue';
import AdvancedLog from './AdvancedLog.vue';
import Pool from './Pool.vue';
import Engine,{ Command,Phase,factions, Player, EngineOptions, Expansion } from '@gaia-project/engine';
import {handleError, handleInfo} from '../utils';

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
      if (data.turnOrder.indexOf(this.player) !== -1) {
        turnOrder = turnOrder.slice(turnOrder.indexOf(this.player)).concat(turnOrder.slice(0, turnOrder.indexOf(this.player)));
      }

      return turnOrder.concat(data.passedPlayers).map(player => data.players[player]);
    },
    turnOrder() {
      const data = this.data;

      if (!data.round || !data.turnOrder) {
        return data.players;
      }

      return this.data.turnOrder.concat(this.data.passedPlayers).map(player => this.data.players[player]);
    },
    turnOrderDesc() {
      const turnOrder = this.turnOrder;

      if (!turnOrder || turnOrder.length === 0) {
        return '';
      }

      return "Turn order: " + turnOrder.map(pl => this.desc(pl)).filter(desc => !!desc).join(", ");
    },
    canPlay() {
      return !this.ended && !this.gameId || this.player !== undefined && this.data.players[this.player].auth === this.auth;
    },
    hasMap() {
      return !!this.$store.state.gaiaViewer.data.map;
    },
    player() {
      if (!this.data.availableCommands) {
        return undefined;
      }
      return this.data.availableCommands.length > 0 ? this.data.availableCommands[0].player : undefined;
    },
    sessionPlayer() {
      if (this.auth) {
        return this.data.players.find(pl => pl.auth === this.auth);
      }
    }
  },
  destroyed() {
    clearInterval(this.refresher);
    clearInterval(this.deadlineTicker);
  },
  components: {
    Commands,
    SpaceMap,
    PlayerInfo,
    ResearchBoard,
    ScoringBoard,
    Pool,
    AdvancedLog
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

    this.$store.commit('removeError');
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

  desc(pl: Player) {
    if (!pl.faction) {
      return pl.name || `Player ${pl.player+1}`;
    }

    if (this.data.passedPlayers && this.data.passedPlayers.includes(pl.player)) {
      return `${factions[pl.faction].name} (passed)`
    }

    return factions[pl.faction].name;
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

<style lang="scss" scoped>

canvas#map {
  border: solid dodgerblue 1px;
  width: 100%;
  height: 450px;
}


.space-map, .scoring-research-board {
  max-height: 450px;

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
