<template>
  <div :class="['player-info', 'row', 'no-gutters', player.faction]" v-if="player && player.faction" :style="`background-color: ${factionColor}`">
    <div class="text">
      <b :class="['player-name', {dropped: player.dropped}]" @click="playerClick(player)">{{name}}</b> - <span v-b-modal="faction" class="faction-name" role="button">{{faction}}</span> - {{data.victoryPoints}}vp <span v-if="passed">(passed)</span>
      <br/>
      <span :class="{maxResource: data.credits >= 30}">{{data.credits}}c<small>/30</small></span>, <span :class="{maxResource: data.ores >= 15}">{{data.ores}}o<small>/15</small></span>, <span :class="{maxResource: data.knowledge >= 15}">{{data.knowledge}}k<small>/15</small></span>, {{data.qics}}q, [{{power('gaia')}}] {{power('area1')}}/{{power('area2')}}/{{power('area3')}} pw<br/>
      m: {{data.buildings.m}}/8, ts: {{data.buildings.ts}}/4, lab: {{data.buildings.lab}}/3<span v-if="data.buildings.PI">, PI</span><span v-if="data.buildings.ac1">, ac1</span><span v-if="data.buildings.ac2">, ac2</span>, gf: <span  v-if="data.gaiaformersInGaia>0">[{{data.gaiaformersInGaia}}]</span> {{data.buildings.gf}}/{{data.gaiaformers}}<br/>
      <span v-if="round<6">Income: {{player.income.replace(/,/g, ', ')}}<br/></span>
      Range: {{data.range}}, Terraforming cost: {{3 - data.terraformCostDiscount}}o<br/>
      <span v-if="faction === 'Ivits'">Fed value: {{player.fedValue }}, No fed value: {{player.structureValue - player.fedValue }} <br/></span> 
 
      <span style="white-space: nowrap; line-height: 1em">
        Steps: 
        <span v-for="i in [0, 1, 2, 3]" :key="i" :class="{'ml-2': i > 0}">
          <span v-for="planet in planetsWithSteps(i)" :key="planet"  >
            <svg width="16" height="20" viewbox="0 0 16 15" >
              <circle :cx="8" :cy="8" :r="6"  :class="['player-token', 'planet-fill', planet]" />
            </svg>
          </span> 
          <span>{{i}}</span>
        </span>
      </span><br/>
      <span style="line-height: 1em" v-if="hasPlanets">Colonized: 
        <span v-for="(count, planet) in player.ownedPlanetsCount"  :key="planet"  class="mr-2">
          <svg width="16" height="20" viewbox="0 0 16 15" >
            <circle :cx="8" :cy="8" :r="6"  :class="['player-token', 'planet-fill', planet]" />
          </svg>
        <span>{{count}} </span>
        </span>
      </span>
    </div>

    <div class="tiles row no-gutters pl-3 mt-1">
      <Booster v-if="data.tiles.booster" class="mb-1 mr-1" :booster="data.tiles.booster" :disabled="passed"/>
      <FederationTile v-for="(fed,i) in data.tiles.federations" class="mb-1 mr-1" :key="i" :federation="fed.tile" :used="!fed.green" :player="player.player" :numTiles="1"/>
      <TechTile v-for="tech in data.tiles.techs" :covered="!tech.enabled" class="mb-1 mr-1" :key="tech.pos" :pos="tech.pos" :player="player.player" />
      <SpecialAction v-for="(action, i) in player.actions" :action="action.rewards" :disabled="!action.enabled || passed" :key="action.action + '-' + i" />
    </div>
    <b-modal :id="faction" :title="faction" size="lg">
      <div v-html="tooltip"> </div>
    </b-modal>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { Player, factions, tiles, PlayerData, Planet, Federation, terraformingStepsRequired, Building, Condition } from '@gaia-project/engine';
import { factionColor } from '../graphics/utils';
import TechTile from './TechTile.vue';
import Booster from './Booster.vue';
import SpecialAction from './SpecialAction.vue';
import FederationTile from './FederationTile.vue';
import { factionDesc, planetsWithSteps } from '../data/factions';

@Component({
  computed: {
    data() {
      return this.player ? this.player.data : null;
    }
  },
  components: {
    TechTile,
    Booster,
    SpecialAction,
    FederationTile
  }
})
export default class PlayerInfo extends Vue {
  @Prop()
  player: Player;

  playerClick(player: Player) {
    this.$store.dispatch("gaiaViewer/playerClick", player);
  }

  get faction() {
    return factions[this.player.faction].name;
  }

  get name() {
    if (this.player.name) {
      return this.player.name;
    }
    return "Player " + (this.player.player + 1);
  }

  get factionColor() {
    return factionColor(this.player.faction);
  }

  get tooltip() {
      return factionDesc(this.player.faction);
  }

  get planet() {
    return factions[this.player.faction].planet;
  }

  planetsWithSteps(steps: number) {
    return planetsWithSteps(this.planet, steps);
  }

  get passed() {
    return (this.$store.state.gaiaViewer.data.passedPlayers || []).includes(this.player.player);
  }

  power(area: string) {
    return this.data.power[area] + (this.data.brainstone === area ? "(b)" : "");
  }

  get round() {
    return this.$store.state.gaiaViewer.data.round;
  }
  
  get hasPlanets() {
    return this.player.ownedPlanets.length > 0;
  }
}
export default interface PlayerInfo {
  data: PlayerData;
}

</script>

<style lang="scss">
.player-token {
  stroke: #111;
  pointer-events: none;
  stroke-width: 1;
}

.content {
  font-family: arial;
  font-size: 1rem;
  color: #212529;
  pointer-events: none;
}

.player-info {
  margin-bottom: 1em;
  padding-bottom: 0.5em;
  padding-left: 0.5em;
  padding-top: 0.2em;
  border-radius: 5px;

  position: relative;

  &::after {
    position: absolute;
    content: " ";
    background: rgba(white, 0.4);
    top: 0; bottom: 0; left: 0; right: 0;
  }

  &.bescods::after, &.firaks::after {
    background: rgba(white, 0.7);
  }

  .player-name {
    cursor: pointer;

    &.dropped {
      text-decoration: line-through;
    }
  }

  flex-wrap: nowrap !important;

  @media (max-width: 600px) {
    flex-wrap: wrap !important;
  }

  .tiles {
    align-content: baseline;
    align-items: center;
  }

  .tiles, .text {
    z-index: 1;
  }

  .faction-name {
    cursor: pointer;
  }

  .maxResource {
    color: red;
  }
}
</style>
