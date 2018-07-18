<template>
  <g :transform="`translate(0, ${y})`">
    <rect x="2" y="2" :class='["researchTile", field]' width=56 height=46 rx="5" ry="5" />
    <Token v-for="(player, index) in players" v-if="player.faction && player.data.research[field] == level" :faction="player.faction" :x="tokenX(index)" :y="tokenY(index)" />
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { ResearchField, Player } from '@gaia-project/engine';

import Token from './Token.vue';

@Component<ResearchTile>({
  computed: {
    players(): Player[] {
      return this.$store.state.game.data.players;
    }
  },
  components: {
    Token
  }
})
export default class ResearchTile extends Vue {
  @Prop()
  field: ResearchField;
  @Prop()
  y: number;
  @Prop()
  level: number;

  tokenX(index: number) {
    return 15 + 15*(index%3) + 7*(index > 2);
  }

  tokenY(index: number) {
    return 15 + 15*(index > 2);
  }
}
</script>

<style lang="scss">

g .researchTile {
  fill: blue;
  stroke: #444;
  stroke-width: 1;

  &.eco {
    fill: #e8de24;
  }
  &.sci {
    fill: #3287F7;
  }
  &.terra {
    fill: #ae5409;
  }
  &.nav {
    fill: #275175;
  }
  &.gaia {
    fill: #a41894;
  }
  &.int {
    fill: #2b8617;
  }

  &:hover {
    fill-opacity: 0.5;
  }
}

</style>
