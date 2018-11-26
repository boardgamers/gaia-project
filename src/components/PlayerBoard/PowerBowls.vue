<template>
  <g>
    <line x1=0 y1=0 :x2="-r*spacing" :y2="(isTerran ? -1 : 1) *2*r*sin60*spacing" stroke=black stroke-width=0.06px />
    <circle :r=2*r*spacing fill=none />
    <g>
      <circle :r=r fill="green" />
      <text>{{power('gaia')}}</text>
      <text class="label" y=2.6>G</text>
    </g>
    <g :transform="`translate(${-r*spacing}, ${2*r*sin60*spacing})`">
      <circle :r=r fill="purple" />
      <text>{{power('area1')}}</text>
      <text y=1.7 transform=scale(0.7) v-if="income('t')">+{{income('t')}}</text>
      <text class="label" x=-2.6>I</text>
    </g>
    <g :transform="`translate(${-r*spacing}, ${-2*r*sin60*spacing})`">
      <circle :r=r fill="purple" />
      <text>{{power('area2')}}</text>
      <text class="label" x=-2.6>II</text>
    </g>
    <g :transform="`translate(${2*r*spacing}, 0)`">
      <circle :r=r fill="purple" />
      <text>{{power('area3')}}</text>
      <text class="label" y=2.6 x=0>III</text>
    </g>
    <text class="label" transform="translate(-3.5, 0) scale(0.75)" v-if="income('pw')">+{{income('pw')}}</text>
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import Resource from '../Resource.vue';
import {Faction, Reward, FactionBoard, Operator, Resource as ResourceEnum, factions, PlayerData, Player} from '@gaia-project/engine';

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

  get r() {
    return 2;
  }

  get spacing() {
    return 1.1;
  }

  get sin60() {
    return 0.86602540378;
  }

  get isTerran() {
    return this.faction === Faction.Terrans;
  }

  power(area: string) {
    return this.data.power[area] + (this.data.brainstone === area ? "(b)" : "");
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
<style lang="scss" scoped>

circle {
  stroke-width: 0.05px;
  stroke: black;
}

text {
  fill: white;
  font-size: 1.2px;
  text-anchor: middle;
  dominant-baseline: mathematical;

  &.label {
    fill: #333;
  }
}

</style>
