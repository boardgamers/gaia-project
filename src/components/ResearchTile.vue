<template>
  <g :transform="`translate(0, ${y})`" v-b-tooltip.html.left :title="tooltip" :class="field">
    <rect x="2" y="2" :class='["researchTile", field, {highlighted}]' width=56 :height="height" rx="5" ry=2 @click="onClick" />
    <g style="pointer-events: none">
      <Resource v-for="(resource,i) in resources" :key="'field-' + i" :transform="`translate(${2 + 56/2 + resourceX(i)}, ${height/3*2 + 3 + resourceOffset})`" :kind="resource.type" :count="resource.count" />
      <Token v-for="player in players" :faction="player.faction" :transform="`translate(${tokenX(player.player)}, ${tokenY(player.player)})`" :key="player.player" :scale="5.5" />
      <FederationTile v-if="this.federation" :federation="this.federation" :numTiles="1" x="5" y="7.4" height="33" />
      <circle v-if="this.lostPlanet" :class='["planet-fill", this.lostPlanet ]' cx="30" cy="18" r="10" />
    </g>
    <text x="0" y="0" :transform="`translate(${2 + 56/2 }, ${height - 10})`" class="levDesc">{{label}}</text>
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { ResearchField, Player, Federation, Resource as ResourceEnum, researchTracks, Event, Reward, Operator, Planet as PlanetEnum } from '@gaia-project/engine';
import { descriptions } from '../data/research';
import Token from './Token.vue';
import FederationTile from './FederationTile.vue';
import Planet from './Planet.vue';
import Resource from './Resource.vue';

@Component<ResearchTile>({
  computed: {
    players (): Player[] {
      return this.$store.state.gaiaViewer.data.players.filter(player => player.faction && player.data.research[this.field] === this.level);
    },
    tooltip () {
      return `<b>Level ${this.level}:</b> ${descriptions[this.field][this.level]}`;
    },
    height () {
      return this.level === 5 ? 46 : 36;
    },
    federation (): Federation {
      if (this.level === 5) {
        if (this.field === ResearchField.Terraforming) {
          return this.$store.state.gaiaViewer.data.terraformingFederation;
        } else if (this.field === ResearchField.TradingVolume && this.players.length === 0) {
          return Federation.Ship;
        }
      }
    },
    lostPlanet (): PlanetEnum {
      if (this.level === 5 && this.field === ResearchField.Navigation) {
        for (const pl of this.players) {
          if (pl.data.lostPlanet) { return undefined; }
        }
        return PlanetEnum.Lost;
      }
    }
  },
  components: {
    Token,
    FederationTile,
    Resource,
    Planet
  }
})
export default class ResearchTile extends Vue {
  @Prop()
  field: ResearchField;

  @Prop()
  y: number;

  @Prop({ type: Number })
  level: number;

  resourceX (index: number) {
    const res = this.resources;
    const l = res.length;
    const sep = l <= 2 ? 7 : 6;

    return -6 * (l - 1) + index * 2 * sep - (res[0].count as any === '+' ? 2 : 0);
  }

  tokenX (index: number) {
    return 10 + 13 * (index % 4) + 22 * (index > 3 ? 1 : 0);
  }

  tokenY (index: number) {
    return 10 + 13 * (index > 3 ? 1 : 0);
  }

  onClick () {
    if (this.highlighted) {
      this.$store.dispatch('gaiaViewer/researchClick', this.field);
    }
  }

  get label () {
    if (this.field === ResearchField.Terraforming) {
      return this.level === 0 ? "cost 3" : this.level === 2 ? "cost 2" : this.level === 3 ? "cost 1" : "";
    };
    if (this.field === ResearchField.Navigation) {
      return this.level === 0 ? "nav 1" : this.level === 2 ? "nav 2" : this.level === 4 ? "nav 3" : this.level === 5 ? "nav 4" : "";
    };
    if (this.field === ResearchField.GaiaProject) {
      return this.level === 5 ? 'g>vp' : "";
    };

    return '';
  }

  get resourceOffset () {
    return this.label ? -15 : 0;
  }

  get resources () {
    const events = researchTracks[this.field][this.level].map(s => new Event(s)).slice(0, 1);

    const rewards = Reward.merge(...events.map(ev => ev.rewards));

    if (events[0] && events[0].operator === Operator.Income) {
      rewards.unshift(new Reward('+', ResourceEnum.None));
      rewards[0].count = '+' as any;
    }

    return rewards;
  }

  get highlighted (): boolean {
    return this.$store.state.gaiaViewer.context.highlighted.researchTiles.has(this.field + "-" + this.level);
  }
}
</script>

<style lang="scss">

svg {
  .researchTile {
    fill: none;
    stroke: #444;
    stroke-width: 1;

    &.trade {
      fill: orange;
    }
    &.ship {
      fill: gray;
    }
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

  text {
    font-family: arial;
    font-size: 10px;
    fill: black;

    &.levDesc {
      dominant-baseline: central;
      text-anchor: middle;
      fill: white;
      pointer-events: none;
    }

  }
}

</style>
