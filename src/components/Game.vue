<template>
  <div>
    <div class="row justify-content-center">
      <SpaceMap class="pr-4 mr-4"/>
      <ResearchBoard />
    </div>
    <div id="errors"></div>
    <div class="row mt-2">
      <div class="col-md-6 order-2 order-md-1">
        <PlayerInfo v-for="player in data.players" :player='player' :key="player.player" />
      </div>
      <div class="col-md-6 order-1 order-md-2" id="move-panel">
        <Commands @command="handleCommand"/>
        <div>
          <form id="move-form" @submit.prevent="submit">
            <div class="form-group">
              <label for="moves">Moves</label>
              <textarea class="form-control" rows="4" id="moves" v-model="moveList"></textarea>
            </div> 
            <input type="submit" class="btn btn-primary d-block ml-auto" value="Execute">
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
import { Command } from '@gaia-project/engine';

@Component<Game>({
  computed: {
    data() {
      return this.$store.state.game.data;
    }
  },
  created(this: Game) {
    this.submit();
  },
  components: {
    Commands,
    SpaceMap,
    PlayerInfo,
    ResearchBoard
  }
})
export default class Game extends Vue {
  public moveList = "";
  public moves: string[] = [];

  submit() {
    const text = this.moveList.trim(); 
    this.moves = text ? text.split("\n") : [];

    const data = {
      moves: this.moves
    }

    $.post("http://localhost:9508/", 
      data,
      data => {
        this.$store.commit('removeError');
        this.$store.commit('receiveData', data);
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
    (() => {
      if (command.startsWith(Command.Init)) {
        this.moves = [command];
        return;
      }

      if (this.data.round <= 0) {
        this.moves.push(command);
        return;
      }

      const move = this.parseMove(command);

      if (move.command === Command.EndTurn) {
        this.moves[this.moves.length - 1] += ".";
        return;
      }

      const lastMoveStr = this.moves[this.moves.length - 1];

      if (lastMoveStr.endsWith('.')) {
        this.moves.push(command);
        return;
      }

      const lastMove = this.parseMove(lastMoveStr);

      if (lastMove.player !== move.player) {
        this.moves.push(command);
        return;
      }

      if (lastMove.command === Command.Leech || lastMove.command === Command.DeclineLeech || lastMove.command === Command.ChooseRoundBooster) {
        this.moves.push(command);
        return;
      }

      this.moves[this.moves.length-1] += `. ${command.slice(move.player.length+1)}`;
    })();

    this.$store.commit('clearContext');
    this.updateMoveList();
    this.submit();
  }

  parseMove(command: string): {player: string, command: string, args: string[]} {
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
    this.moveList = this.moves.join("\n");

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
