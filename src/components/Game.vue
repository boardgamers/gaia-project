<template>
  <div>
    <div class="row">
      <canvas id="map">
      </canvas>
    </div>
    <div id="errors"></div>
    <div class="row mt-2">
      <div class="col-md-6 order-2 order-md-1">
        <div v-for="(player, index) in data.players" :id="'p'+(index+1)">
          <div class="text"></div>
          <div class="tiles"></div>
        </div>
      </div>
      <div class="col-md-6 order-1 order-md-2" id="move-panel">
        <Commands/>
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
    <div class="tooltip bs-tooltip-left" id="tooltip-canvas" role="tooltip">
      <div class="arrow"></div>
      <div class="tooltip-inner">
        Some tooltip text!
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import * as $ from 'jquery';
import Vue from 'vue'
import { Component } from 'vue-property-decorator';
import { Data } from '@/data';
import Commands from './Commands.vue';

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
    Commands
  }
})
export default class Game extends Vue {
  public moveList = "";

  submit() {
    const text = this.moveList.trim(); 
    const data = {
      moves: text ? text.split("\n") : []
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
        this.$store.commit("error", "Error " + error.status + ": " + error.responseText);
      }
    });
  }
}

</script>
