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
        <g
          v-b-tooltip
          title="Leech network - number of upgradable buildings by other players within leeching distance"
          :transform="`translate(33.5,${height - 16.6}) scale(.08)`"
        >
          <image xlink:href="../../assets/other/network.svg" :height=155/211*22 width="22" x="0" y="0"
          transform="scale(2)" @click="toggleMapMode('leech')" style="cursor: pointer" />
          <text class="board-text" transform="translate(22,38) scale(10)" text-anchor="middle">
            {{ leechNetwork }}
          </text>
        </g>
        <g :transform="`translate(34.7,${height - 6.8}) scale(.1)`">
          <Undo v-if="canUndo" transform="translate(-8, -8) scale(.9)" />
          <use v-else xlink:href="#info" v-b-tooltip.html="buttonTooltip" />
        </g>
        <g transform="translate(15, -3) scale(0.2)">
          <VictoryPoint width="15" height="15" />
          <text class="vp-text" x="7" y="10">{{ data.victoryPoints }}</text>
          <g transform="translate(13.5,2)" v-if="data.bid">
            <circle r="3" fill="white" stroke="black" stroke-width="0.2" />
            <text style="text-anchor: middle; dominant-baseline: central; font-size: 5px">-{{ data.bid }}</text>
          </g>
        </g>
        <g transform="translate(15.2, 1.4)" v-b-tooltip title="Satellites and space stations, satellites left ">
          <image xlink:href="../../assets/other/satellite.svg" :height=155/211*22 width="22" x="-11" y="-8"
          transform="scale(0.07)" />
          <text class="board-text" transform="translate(1,0) scale(0.8)"
            >{{ data.satellites + data.buildings.sp }}, {{ satellitesLeft }}
          </text>
        </g>
        <g transform="translate(12.4, 3.5)" v-b-tooltip title="Sectors with a colonized planet">
          <image xlink:href="../../assets/conditions/sector.svg" :height=155/211*22 width="22" x="-11" y="-8"
          transform="scale(0.1)" @click="toggleMapMode('sectors')" style="cursor: pointer" />
          <text class="board-text" transform="translate(1.4,-.1) scale(0.8)" text-anchor="middle">{{ sectors }}</text>
        </g>
        <g
          transform="translate(15.2, 3.5)"
          v-b-tooltip
          title="Power value of structures in federations, outside of federations"
        >
          <image xlink:href="../../assets/conditions/federation.svg" :height=155/211*22 width="22" x="-11" y="-8"
          transform="scale(0.1)" @click="toggleMapMode('federations')" style="cursor: pointer" />
          <text class="board-text" transform="translate(1,-.1) scale(0.8)"
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
      <g transform="translate(0, 1.5)" v-if="showIncome">
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
      <g
        v-for="i in researchFields"
        :key="i"
        :transform="`translate(${(i * 2 + -1.4) * (isFrontiers ? 0.85 : 1)},3.5) scale(1)`"
      >
        <polygon
          points="-7.5,3 -3,7.5 3,7.5 7.5,3 7.5,-3 3,-7.5 -3,-7.5 -7.5,-3"
          :transform="`scale(${isFrontiers ? 0.085 : 0.1})`"
          :class="['board-info', 'research-tile', researchClass(i - 1)]"
          :style="`fill: ${researchStyle(i - 1).backgroundColor}`"
        />
        <text class="board-text" transform="scale(0.8)" x="-.35" y="-.15" :style="`fill: ${researchStyle(i - 1).color}`"
          >{{ research(i - 1) }}
        </text>
      </g>
    </g>
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Resource from "../Resource.vue";
import Undo from "../Resources/Undo.vue";
import Engine, {
  Expansion,
  Faction,
  MAX_SATELLITES,
  Player,
  PlayerData,
  ResearchField,
  Resource as ResourceEnum,
} from "@gaia-project/engine";
import VictoryPoint from "../Resources/VictoryPoint.vue";
import { FastConversionEvent, MapMode, MapModeType } from "../../data/actions";
import { factionName } from "../../data/factions";
import { showIncome } from "../../data/resources";
import { leechNetwork, sectors } from "../../data/stats";
import { CellStyle } from "../../graphics/colors";
import { researchColor } from "../../data/research";

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
  height: number;

  @Prop()
  player: Player;

  get engine(): Engine {
    return this.$store.state.data;
  }

  get isFrontiers() {
    return this.engine.expansions == Expansion.Frontiers;
  }

  get researchFields(): number {
    return ResearchField.values(this.engine.expansions).length;
  }

  get canUndo() {
    return this.$store.getters.canUndo && this.engine.currentPlayer == this.player.player;
  }

  get factionName(): string {
    return factionName(this.faction);
  }

  convert(resource: ResourceEnum) {
    this.$store.dispatch("fastConversionClick", { button: resource } as FastConversionEvent);
  }

  toggleMapMode(mode: MapModeType) {
    this.$store.commit("toggleMapMode", { type: mode, player: this.player.player } as MapMode);
  }

  convertTooltip(resource: ResourceEnum): string | null {
    if (this.engine.currentPlayer == this.player.player) {
      return this.$store.state.context.fastConversionTooltips[resource];
    }
  }

  get buttonTooltip() {
    return "<ul>" +
      "<li>Click on the faction name to see the faction rules (and there's a dropdown to see all faction rules)</li>" +
      "<li>Click on the buildings to see their cost, income, and power value</li>" +
      "<li>Click on the resources to get an additional resource of this kind (using the best conversion available)</li>" +
      "<li>Click on the power bowls to gain (area 1) or burn (area 3) tokens (the gaia area has faction dependent actions)</li>" +
      "<li>Click on the planets to highlight all planets of this type</li>" +
      "<li>Click on the sectors icon to highlight all colonized sectors (also works for other players)</li>" +
      "<li>Click on the federation icon to highlight all federation (also works for other players)</li>" +
      "<li>Click on the network icon (right of power bowl) to leech network - how much power can be gained if other players upgrade buildings</li>" +
      "</ul>";
  }

  income(resource: ResourceEnum) {
    return this.player.resourceIncome(resource);
  }

  get showIncome() {
    return showIncome(this.engine, this.player);
  }

  researchClass(index: number): string {
    return this.$store.getters.researchClasses.get(this.player.faction)?.get(this.researchType(index)) ?? "";
  }

  researchType(index: number): ResearchField {
    return ResearchField.values(this.engine.expansions)[index];
  }

  research(index: number): number {
    return this.data.research[this.researchType(index)];
  }

  researchStyle(index: number): CellStyle {
    return researchColor(this.researchType(index));
  }

  get sectors(): number {
    return sectors(this.player);
  }

  get satellitesLeft(): number {
    return MAX_SATELLITES - this.data.satellites;
  }

  get leechNetwork(): number {
    return leechNetwork(this.engine, this.player.player);
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
