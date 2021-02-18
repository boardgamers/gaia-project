<template>
  <g class="power-bowls">
    <line x1=0 y1=0 :x2="-r*spacing" :y2="(isTerran ? -1 : 1) *2*r*sin60*spacing" stroke=black stroke-width=0.06px />
    <circle :r=2*r*spacing fill=none />
    <g>
      <circle :r=r fill="#00aa00" />
      <Resource v-if="power('gaia')>0" :kind="'bowl-t'" :count="power('gaia')" :transform="`translate(${xPos('gaia')}, ${yPos('gaia')}) scale(0.11)`"/>
      <Resource v-if="brainstone('gaia')==1" :kind="'brainstone'"  :transform="`translate(${power('gaia')>0 ? 0.9 : 0}, ${yPos('gaia')}) scale(0.11)`"/>
      <Resource v-if="data.gaiaformersInGaia>0" :kind="'gf'" :count="data.gaiaformersInGaia" :faction="faction"  :transform="`translate(0, 0.7) scale(0.09)`"/>
    </g>
    <g :transform="`translate(${-r*spacing}, ${2*r*sin60*spacing})`">
      <circle :r=r class="power-bowl" />
      <Resource v-if="power('area1')>0" :kind="'bowl-t'" :count="power('area1')" :transform="`translate(${xPos('area1')}, 0) scale(0.11)`"/>
      <Resource v-if="brainstone('area1')==1" :kind="'brainstone'"  :transform="`translate(${power('area1')>0 ? 0.9 : 0}, 0) scale(0.11)`"/>
      <text y=1.7 transform=scale(0.7) v-if="income('t')">+{{income('t')}}</text>
      <text class="label" x=-2.6>I</text>
    </g>
    <g :transform="`translate(${-r*spacing}, ${-2*r*sin60*spacing})`">
      <circle :r=r class="power-bowl" />
      <Resource v-if="power('area2')>0" :kind="'bowl-t'" :count="power('area2')" :transform="`translate(${xPos('area2')}, 0) scale(0.11)`"/>
      <Resource v-if="brainstone('area2')==1" :kind="'brainstone'"  :transform="`translate(${power('area2')>0 ? 0.9 : 0}, 0) scale(0.11)`"/>

      <text class="label" x=-2.6>II</text>
    </g>
    <g :transform="`translate(${2*r*spacing}, 0)`">
      <circle :r=r class="power-bowl" />
      <Resource v-if="power('area3')>0" :kind="'bowl-t'" :count="power('area3')" :transform="`translate(${xPos('area3')}, 0) scale(0.11)`"/>
      <Resource v-if="brainstone('area3')==1" :kind="'brainstone'"  :transform="`translate(${power('area3')>0 ? 0.9 : 0}, 0) scale(0.11)`"/>

      <text class="label" y=2.6 x=0>III</text>
    </g>
    <text class="label" transform="translate(-3.5, 0) scale(0.75)" v-if="income('pw')">+{{income('pw')}}</text>
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import Resource from '../Resource.vue';
import Building from '../Building.vue';
import { Faction, Reward, FactionBoard, Operator, Resource as ResourceEnum, factions, PlayerData, Player } from '@gaia-project/engine';

@Component({
  components: {
    Resource,
    Building
  }
})
export default class BuildingGroup extends Vue {
  @Prop()
  faction: Faction;

  @Prop()
  data: PlayerData;

  @Prop()
  player: Player;

  get r () {
    return 2;
  }

  get spacing () {
    return 1.1;
  }

  get sin60 () {
    return 0.86602540378;
  }

  get isTerran () {
    return this.faction === Faction.Terrans;
  }

  xPos (area: string) {
    return this.brainstone(area) ? -0.9 : 0;
  }

  yPos (area: string) {
    return this.data.gaiaformersInGaia > 0 ? -0.5 : 0;
  }

  power (area: string) {
    return this.data.power[area];
  }

  brainstone (area: string) {
    return this.data.brainstone === area;
  }

  income (resource: ResourceEnum) {
    const index = this.player.income.search(new RegExp('[0-9]+' + resource));

    if (index < 0) {
      return 0;
    }

    return parseInt(this.player.income.substr(index));
  }

  get flat () {
    return this.$store.state.gaiaViewer.preferences.flatBuildings;
  }
}

</script>
<style lang="scss">
@import '../../stylesheets/planets.scss';

.power-bowls {
  circle {
    stroke-width: 0.05px;
    stroke: black;
  }

  .power-bowl {
    fill: purple;
  }

  .power {
    fill: $res-power;
  }

  .brainstone {
    fill: $res-power;
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
}

</style>
