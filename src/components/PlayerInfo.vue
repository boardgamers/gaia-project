<template>
  <div :class="['player-info', player.faction]" v-if="player && player.faction" :style="`background-color: ${factionColor}`">
    <div class="text">
      <b>{{name}}</b> - <span v-b-tooltip.hoover.html="factionDesc" >{{faction}}</span> - {{data.victoryPoints}}vp <span v-if="passed">(passed)</span><br/>
      {{data.credits}}c, {{data.ores}}o, {{data.knowledge}}k, {{data.qics}}q, [{{power('gaia')}}] {{power('area1')}}/{{power('area2')}}/{{power('area3')}} pw<br/>
      m: {{data.buildings.m}}/8, ts: {{data.buildings.ts}}/4, lab: {{data.buildings.lab}}/3<span v-if="data.buildings.PI">, PI</span><span v-if="data.buildings.ac1">, ac1</span><span v-if="data.buildings.ac2">, ac2</span>, gf: <span  v-if="data.gaiaformersInGaia>0">[{{data.gaiaformersInGaia}}]</span> {{data.buildings.gf}}/{{data.gaiaformers}}<br/>
      <span v-if="round<6">Income: {{player.income.replace(/,/g, ', ')}}</span> <br/>
      Range: {{data.range}}, Terraforming cost: {{3 - data.terraformCostDiscount}}o<br/>
      <span v-if="faction === 'Ivits'">Fed value: {{player.progress.structureFedValue }}, No fed value: {{player.progress.structureValue - player.progress.structureFedValue }} <br/></span> 

      <span style="white-space: nowrap; line-height: 1em">
        Steps: 
        <span v-for="i in [0, 1, 2, 3]" :key="i" :class="{'ml-2': i > 0}">
          <i v-for="planet in planetsWithSteps(i)" :class="['planet', planet]" :key="planet" /> {{i}}
        </span>
      </span><br/>
      <span style="line-height: 1em">Colonized: <span v-for="(count, planet, index) in player.ownedPlanets" :class="{'ml-2': index > 0}"><i :class="['planet', planet]" :key="planet" /> {{count}} </span></span>
    </div>
    <div class="tiles">
      <Booster v-if="data.tiles.booster" class="mb-1" :booster="data.tiles.booster" :disabled="passed"/>
      <FederationTile v-for="(fed,i) in data.tiles.federations" class="mb-1" :key="i" :federation="fed.tile" :used="!fed.green" :player="player.player" :numTiles="1"/>
      <TechTile v-for="tech in data.tiles.techs" :covered="!tech.enabled" class="mb-1" :key="tech.pos" :pos="tech.pos" :player="player.player" />
      <SpecialAction v-for="(action, i) in player.actions" :action="action.rewards" :disabled="!action.enabled || passed" :key="action.action + '-' + i" />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { Player, factions, tiles, PlayerData, Planet, Federation, terraformingStepsRequired, Building, Condition } from '@gaia-project/engine';
import { factionColor } from '@/graphics/utils';
import TechTile from './TechTile.vue';
import Booster from './Booster.vue';
import SpecialAction from './SpecialAction.vue';
import FederationTile from './FederationTile.vue';
import { factionDesc } from '@/data/factions';

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

  get factionDesc() {
      return `<b>Ability: </b> ${factionDesc[this.player.faction].ability} </br><b>PI: </b> ${factionDesc[this.player.faction].PI} `;
  }

  get planet() {
    return factions[this.player.faction].planet;
  }

  planetsWithSteps(steps: number) {
    const list = [Planet.Terra, Planet.Desert, Planet.Swamp, Planet.Oxide, Planet.Volcanic, Planet.Titanium, Planet.Ice];

    return list.filter(p => terraformingStepsRequired(this.planet, p) === steps);
  }

  get passed() {
    return (this.$store.state.game.data.passedPlayers || []).includes(this.player.player);
  }

  power(area: string) {
    return this.data.power[area] + (this.data.brainstone === area ? "(b)" : "");
  }

  get round() {
    return this.$store.state.game.data.round;
  }

  get progress() {
    return "";
  }
}
export default interface PlayerInfo {
  data: PlayerData;
}

</script>

<style lang="scss">
@import "../stylesheets/frontend.scss";

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

  @extend .row;
  @extend .no-gutters;
  flex-wrap: nowrap;

  .tiles {
    @extend .row;
    @extend .no-gutters;
    @extend .pl-3;
    @extend .mt-1;
    
    flex-wrap: wrap;
    align-content: baseline;
    align-items: center;

    svg {
      @extend .mr-1;
    }
  }

  .tiles, .text {
    z-index: 1;
  }
}
</style>
