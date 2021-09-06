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
      <text class="faction-name">
        <tspan class="faction-name" v-b-modal.modal-center="faction" role="button">{{ factionName }}</tspan>
      </text>
    </g>
    <!-- Resources / Income -->
    <g transform="translate(0, 3)">
      <g>
        <text class="board-text">R</text>
        <g transform="translate(2.2, 0)">
          <Resource kind="c" :count="data.credits" transform="scale(0.1)" />
          <text :class="['board-text', { 'max-resource': data.ores >= 30 }]" transform="translate(1,0) scale(0.7)"
            >/30
          </text>
        </g>
        <g transform="translate(5.5, 0)">
          <Resource kind="o" :count="data.ores" transform="scale(0.1)" />
          <text :class="['board-text', { 'max-resource': data.ores >= 15 }]" transform="translate(1,0) scale(0.7)"
            >/15
          </text>
        </g>
        <g transform="translate(9, 0)">
          <Resource kind="k" :count="data.knowledge" transform="scale(0.1)" />
          <text :class="['board-text', { 'max-resource': data.knowledge >= 15 }]" transform="translate(1,0) scale(0.7)"
            >/15
          </text>
        </g>
        <Resource kind="q" :count="data.qics" :center-left="true" transform="translate(12.5,0) scale(0.1)" />
        <Undo v-if="canUndo" transform="translate(6.1,-10.9) scale(.08)" />
        <g transform="translate(15, -3) scale(0.2)">
          <VictoryPoint width="15" height="15" />
          <text class="vp-text" x="7" y="10">{{ data.victoryPoints }}</text>
          <g transform="translate(13.5,2)" v-if="data.bid">
            <circle r="3" fill="white" stroke="black" stroke-width="0.2" />
            <text style="text-anchor: middle; dominant-baseline: central; font-size: 5px">-{{ data.bid }}</text>
          </g>
        </g>
        <g transform="translate(15, 1)" v-b-tooltip title="Satellites and space stations, satellites left ">
          <image xlink:href="../../assets/resources/satellite.svg" :height=155/211*22 width="22" x="-11" y="-8"
          transform="scale(0.07)" />
          <text :class="['board-text']" transform="translate(1,0) scale(0.7)"
            >{{ data.satellites + data.buildings.sp }}, {{ satellitesLeft }}
          </text>
        </g>
        <g transform="translate(15, 2.2)" v-b-tooltip title="Sectors with a colonized planet">
          <image xlink:href="../../assets/conditions/sector.svg" :height=155/211*22 width="22" x="-11" y="-8"
          transform="scale(0.07)" />
          <text :class="['board-text']" transform="translate(1,0) scale(0.7)">{{ sectors }}</text>
        </g>
        <g
          transform="translate(15, 3.6)"
          v-b-tooltip
          title="Power value of structures in federations, outside of federations"
        >
          <image xlink:href="../../assets/conditions/federation.svg" :height=155/211*22 width="22" x="-11" y="-8"
          transform="scale(0.08)" />
          <text :class="['board-text']" transform="translate(1,0) scale(0.7)"
            >{{ player.fedValue }}, {{ player.structureValue - player.fedValue }}
          </text>
        </g>
        <circle
          r="1.7"
          v-for="(r, i) in ['c', 'o', 'k', 'q']"
          :key="i"
          :transform="`translate(${i * 3.5 + 2},0)`"
          style="opacity: 0"
          @click="convert(r)"
          v-b-tooltip.hover.html
          :disabled="!convertTooltip(r)"
          :style="convertTooltip(r) ? 'cursor: pointer' : ''"
          :title="convertTooltip(r)"
        />
      </g>
      <g transform="translate(0, 1.5)" v-if="!engine.isLastRound">
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
          :class="['board-info', 'research-tile', researchType(i - 1), researchClass(i - 1)]"
        />
        <text :class="['board-text', researchType(i - 1)]" transform="scale(0.7)" x="-.35" y="-.1"
          >{{ research(i - 1) }}
        </text>
      </g>
    </g>
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { uniq } from "lodash";
import Resource from "../Resource.vue";
import Undo from "../Resources/Undo.vue";
import {
  Faction,
  MAX_SATELLITES,
  Player,
  PlayerData,
  ResearchField,
  Resource as ResourceEnum,
} from "@gaia-project/engine";
import VictoryPoint from "../Resources/VictoryPoint.vue";
import { FastConversionEvent } from "../../data/actions";
import { factionName } from "../../data/factions";

@Component({
  components: {
    Resource,
    VictoryPoint,
    Undo,
  },
})
export default class PlayerBoardInfo extends Vue {
  @Prop()
  faction: Faction;

  @Prop()
  data: PlayerData;

  @Prop()
  player: Player;

  get engine() {
    return this.$store.state.gaiaViewer.data;
  }

  get canUndo() {
    return this.$store.getters["gaiaViewer/canUndo"] && this.engine.currentPlayer == this.player.player;
  }

  get factionName(): string {
    return factionName(this.faction);
  }

  convert(resource: ResourceEnum) {
    this.$store.dispatch("gaiaViewer/fastConversionClick", { button: resource } as FastConversionEvent);
  }

  convertTooltip(resource: ResourceEnum): string | null {
    if (this.engine.currentPlayer == this.player.player) {
      return this.$store.state.gaiaViewer.context.fastConversionTooltips[resource];
    }
  }

  income(resource: ResourceEnum) {
    const index = this.player.income.search(new RegExp("[0-9]+" + resource));

    if (index < 0) {
      return 0;
    }

    return parseInt(this.player.income.substr(index));
  }

  researchClass(index: number): string {
    return (
      this.$store.getters["gaiaViewer/researchClasses"].get(this.player.faction)?.get(this.researchType(index)) ?? ""
    );
  }

  researchType(index: number): ResearchField {
    return ResearchField.values()[index];
  }

  research(index: number): number {
    return this.data.research[this.researchType(index)];
  }

  get sectors(): number {
    return uniq(this.data.occupied.filter((hex) => hex.colonizedBy(this.player.player)).map((hex) => hex.data.sector))
      .length;
  }

  get satellitesLeft(): number {
    return MAX_SATELLITES - this.data.satellites;
  }
}
</script>
<style lang="scss">
.max-resource {
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

.board-info.research-tile.recent {
  stroke-width: 2;
  stroke: var(--recent);
}

.board-info.research-tile.current-round {
  stroke-width: 2;
  stroke: var(--current-round);
}
</style>
