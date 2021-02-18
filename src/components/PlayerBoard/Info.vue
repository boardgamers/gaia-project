<template>
  <g class="board-info">
    <rect
      x="-0.5"
      y="-0.5"
      width="19.5"
      height="8"
      rx="0.1"
      ry="0.1"
      fill="#ffffff37"
      stroke="black"
      stroke-width="0.07"
    />
    <g transform="translate(0, 0.5)">
      <text class="board-text">
        <tspan class="faction-name" v-b-modal="faction" role="button">{{ factionName }}</tspan>
      </text>
    </g>
    <!-- Resources / Income -->
    <g transform="translate(0, 3)">
      <g>
        <text class="board-text">R</text>
        <g transform="translate(2.2, 0)">
          <Resource kind="c" :count="data.credits" transform="scale(0.1)" />
          <text :class="['board-text', { maxResource: data.ores >= 30 }]" transform="translate(1,0) scale(0.7)"
            >/30</text
          >
        </g>
        <g transform="translate(5.5, 0)">
          <Resource kind="o" :count="data.ores" transform="scale(0.1)" />
          <text :class="['board-text', { maxResource: data.ores >= 15 }]" transform="translate(1,0) scale(0.7)"
            >/15</text
          >
        </g>
        <g transform="translate(9, 0)">
          <Resource kind="k" :count="data.knowledge" transform="scale(0.1)" />
          <text :class="['board-text', { maxResource: data.knowledge >= 15 }]" transform="translate(1,0) scale(0.7)"
            >/15</text
          >
        </g>
        <Resource kind="q" :count="data.qics" :center-left="true" transform="translate(12.5,0) scale(0.1)" />
        <g transform="translate(15, -3) scale(0.2)">
          <VictoryPoint width="15" height="15" />
          <text class="vp-text" x="7" y="10">{{ data.victoryPoints }}</text>
          <g transform="translate(13.5,2)" v-if="data.bid">
            <circle r="3" fill="white" stroke="black" stroke-width="0.2" />
            <text style="text-anchor: middle; dominant-baseline: central; font-size: 5px">-{{ data.bid }}</text>
          </g>
        </g>
        <g transform="translate(16, 1)" v-b-tooltip title="Satellites and space stations">
          <image xlink:href='../../assets/resources/satellite.svg' :height=155/211*22 width=22 x=-11 y=-8
          transform="scale(0.07)" />
          <text :class="['board-text']" transform="translate(1,0) scale(0.7)">{{
            data.satellites + data.buildings.sp
          }}</text>
        </g>
        <g transform="translate(16, 2.2)" v-b-tooltip title="Sectors with a colonized planet">
          <image xlink:href='../../assets/conditions/sector.svg' :height=155/211*22 width=22 x=-11 y=-8
          transform="scale(0.07)" />
          <text :class="['board-text']" transform="translate(1,0) scale(0.7)">{{ sectors }}</text>
        </g>
        <g transform="translate(16, 3.6)" v-b-tooltip title="Power value of structures in / outside of federations">
          <image xlink:href='../../assets/conditions/federation.svg' :height=155/211*22 width=22 x=-11 y=-8
          transform="scale(0.08)" />
          <text :class="['board-text']" transform="translate(1,0) scale(0.7)"
            >{{ player.fedValue }}/{{ player.structureValue - player.fedValue }}</text
          >
        </g>
      </g>
      <g transform="translate(0, 1.5)" v-if="engine.round < 6">
        <text class="board-text" x="0.25">I</text>
        <g transform="translate(2.2, 0)" v-if="income('c') > 0">
          <text class="board-text" transform="scale(0.7)">+{{ income("c") }}</text>
        </g>
        <g transform="translate(5.5, 0)" v-if="income('o') > 0">
          <text class="board-text" transform="scale(0.7)">+{{ income("o") }}</text>
        </g>
        <g transform="translate(9, 0)" v-if="income('k') > 0">
          <text class="board-text" transform="scale(0.7)">+{{ income("k") }}</text>
        </g>
        <g transform="translate(12, 0)" v-if="income('q') > 0">
          <text class="board-text" transform="scale(0.7)">+{{ income("q") }}</text>
        </g>
      </g>
      <g v-for="i in 6" :key="i" :transform="`translate(${i * 2},3.5) scale(1)`">
        <polygon
          points="-7.5,3 -3,7.5 3,7.5 7.5,3 7.5,-3 3,-7.5 -3,-7.5 -7.5,-3"
          transform="scale(0.1)"
          :class="['researchTile', researchType(i - 1)]"
        />
        <text :class="['board-text', researchType(i - 1)]" transform="scale(0.7)" x="-.35" y="-.1">{{
          research(i - 1)
        }}</text>
      </g>
    </g>
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { uniq } from "lodash";
import Resource from "../Resource.vue";
import { Faction, factions, Player, PlayerData, ResearchField, Resource as ResourceEnum } from "@gaia-project/engine";
import VictoryPoint from "../Resources/VictoryPoint.vue";

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

  income (resource: ResourceEnum) {
    const index = this.player.income.search(new RegExp("[0-9]+" + resource));

    if (index < 0) {
      return 0;
    }

    return parseInt(this.player.income.substr(index));
  }

  researchType (index: number): ResearchField {
    return ResearchField.values()[index];
  }

  research (index: number): number {
    return this.data.research[this.researchType(index)];
  }

  get sectors (): number {
    return uniq(this.data.occupied.filter(hex => hex.colonizedBy(this.player.player)).map(hex => hex.data.sector))
      .length;
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
