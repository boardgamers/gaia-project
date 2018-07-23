<template>
  <nav class="navbar navbar-dark bg-primary navbar-expand-sm navbar-fixed-top mb-3" id="navbar">
    <a class="navbar-brand" href="/">Gaia project</a>
    <form class="form-inline my-2 my-lg-0 ml-auto" method="get" @submit.prevent="createGame">
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

@Component
export default class Navbar extends Vue {
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
}

</script>

<style lang="scss" scoped>

.navbar {
  // margin-bottom: 0 !important;
}

</style>
