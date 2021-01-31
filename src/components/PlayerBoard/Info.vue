<template>
  <g class="board-info">
    <rect x=-0.5 y=-0.5 width=19.5 height=8 rx=0.1 ry=0.1 fill="#ffffff37" stroke=black stroke-width=0.07 />
    <g transform="translate(0, 0.5)">
      <text class="board-text">
        <tspan class="faction-name" v-b-modal="faction" role="button">{{factionName}}</tspan>
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
        <Resource kind="q" :count="data.qics" :center-left=true transform="translate(12.5,0) scale(0.1)"/>
        <g transform="translate(15, -3) scale(0.2)">
          <VictoryPoint width="15" height="15"/>
          <text class="vp-text" x="7" y="10">{{data.victoryPoints}}</text>
          <g transform="translate(13.5,2)" v-if="data.bid">
            <circle r=3 fill="white" stroke="black" stroke-width=0.2 />
            <text style="text-anchor: middle; dominant-baseline: central; font-size: 5px">-{{data.bid}}</text>
          </g>
        </g>
      </g>
      <g transform="translate(0, 1.5)" v-if="engine.round < 6">
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
        <text class="board-text" x=0>{{researchOverview}}</text>
      </g>
    </g>
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import Resource from '../Resource.vue';
import { Building as BuildingEnum, Faction, Reward, Operator, Resource as ResourceEnum, factions, PlayerData, Player } from '@gaia-project/engine';
import VictoryPoint from '../Resources/VictoryPoint.vue';

@Component({
  components: {
    Resource,
    VictoryPoint
  }
})
export default class BuildingGroup extends Vue {
  @Prop()
  faction: Faction;

  @Prop()
  data: PlayerData;

  @Prop()
  player: Player;

  get engine () {
    return this.$store.state.gaiaViewer.data;
  }

  get factionName (): string {
    return factions[this.faction].name;
  }

  get spaceShips (): boolean {
    return (this.$store.state.gaiaViewer.data.expansions % 2) === 1;
  }

  income (resource: ResourceEnum) {
    const index = this.player.income.search(new RegExp('[0-9]+' + resource));

    if (index < 0) {
      return 0;
    }

    return parseInt(this.player.income.substr(index));
  }

  get researchOverview (): string {
    const r = this.data.research;
    return `Sat: ${this.data.satellites} TF: ${r.terra} Nav: ${r.nav} AI: ${r.int} GP: ${r.gaia} Eco: ${r.eco} Sci: ${r.sci}`;
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

  .vp-text {
    font-size: 7px;
    fill: white;
    font-weight: 600;
    text-anchor: middle;
  }
</style>
