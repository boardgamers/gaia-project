<template>
  <nav class="navbar navbar-dark bg-primary navbar-expand-sm navbar-fixed-top mb-md-3 mb-1" id="navbar">
    <a class="navbar-brand" href="/">Gaia project</a>
    <form class="form-inline my-2 my-lg-0 ml-auto" method="get" @submit.prevent="createGame" v-show="!online">
      <input type="checkbox" name="spaceShips" id="spaceShips" class="form-check-input" v-model="options.spaceShips" @change="updateOptions(options)">
      <label class="navbar-text mr-2" for="spaceShips">Spaceships </label>
      <input class="form-control mr-sm-2" type="text" name="g" v-model=gameId placeholder="Game ID" aria-label="Game ID" required>
      <select v-model="players" class="form-control mr-sm-2">
        <option value="2">2 players</option>
        <option value="3">3 players</option>
        <option value="4">4 players</option>
      </select>
      <button class="btn btn-secondary my-2 my-sm-0" type="submit">New game</button>
    </form>
  </nav>
</template>

<script lang="ts">
import Vue from 'vue'
import * as $ from "jquery";
import { Component, Prop } from 'vue-property-decorator';
import { EngineOptions } from '@gaia-project/engine';

@Component({
})
export default class Navbar extends Vue {
  @Prop()
  online: boolean;

  gameId: string = "";
  players: number = 2;
  
  createGame() {
    $.post(`${window.location.protocol}//${window.location.hostname}:9508/g`, 
      {gameId: this.gameId, players: this.players},
      data => {
        console.log("redirecting");
        window.location.href = `${window.location.origin}/?g=${this.gameId}`
      }
    ).fail((error, status, exception) => {
      console.log(exception, status);
      this.$store.commit("error", error.responseText);
    });
  }

  updateOptions() {
    this.$store.commit("options", this.options);
  }

  options() {
    return this.$store.state.options;
  }
}

</script>

<style lang="scss" scoped>

.navbar {
  // margin-bottom: 0 !important;
}

</style>
