<template>
  <g :transform="`translate(0, ${y})`" v-b-tooltip.html.left :title="tooltip" :class="field">
    <rect x="2" y="2" :class='["researchTile", field, {highlighted}]' width=56 :height="height" rx="5" ry="5" @click="onClick" />
    <Resource v-for="(resource,i) in resources" :key="'field-' + i" :transform="`translate(${2 + 56/2 + resourceX(i)}, ${height/3*2 + 3})`" :kind="resource.type" :count="resource.count" :level="level"/>
    <Token v-for="(player, index) in players" v-if="player.faction && player.data.research[field] == level" :faction="player.faction" :transform="`translate(${tokenX(index)}, ${tokenY(index)})`" :key="player.player" :scale="5" />
    <FederationTile v-if="this.federation" :federation="this.federation" :numTiles="1" x="5" y="7" height="35" style="pointer-events: none" />
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { ResearchField, Player, Federation, Resource as ResourceEnum, researchTracks, Event, Reward, Operator } from '@gaia-project/engine';
import { descriptions } from '../data/research';
import Token from './Token.vue';
import FederationTile from './FederationTile.vue';
import Resource from './Resource.vue';

@Component<ResearchTile>({
  computed: {
    players(): Player[] {
      return this.$store.state.gaiaViewer.data.players;
    },
    tooltip() {
      return `<b>Level ${this.level}:</b> ${descriptions[this.field][this.level]}`;
    },
    highlighted(): boolean {
      return this.$store.state.gaiaViewer.context.highlighted.researchTiles.has(this.field + "-" + this.level)
    },
    height() {
      return (this.level == 0 || this.level == 5) ? 46 : 36
    },
    federation(): Federation {
      if (this.level == 5 && this.field === ResearchField.Terraforming) {
        return this.$store.state.gaiaViewer.data.terraformingFederation;
      }
    }
  },
  components: {
    Token,
    FederationTile,
    Resource
  }
})
export default class ResearchTile extends Vue {
  @Prop()
  field: ResearchField;
  @Prop()
  y: number;
  @Prop()
  level: number;

  resourceX(index: number) {
    const res = this.resources;
    const l = res.length;
    const sep = l <= 2 ? 7 : 6;

    return - 6 * (l - 1) + index * 2 * sep - (res[0].count as any === '+' ? 2 : 0)
  }

  tokenX(index: number) {
    return 10 + 13*(index%4) + 22*(index > 3 ? 1 : 0);
  }

  tokenY(index: number) {
    return 10 + 13*(index > 3 ? 1 : 0);
  }

  onClick() {
    if (this.highlighted) {
      this.$store.dispatch('gaiaViewer/researchClick', this.field)
    }
  }

  get resources() {
    const events = researchTracks[this.field][this.level].map(s => new Event(s));

    const rewards = Reward.merge(...events.map(ev => ev.rewards), this.level == 3 ? [new Reward('-3pw')] : []);

    if (events[0] && events[0].operator === Operator.Income) {
      rewards.unshift(new Reward('+', ResourceEnum.None));
      rewards[0].count = '+' as any;
    }
    
    return rewards;
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
      fill: #ffd700;
    }
    &.sci {
      fill: #99ccff;
    }
    &.terra {
      fill: #856443;
    }
    &.nav {
      fill: #516372;
    }
    &.gaia {
      fill: #a5589c;
    }
    &.int {
      fill: #508344;
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
