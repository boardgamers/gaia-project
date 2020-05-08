<template>
  <g class="board-info">
    <rect x=-0.5 y=-0.5 width=19.5 height=8 rx=0.1 ry=0.1 fill="#ffffff37" stroke=black stroke-width=0.07 />
    <rect x=20 y=-0.5 width=17.5 height=2 rx=0.1 ry=0.1 fill="#ffffff37" stroke=black stroke-width=0.07 />
    <g transform="translate(0, 0.5)">
      <text class="board-text">
        <tspan class="faction-name" v-b-modal="faction" role="button">{{factionName}}</tspan>
      </text>
      <text class="board-text" x=21>
        TF: {{3 - data.terraformCostDiscount}}
      </text>
      <text class="board-text" x=26>
        NAV: {{data.range}}
      </text>
      <text class="board-text" x=31>
        <tspan>VP: {{data.victoryPoints}}</tspan>
        <tspan v-if="data.bid>0"> (-{{data.bid}})</tspan>
      </text>
    </g>
    <!-- Resources / Income -->
    <g transform="translate(0, 3)">
      <g>
        <text class="board-text">R</text>
        <g transform="translate(2.2, 0)">
          <Resource kind="c" :count="data.credits" transform="scale(0.1)"/>
          <text :class="['board-text', {maxResource: data.ores >= 30}]" transform="translate(1,0) scale(0.7)">/30</text>
        </g>
        <g transform="translate(5.5, 0)">
          <Resource kind="o" :count="data.ores" transform="scale(0.1)"/>
          <text :class="['board-text', {maxResource: data.ores >= 15}]" transform="translate(1,0) scale(0.7)">/15</text>
        </g>
        <g transform="translate(9, 0)">
          <Resource kind="k" :count="data.knowledge" transform="scale(0.1)"/>
          <text :class="['board-text', {maxResource: data.knowledge >= 15}]" transform="translate(1,0) scale(0.7)">/15</text>
        </g>
        <Resource kind="q" :count="data.qics" transform="translate(12.5,0) scale(0.1)"/>
      </g>
      <g transform="translate(0, 1.5)">
        <text class="board-text" x=0.25>I</text>
        <g transform="translate(2.2, 0)" v-if="income('c') > 0">
          <text class="board-text" transform="scale(0.7)">+{{income('c')}}</text>
        </g>
        <g transform="translate(5.5, 0)" v-if="income('o') > 0">
          <text class="board-text" transform="scale(0.7)">+{{income('o')}}</text>
        </g>
        <g transform="translate(9, 0)" v-if="income('k') > 0">
          <text class="board-text" transform="scale(0.7)">+{{income('k')}}</text>
        </g>
        <g transform="translate(12, 0)" v-if="income('q') > 0">
          <text class="board-text" transform="scale(0.7)">+{{income('q')}}</text>
        </g>
      </g>
      <g transform="translate(0,3.5) scale(0.8)">
        <text class="board-text">
          <tspan>GF: </tspan>
          <tspan v-if="data.gaiaformersInGaia>0">[{{data.gaiaformersInGaia}}]</tspan>
          <tspan>{{data.buildings.gf}}/{{data.gaiaformers}}</tspan>
        </text>
        <text class="board-text" x=6>Sat: {{data.satellites}}</text>
        <text class="board-text" x=10.3 v-if="spaceShips">Ship: {{data.ships}}/{{3+data.advancedShips}}</text>
        <text class="board-text" x=16 v-if="spaceShips">TM: {{data.tradeTokens + data.wildTradeTokens}}</text>
      </g>
    </g>
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import Resource from '../Resource.vue';
import {Building as BuildingEnum, Faction, Reward, Operator, Resource as ResourceEnum, factions, PlayerData, Player} from '@gaia-project/engine';

@Component({
  components: {
    Resource
  }
})
export default class BuildingGroup extends Vue {
  @Prop()
  faction: Faction;
  @Prop()
  data: PlayerData;
  @Prop()
  player: Player;

  get factionName(): string {
    return factions[this.faction].name;
  }

  get spaceShips(): boolean {
    return (this.$store.state.gaiaViewer.data.expansions % 2) === 1;
  }

  income(resource: ResourceEnum) {
    const index = this.player.income.search(new RegExp('[0-9]+' + resource));

    if (index < 0) {
      return 0;
    }

    return parseInt(this.player.income.substr(index));
  }
}

</script>
<style lang="scss">
  .maxResource {
    fill: red;
  }

  .board-info {
    g.resource {
      opacity: 1;
    }
  }
</style>
