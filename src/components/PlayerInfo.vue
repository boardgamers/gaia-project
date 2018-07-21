<template>
  <div class="player-info" v-if="player.faction" :style="`background-color: ${factionColor}`">
    <div class="text">
      <b>Player {{player.player + 1}}</b> - {{faction}} - {{data.victoryPoints}}vp <span v-if="passed">(passed)</span><br/>
      {{data.credits}}c, {{data.ores}}o, {{data.knowledge}}k, {{data.qics}}q, [{{power('gaia')}}] {{power('area1')}}/{{power('area2')}}/{{power('area3')}} pw<br/>
      Range: {{data.range}}, terraform level: {{data.terraformCostDiscount}}<br/>
      Income: {{player.income.replace(/,/g, ', ')}} <br/>
      Steps: 
      <span v-for="i in [0, 1, 2, 3]" :key="i" class="ml-2">
        <i v-for="planet in planetsWithSteps(i)" :class="['planet', planet]" :key="planet" /> {{i}}
      </span>
    </div>
    <div class="tiles">
      <Booster v-if="data.roundBooster" :booster="data.roundBooster" :disabled="passed"/>
      <TechTile v-for="tech in data.techTiles" :disabled="!tech.enabled" :key="tech.pos" :pos="tech.pos" :player="player.player" />
      <TechTile v-for="tech in data.advTechTiles" :key="tech.pos" :pos="tech.pos" :player="player.player" />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { Player, factions, tiles, PlayerData, Planet, terraformingStepsRequired } from '@gaia-project/engine';
import { factionColor } from '@/graphics/utils';
import TechTile from './TechTile.vue';
import Booster from './Booster.vue';

@Component({
  computed: {
    data() {
      return this.player ? this.player.data : null;
    }
  },
  components: {
    TechTile,
    Booster
  }
})
export default class PlayerInfo extends Vue {
  @Prop()
  player: Player;

  get faction() {
    return factions[this.player.faction].name;
  }

  get factionColor() {
    return factionColor(this.player.faction);
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

  @extend .row;
  @extend .no-gutters;

  .tiles {
    @extend .row;
    @extend .no-gutters;
    @extend .pl-3;
    @extend .mt-1;
    
    flex-wrap: wrap;

    svg {
      @extend .mr-1;
    }
  }

  .tiles, .text {
    z-index: 1;
  }
}
</style>
