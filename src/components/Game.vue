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
        <PlayerInfo :player='data.players[this.player]' />
        <PlayerInfo v-for="player in orderedPlayers" :player='player' :key="player.player" />
        <Pool />
      </div>
      <div class="col-md-6 order-1 order-md-2" id="move-panel">
        <span v-if="ended"><b>Game ended!</b></span>
        <Commands @command="handleCommand" v-else-if="canPlay" />
        <div v-else-if="freeSpots">
          <form @submit.prevent="joinGame">
            <label for="name">Waiting for {{freeSpots}} players to join the game</label>
            <div class="input-group" v-if="canJoin">
              <input type="text" class="form-control" placeholder="Your name" id="name" v-model="name" required>
              <div class="input-group-append">
                <!-- <button class="btn btn-danger" type="button" @click="addMove('')">Clear</button> -->
                <button class="btn btn-primary" type="submit">Join!</button>
              </div>
            </div>
          </form>
          <div v-if="!canJoin"><button class="btn btn-default" @click="loadGame">Refresh</button></div>
        </div>
        <div v-else-if="data.players[player]">Waiting for {{data.players[player].name}} to play.<br/> <button class="btn btn-default mt-2" @click="loadGame">Refresh</button></div>
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
import { Component } from 'vue-property-decorator';
import { Data } from '../data';
import Commands from './Commands.vue';
import SpaceMap from './SpaceMap.vue';
import PlayerInfo from './PlayerInfo.vue';
import ResearchBoard from './ResearchBoard.vue';
import ScoringBoard from './ScoringBoard.vue';
import Pool from './Pool.vue';
import { Command, Phase } from '@gaia-project/engine';

@Component<Game>({
  computed: {
    data() {
      return this.$store.state.game.data;
    },
    ended() {
      return this.data.phase === Phase.EndGame;
    },
    orderedPlayers() {
      const data = this.data;

      if (!data.round || !data.turnOrder) {
        return data.players;
      }

      const indexes = data.turnOrder.concat(data.passedPlayers);
      return indexes.filter(pl => pl !== this.player).map(player => data.players[player]);
    },
    gameId() {
      if (window.location.search.startsWith("?g=")) {
        return window.location.search.slice("?g=".length);
      }  
    },
    canPlay() {
      return !this.gameId || this.player !== undefined && this.data.players[this.player].auth === this.auth && !this.freeSpots;
    },
    canJoin() {
      return !this.data.players.some(pl => pl.auth === this.auth) && this.freeSpots;
    },
    freeSpots() {
      return this.data.players.filter(pl => !pl.auth).length;
    },
    player() {
      return this.data.availableCommands.length > 0 ? this.data.availableCommands[0].player : undefined;
    }
  },
  created(this: Game) {
    if (this.gameId) {
      setInterval(() => this.refreshStatus(), 3000);
      this.loadGame();
      return;
    }
    if (window.sessionStorage.getItem('moves')) {
      this.moveList = JSON.parse(window.sessionStorage.getItem('moves')).join("\n");
      this.updateMoveList();
    }
    this.replay();
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

  replay() {
    this.$store.commit("clearContext");

    const text = this.moveList.trim(); 
    const moveList = text ? text.split("\n") : [];

    const data = {
      moves: moveList
    }

    $.post(`${window.location.protocol}//${window.location.hostname}:9508/`, 
      data,
      data => {
        this.handleData(data);
        window.sessionStorage.setItem('moves', JSON.stringify(data.moveHistory));
      },
      "json"
    ).fail(this.handleError.bind(this));
  }

  handleError(error, status, exception) {
    if (error.status === 0) {
      this.$store.commit("error", "Are you sure gaia engine is running on port 9508?");  
    } else {
      this.$store.commit("error", error.responseText);
    }
  }

  handleData(data: any) {
    this.$store.commit('removeError');
    this.$store.commit('receiveData', data);

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
    this.$store.commit("clearContext");

    $.get(`${window.location.protocol}//${window.location.hostname}:9508/g/${this.gameId}`, 
      data => {
        this.handleData(data);
      },
      "json"
    ).fail(this.handleError.bind(this));
  }

  /**
   * Check if we need to refresh the whole game
   */
  refreshStatus() {
    if (this.canPlay) {
      return;
    }

    $.get(`${window.location.protocol}//${window.location.hostname}:9508/g/${this.gameId}/status`, 
      data => {
        if (data.round != this.data.round || data.phase != this.data.phase || data.player !== this.player) {
          this.loadGame();
          return;
        }
      },
      "json"
    ).fail(() => {});
  }

  joinGame() {
    if (!this.auth) {
      const string = this.name + "-" + this.gameId + "-" + Math.random();
      console.log("setting auth", string);
      window.localStorage.setItem("auth", string);
    }

    $.post(`${window.location.protocol}//${window.location.hostname}:9508/g/${this.gameId}/join`, {name: this.name, auth: this.auth}, 
      data => {
        this.loadGame();
      },
    ).fail(this.handleError.bind(this));
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

  addMove(command: string) {
    if (this.gameId) {
      this.$store.commit("clearContext");
      $.post(`${window.location.protocol}//${window.location.hostname}:9508/g/${this.gameId}/move`,  {auth: this.auth, move: command},
        data => {
          this.handleData(data);
        },
        "json"
      ).fail(this.handleError.bind(this));
    } else {
      this.moveList = (this.moveList.trim() + "\n" + command).trim();
      this.currentMove = "";

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

  get auth() {
    return window.localStorage.getItem('auth');
  }
}

// Used for type augmentation from computed properties
export default interface Game {
  data: Data;
  gameId: string;
  player: number;

  canPlay(): boolean;
}
</script>

<style lang="scss" scoped>

canvas#map {
  border: solid dodgerblue 1px; 
  width: 100%;
  height: 450px;
}

</style>
