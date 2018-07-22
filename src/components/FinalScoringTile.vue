<template>
  <g :class='["finalScoringTile", {highlighted}]' v-b-tooltip :title="tooltip">
    <rect x="1" y="1" width="75" height="55" />
    <text class="title" x="5" y="12">{{content}}</text>
    <line v-for="i in [-1,0,1,2,3,4,5,6,7,8,9,10]" :key="i" :x1="posX(i)+3.05" :x2="posX(i)+3.05" y1="16" y2="52" />
    <line :x1="posX(0)-3.05" :x2="posX(10)+3.05" y1="16" y2="16" />
    <line :x1="posX(0)-3.05" :x2="posX(10)+3.05" y1="52" y2="52" />
    <Token v-for="(player, index) in players" :faction="player.faction" :transform="`translate(${tokenX(player)}, ${tokenY(index)})`" :key="player.faction" :scale="2.7" />
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event, factions, FinalTile, Phase } from '@gaia-project/engine';
import { AugmentedPlayer } from "../data";
import Token from "./Token.vue";

@Component<FinalScoringTile>({
  computed: {
    tile() {
      return this.$store.state.game.data.tiles.scorings.final[this.index];
    },

    content() {
      return this.tile;
    },

    players() {
      return this.$store.state.game.data.players.filter(player => !!player && player.faction);
    },

    tooltip() {
      const tile = this.tile;
      const players = this.players;

      return players.map(pl => `- ${factions[pl.faction].name}: ${pl.progress[tile]}`).join('\n');
    },

    highlighted() {
      return this.$store.state.game.data.phase === Phase.EndGame;
    }
  },

  components: {
    Token
  }
})
export default class FinalScoringTile extends Vue {
  @Prop()
  index: number;

  tokenX(player: AugmentedPlayer) {
    return this.posX(player.progress[this.tile]);
  }

  posX(progress: number) {
    return 8 + (progress % 11) * 6.1;
  }

  tokenY(index: number) {
    const nPlayers = this.players.length;

    const yCenter = 34;

    switch (nPlayers) {
      case 1: return yCenter;
      case 2: return yCenter + (index*2-1) * 7.5;
      case 3: return yCenter + (index - 1) * 9;
      case 4: return yCenter + (index - 1.5) * 9;
      default: return 19 + index * 7.5;
    }
  }
}
export default interface FinalScoringTile {
  tile: FinalTile;
  players: AugmentedPlayer[];
}

</script>

<style lang="scss">

g {
  &.finalScoringTile {
    rect {
      stroke: #333;
      stroke-width: 1px;
      fill: white;
    }
    .title {
      font-family: sans-serif;
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
    }

    line {
      stroke-width: 0.2;
      stroke: #111;
    }

    &.highlighted rect {
      stroke: #2C4;
    }
  }
}

</style>
