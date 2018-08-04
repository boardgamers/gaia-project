<template>
  <div>
    <div class="row justify-content-center">
      <SpaceMap class="pr-3 mr-3" height="450" />
      <ResearchBoard height="450" />
      <ScoringBoard class="ml-4" height="450" />
    </div>
    <div id="errors"></div>
    <div class="row mt-2">
      <div class="col-md-6 order-2 order-md-1">
        <div v-if="sessionPlayer === undefined">
          <PlayerInfo :player='orderedPlayers[0]'/>
          <div>
            {{turnOrderDesc}} 
          </div>
          <PlayerInfo v-for="player in orderedPlayers.slice(1)" :player='player' :key="player.player" />
        </div>
        <div v-else>
          <PlayerInfo :player='sessionPlayer'/>
          <div>
            {{turnOrderDesc}} 
          </div>   
          <PlayerInfo v-for="player in orderedPlayers.filter(pl => pl !== sessionPlayer)" :player='player' :key="player.player" />
        </div>
        <Pool />
      </div>
      <div class="col-md-6 order-1 order-md-2" id="move-panel">
        <span v-if="ended"><b>Game ended!</b></span>
        <Commands @command="handleCommand" @undo="undoMove" v-else-if="canPlay" />
        <div v-else-if="data.players[player]">Waiting for {{data.players[player].name}} to play.<br/> <button class="btn btn-default mt-2" @click="loadGame()">Refresh</button></div>
        <div>
          <form id="move-form" @submit.prevent="submit">
            <label for="current-move" v-if="canPlay">Current Move</label>
            <div class="input-group" v-if="canPlay">
              <input type="text" class="form-control" placeholder="Current move" aria-label="Current move" id="current-move" v-model="currentMove">
              <div class="input-group-append">
                <!-- <button class="btn btn-danger" type="button" @click="addMove('')">Clear</button> -->
                <button class="btn btn-primary" type="button" @click="addMove(currentMove)">Send</button>
              </div>
            </div>
            <div class="form-group mt-2">
              <label for="moves">Move log</label>
              <textarea class="form-control" rows="4" id="moves" v-model="moveList"></textarea>
            </div> 
            <input type="button" class="btn btn-default d-block ml-auto" value="Replay" @click="replay" v-if="!gameId">
          </form>  
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import * as $ from 'jquery';
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { Data } from '../data';
import Commands from './Commands.vue';
import SpaceMap from './SpaceMap.vue';
import PlayerInfo from './PlayerInfo.vue';
import ResearchBoard from './ResearchBoard.vue';
import ScoringBoard from './ScoringBoard.vue';
import Pool from './Pool.vue';
import { Command, Phase } from '@gaia-project/engine';
import { GameApi } from '../api';

@Component<Game>({
  computed: {
    data() {
      return this.$store.state.gaiaViewer.data;
    },
    ended() {
      return this.data.phase === Phase.EndGame;
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
    turnOrderDesc() {
      const {players, passedPlayers} = this.data;
      const desc= pl => passedPlayers.includes(pl.player) ? `${players[pl.player].faction} (passed)` : players[pl.player].faction;
      return "Turn order: " + this.orderedPlayers.map(desc).join(", ");
    },
    canPlay() {
      return !this.ended && !this.gameId || this.player !== undefined && this.data.players[this.player].auth === this.auth;
    },
    player() {
      return this.data.availableCommands.length > 0 ? this.data.availableCommands[0].player : undefined;
    },
    sessionPlayer() {
      if (this.auth) {
        return this.data.players.find(pl => pl.auth === this.auth);
      }
    }
  },
  created(this: Game) {
    if (this.gameId) {
      this.refresher = setInterval(() => this.refreshStatus(), 3000);
      this.loadGame();
      return;
    }
    if (window.sessionStorage.getItem('moves')) {
      this.moveList = JSON.parse(window.sessionStorage.getItem('moves')).join("\n");
      this.updateMoveList();
    }
    this.replay();
  },
  destroyed() {
    clearInterval(this.refresher);
  },
  components: {
    Commands,
    SpaceMap,
    PlayerInfo,
    ResearchBoard,
    ScoringBoard,
    Pool
  }
})
export default class Game extends Vue {
  public moveList = "";
  public currentMove = "";
  // When joining a game
  name = "";
  lastUpdated = null;
  refresher = undefined;
  // When refreshing status, count the number of times the status is the same
  refreshCount = 0;

  @Prop()
  api: GameApi;

  @Prop()
  gameId: string;

  @Prop()
  auth: string;

  replay() {
    this.$store.commit("gaiaViewer/clearContext");

    const text = this.moveList.trim(); 
    const moveList = text ? text.split("\n") : [];

    this.api.replay(moveList).then(data => {
      this.handleData(data);
      window.sessionStorage.setItem('moves', JSON.stringify(data.moveHistory));
    }, this.handleError.bind(this));
  }

  handleError(error, status, exception) {
    if (error.status === 0) {
      this.$store.commit("error", "Are you sure gaia engine is running on port 9508?");  
    } else {
      this.$store.commit("error", error.responseText);
    }
  }

  handleData(data: any) {
    this.lastUpdated = data.lastUpdated;

    this.$store.commit('removeError');
    this.$store.commit('gaiaViewer/receiveData', data);

    if (data.newTurn) {
      this.moveList = data.moveHistory.join("\n");
      this.currentMove = "";
    } else {
      this.currentMove = data.moveHistory.pop();
      this.moveList = data.moveHistory.join("\n");
    }

    this.updateFavicon();
    this.updateMoveList();
  }

  updateFavicon() {
    if (this.canPlay) {
      $("#favicon-gp").attr("href", "/favicon-active.png");
    } else {
      $("#favicon-gp").attr("href", "/favicon.png");
    }
  }

  loadGame() {
    this.$store.commit("gaiaViewer/clearContext");

    this.api.loadGame(this.gameId).then(data => this.handleData(data), this.handleError.bind(this));
  }

  /**
   * Check if we need to refresh the whole game
   */
  refreshStatus() {
    if (this.canPlay || this.ended) {
      return;
    }

    this.refreshCount += 1;  

    if (this.refreshCount >= 3600/3) {
      // more than an hour without changes, only check every minute
      if (this.refreshCount % 20 !== 0) return;
    } else if (this.refreshCount >= 600/3) {
      // more than 10 minutes without change, only check every 20 seconds
      if (this.refreshCount % 6 !== 0) return;
    } else if (this.refreshCount >= 300/3) {
      // more than 5 minutes without change, only check every 10 seconds
      if (this.refreshCount % 3 !== 0) return;
    }

    this.api.checkStatus(this.gameId).then(data => {
      if (data.lastUpdated !== this.lastUpdated) {
        this.refreshCount = 0;
        this.lastUpdated = data;
        this.loadGame();
      }
    }, () => {});
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

    if (this.currentMove) {
      this.addMove(this.currentMove + `. ${command.slice(move.player.length+1)}`);
    } else {
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
    if (this.gameId) {
      if (command) {
        this.api.addMove(this.gameId, command).then(data => this.handleData(data), this.handleError.bind(this));
      } else {
        this.loadGame();
      }
    } else {
      this.moveList = (this.moveList.trim() + "\n" + command).trim();

      this.replay();
    }
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

  updateMoveList() {
    setTimeout(() => $("#moves").scrollTop($("#moves")[0].scrollHeight));
  }
}

// Used for type augmentation from computed properties
export default interface Game {
  data: Data;
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

</style>
