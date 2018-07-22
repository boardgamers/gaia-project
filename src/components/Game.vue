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
        <PlayerInfo v-for="player in orderedPlayers" :player='player' :key="player.player" />
        <Pool />
      </div>
      <div class="col-md-6 order-1 order-md-2" id="move-panel">
        <Commands @command="handleCommand" v-if="!ended" />
        <span v-else><b>Game ended!</b></span>
        <div>
          <form id="move-form" @submit.prevent="submit">
            <label for="current-move">Current Move</label>
            <div class="input-group">
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
            <input type="button" class="btn btn-default d-block ml-auto" value="Replay" @click="replay">
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
      return indexes.map(player => data.players[player]);
    }
  },
  created(this: Game) {
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

  replay() {
    this.$store.commit("clearContext");

    const text = this.moveList.trim(); 
    const moveList = text ? text.split("\n") : [];

    const data = {
      moves: moveList
    }

    $.post("http://localhost:9508/", 
      data,
      data => {
        this.$store.commit('removeError');
        this.$store.commit('receiveData', data);

        window.sessionStorage.setItem('moves', JSON.stringify(data.moveHistory));

        if (data.newTurn) {
          this.moveList = data.moveHistory.join("\n");
          this.currentMove = "";
        } else {
          this.currentMove = data.moveHistory.pop();
          this.moveList = data.moveHistory.join("\n");
        }

        this.updateMoveList();
      },
      "json"
    ).fail((error, status, exception) => {
      if (error.status === 0) {
        this.$store.commit("error", "Are you sure gaia engine is running on port 9508?");  
      } else {
        this.$store.commit("error", error.responseText);
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

    if (this.currentMove) {
      this.addMove(this.currentMove + `. ${command.slice(move.player.length+1)}`);
    } else {
      this.addMove(command);
    }
  }

  addMove(command: string) {
    this.moveList = (this.moveList.trim() + "\n" + command).trim();
    this.currentMove = "";

    this.replay();
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
}
</script>

<style lang="scss" scoped>

canvas#map {
  border: solid dodgerblue 1px; 
  width: 100%;
  height: 450px;
}

</style>
