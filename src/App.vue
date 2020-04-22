<template>
  <div id="app">
    <Navbar :online="!!gameId" />
    <Alert/>
    <main class="container-fluid">
      <div class="text-center" v-if="gameId && freeSpots">
        <h3>Game '{{gameId}}'</h3>
        Waiting for {{freeSpots}} player{{freeSpots > 1 ? 's' : ''}} to join...<br/>
        <form class="form-inline my-2 my-lg-0 mx-auto" method="get" @submit.prevent="joinGame" v-if="canJoin">
          <div class="input-group mx-auto mt-2">
            <input class="form-control" type="text" name="name" v-model=name placeholder="Player name" aria-label="Player name" required>
            <div class="input-group-append">
              <button class="btn btn-secondary" type="submit">Join</button>
            </div>
          </div>
        </form>
      </div>
      <Game :api="api" :gameId="gameId" :auth="auth" :options="options" :developmentMode="true" v-else />
    </main>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import Navbar from './components/Navbar.vue';
import Alert from './components/Alert.vue';
import Game from './components/Game.vue';
import $ from "jquery";

@Component({
  components: {
    Navbar,
    Alert,
    Game
  },
  created() {
    document.title = "Gaia project";
    // No mobile display
    $("meta[name='viewport']").attr("content", "width=800, initial-scale=1.0");
  },
  computed: {
    gameId() {
      if (window.location.search.startsWith("?g=")) {
        return window.location.search.slice("?g=".length);
      }
    },
    auth() {
      if (!window.localStorage.getItem("auth")) {
        window.localStorage.setItem("auth", Math.random().toString(36));
      }
      return window.localStorage.getItem("auth");
    },
    data() {
      return this.$store.state.gaiaViewer.data;
    },
    canJoin() {
      return !this.data.players.some(pl => pl.auth === this.auth) && this.freeSpots;
    },
    freeSpots() {
      return this.data.players.filter(pl => !pl.auth).length;
    },
    options() {
      return this.$store.state.options;
    }
  }
})
export default class App extends Vue {
  private name: string = "";
}
export default interface App {
  gameId: string;
  auth: string;
}
</script>

<style lang="scss">

.notransition {
  transition: none !important;
}

.tooltip#tooltip-canvas {
  opacity: 1;
  display: none;

  &.tooltip-show {
    display: block;
  }

  // Center-vertically
  .arrow {
    top: 0;
    bottom: 0;
    margin-top: auto;
    margin-bottom: auto;
  }

  .tooltip-inner {
    max-width: 400px;
    text-align: left;
  }
}

</style>
