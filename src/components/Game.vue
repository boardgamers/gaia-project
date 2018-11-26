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
          <div v-if="data.players.length > 2" class="turn-order">
            {{turnOrderDesc}} 
          </div>
          <PlayerInfo v-for="player in orderedPlayers.filter(pl => pl !== sessionPlayer)" :player='player' :key="player.player" />
        </div>
        <Pool /> 
      </div>
      <div class="col-md-6 order-1 order-md-2" id="move-panel">
        <transition name="fade">
          <div v-if="!replaying">
            <span v-if="ended"><b>Game ended!</b></span>
            <Commands @command="handleCommand" @undo="undoMove" v-else-if="canPlay" :remainingTime="remainingTime" />
            <div v-else-if="data.players[player]" class="mb-2">Waiting for {{data.players[player].name}} to play <span v-if="remainingTime" class="small smaller">({{remainingTime}} remaining)</span><br/></div>
          </div>
        </transition>
        <div>
          <form id="move-form" @submit.prevent="">
            <div class="card mb-2" v-if="data.moveHistory.length > 0 || !gameId">
              <b-tabs pills card>
                <b-tab v-if="canPlay || replaying" title="Current Move">
                  <div class="input-group mb-2" v-if="canPlay || replaying">
                    <input type="text" class="form-control" placeholder="Current move" aria-label="Current move" id="current-move" v-model="currentMove">
                    <div class="input-group-append" v-if="!replaying">
                      <!-- <button class="btn btn-danger" type="button" @click="addMove('')">Clear</button> -->
                      <button class="btn btn-primary" type="button" @click="addMove(currentMove, auth)">Send</button>
                    </div>
                  </div>
                </b-tab>
                <b-tab title="Notes">
                  <textarea class="form-control" rows="4" id="notes" v-model="notes" maxlength="2000"></textarea>
                  <div class="mt-2 row no-gutters">
                    <input type="button" class="btn btn-secondary ml-auto" value="Refresh" @click="loadNotes" >
                    <input type="button" class="btn btn-primary ml-2" value="Save" @click="saveNotes" >
                  </div>
                </b-tab>
                <b-tab title="Move log">
                  <textarea class="form-control" rows="4" id="moves" v-model="moveList"></textarea>  

                  <div class="mt-2 row no-gutters">
                    <transition name="fade">
                      <span v-if="replaying" class="input-group" role="group" style="width: auto">
                        <div class="input-group-prepend">
                          <button class="btn btn-outline-secondary" @click="goto(1)">« <span class="sr-only">Previous move</span></button>
                          <button class="btn btn-outline-secondary" @click="replayPrevMove">‹ <span class="sr-only">Previous move</span></button>
                        </div>
                        <input type="text" id="replayMove" style="max-width: 60px" v-model="replayMove" @keydown.enter.prevent="goto(replayMove)" class="form-control">
                        <div class="input-group-append">
                          <span class="input-group-text"> / {{numberOfMoves}}</span>
                          <button class="btn btn-outline-secondary" @click="replayNextMove">› <span class="sr-only">Next move</span></button>
                          <button class="btn btn-outline-secondary" @click="replay(true)">» <span class="sr-only">Next move</span></button>
                        </div>
                      </span>
                    </transition>
                    <input type="button" class="btn btn-secondary ml-auto" :value="!replaying ? 'Replay Mode' : 'Leave Replay'" @click="toggleReplayMode" >
                    <input type="button" class="btn btn-primary ml-2" v-if="developmentMode" :disabled="replaying" value="Execute" @click="replay(true)" >
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
import * as $ from 'jquery';
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import Commands from './Commands.vue';
import SpaceMap from './SpaceMap.vue';
import PlayerInfo from './PlayerInfo.vue';
import ResearchBoard from './ResearchBoard.vue';
import ScoringBoard from './ScoringBoard.vue';
import AdvancedLog from './AdvancedLog.vue';
import Pool from './Pool.vue';
import Engine,{ Command,Phase,factions, Player, EngineOptions } from '@gaia-project/engine';
import { GameApi, EngineData } from '../api';
import {handleError, handleInfo} from '../utils';
import { Expansion } from '@gaia-project/engine/src/enums';

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
  created(this: Game) {
    if (this.gameId) {
      this.refresher = setInterval(() => this.refreshStatus(), 3000);
      this.deadlineTicker = setInterval(() => this.updateDeadline(), 1000);
      this.loadGame();
      this.loadNotes();
      return;
    }
    if (window.sessionStorage.getItem('moves')) {
      this.moveList = JSON.parse(window.sessionStorage.getItem('moves')).join("\n");
      this.replayMove = this.numberOfMoves;
      this.updateMoveList();
    }
    this.replay();
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
  public moveList = "";
  public currentMove = "";
  clearCurrentMove = false;
  // When joining a game
  name = "";
  lastUpdated = null;
  remainingTime = null;
  nextMoveDeadline = null;
  backupEngine: EngineData = null;
  refresher = undefined;
  deadlineTicker = undefined;
  replaying = false;
  notes = '';

  // When refreshing status, count the number of times the status is the same
  refreshCount = 0;
  replayMove = 0;

  @Prop()
  api: GameApi;

  @Prop()
  gameId: string;

  @Prop()
  auth: string;

  @Prop()
  options: EngineOptions;

  @Prop({default: false})
  developmentMode: boolean;

  get numberOfMoves() {
    return this.moveList.length === 0 ? 0 : this.moveList.split("\n").length;
  }

  toggleReplayMode() {
    if (this.replaying) {
      this.handleData(this.backupEngine);
      this.backupEngine = null;
      this.replaying = false;
    } else {
      this.replaying = true;
      this.backupEngine = this.data;
      this.replay(true);
    }
  }

  goto(move: number) {
    this.replayMove = move;
    this.replay();
  }

  replayPrevMove() {
    this.replayMove > 0 ? this.replayMove -- : 0;
    this.replay();
  }

  loadNotes() {
    this.api.getNotes(this.gameId, this.auth)
      .then(notes => this.notes = notes)
      .catch(err => handleError(this.$store, err));
  }

  saveNotes() {
    this.api.saveNotes(this.gameId, this.notes, this.auth).then(
      () => {}, //handleInfo(this.$store, "Notes saved!"),
      err => handleError(this.$store, err)
    );
  }

  replayNextMove() {
    const lastMove = this.numberOfMoves; 
    this.replayMove < lastMove ? this.replayMove ++ : lastMove ;
    this.replay();
  }

  async replay(goToLastMove = false) {
    this.$store.commit("gaiaViewer/clearContext");

    const text = this.moveList.trim(); 
    let moveList = text ? text.split("\n") : [];

    if (!goToLastMove) {
      moveList = moveList.slice(0, this.replayMove);
    } else {
      this.replayMove = moveList.length;
    }
 
    try {
      // console.log(JSON.stringify(this.backupEngine.options));
      const options: EngineOptions = Object.assign({}, this.backupEngine && this.backupEngine.options, this.options);
      const data = await this.api.replay(moveList, options);
      this.handleData(data, !goToLastMove);
      window.sessionStorage.setItem('moves', JSON.stringify(data.moveHistory));
    } catch(err) {
      handleError(this.$store, err);
    }
  }

  handleData(data: EngineData, keepMoveHistory?: boolean) {
    console.log("handle data", keepMoveHistory);
    this.lastUpdated = data.lastUpdated;
    this.nextMoveDeadline = data.nextMoveDeadline;

    $('.sector').addClass('notransition');

    this.$store.commit('removeError');
    this.$store.commit('gaiaViewer/receiveData', data);

    if (keepMoveHistory) { 
      // moveList stays the same 
      this.currentMove = this.moveList.split("\n")[this.replayMove];
      this.clearCurrentMove = true;
    } else {
      this.clearCurrentMove = false;
      if (data.newTurn) {
        this.currentMove = "";
      } else {
        this.currentMove = data.moveHistory.pop();
      }
      this.moveList = data.moveHistory.join("\n");
    }

    this.updateFavicon();
    this.updateMoveList();
    this.updateDeadline();

    setTimeout(() => $('.sector').removeClass('notransition'));
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

  public updateFavicon() {
    if (this.canPlay) {
      $("#favicon-gp").attr("href", "/favicon-active.png");
    } else {
      $("#favicon-gp").attr("href", "/favicon.png");
    }
  }

  loadGame() {
    this.$store.commit("gaiaViewer/clearContext");

    this.api.loadGame(this.gameId).then(data => this.handleData(data), err => handleError(this.$store, err));
  }

  /**
   * Check if we need to refresh the whole game
   */
  refreshStatus() {
    if (this.ended || this.replaying) {
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
    
    if (this.gameId) {
      if (command) {
        this.api.addMove(this.gameId, command, this.auth).then(data => this.handleData(data), err => handleError(this.$store, err));
      } else {
        this.loadGame();
      }
    } else {
      let moveList = this.moveList ? this.moveList.trim().split("\n") : [];
      this.moveList = (moveList.slice(0, this.replayMove).join('\n').trim() + "\n" + command).trim();

      this.replay(true);
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

  updateDeadline() {
    if (!this.nextMoveDeadline) {
      this.remainingTime = null;
      return;
    }

    const timeDiff = Math.floor(Math.max(new Date(this.nextMoveDeadline).getTime() - Date.now(), 0)/1000);
    const parts = [];

    const seconds = timeDiff % 60;
    const minutes = ((timeDiff-seconds) % 3600) / 60;
    const hours = ((timeDiff-seconds- minutes * 60) % (3600*24)) / 3600;
    const days = (timeDiff - seconds - minutes * 60 - hours * 3600) / (24 * 3600);

    if (days > 0) {
      parts.push(`${days}d`);
    }
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    if (seconds > 0 || parts.length === 0) {
      parts.push(`${seconds}s`);
    }

    this.remainingTime = parts.join(', ');
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
