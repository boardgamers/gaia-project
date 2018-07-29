<template>
  <g :transform="`translate(0, ${y})`" v-b-tooltip.html.left :title="tooltip">
    <rect x="2" y="2" :class='["researchTile", field, {highlighted}]' width=56 :height="height" rx="5" ry="5" @click="onClick" />
    <Token v-for="(player, index) in players" v-if="player.faction && player.data.research[field] == level" :faction="player.faction" :transform="`translate(${tokenX(index)}, ${tokenY(index)})`" :key="player.player" :scale="5" />
    <FederationTile v-if="this.federation" :federation="this.federation" :numTiles="1" x="5" y="7" height="35" style="pointer-events: none" />
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { ResearchField, Player, Federation } from '@gaia-project/engine';
import { descriptions } from '../data/research';
import Token from './Token.vue';
import FederationTile from './FederationTile.vue';

@Component<ResearchTile>({
  computed: {
    players(): Player[] {
      return this.$store.state.game.data.players;
    },
    tooltip() {
      return `<b>Level ${this.level}:</b> ${descriptions[this.field][this.level]}`;
    },
    highlighted(): boolean {
      return this.$store.state.game.context.highlighted.researchTiles.has(this.field + "-" + this.level)
    },
    height() {
      return (this.level == 0 || this.level == 5) ? 46 : 36
    },
    federation(): Federation {
      if (this.level == 5 && this.field === ResearchField.Terraforming) {
        return this.$store.state.game.data.terraformingFederation;
      }
    }
  },
  components: {
    Token,
    FederationTile
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
    return 15 + 15*(index%3) + 22*(index > 2 ? 1 : 0);
  }

  tokenY(index: number) {
    return 13 + 13*(index > 2 ? 1 : 0);
  }

  onClick() {
    if (this.highlighted) {
      this.$store.dispatch('researchClick', this.field)
    }
  }
}
export default interface ResearchTile {
  highlighted: boolean;
}
</script>

<style lang="scss">

svg {
  .researchTile {
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

    &.highlighted {
      fill-opacity: 0.3;
      cursor: pointer;
    }
  }
}

</style>
