<template>
  <svg :class='["stepInfo"]' width="250" height="50" viewBox="0 0 250 50">
    <text class="content" x="0" y="14">Steps:</text>
    <template v-for="i in [0, 1, 2, 3]" >
      <Token v-for="(planet, index) in planetsWithSteps(i)" :transform="`translate(${tokenX(i,index)}, 8)`" :class="['planet', planet]" :key="planet" :planet="planet" :scale="6"/>
      <text class="content" x="-6" y="14" :transform="`translate(${tokenX(i,2)},0)`" :key="i">{{i}}</text>
    </template>     
    <text class="content" x="0" y="34">Colonized:</text>
    <template v-for="(count, planet, index) in player.ownedPlanetsCount">
      <Token  :transform="`translate(${tokenColonizedX(index)}, 28)`"   :class="['planet', planet]" :key="index" :planet="planet" :scale="6" />    
      <text class="content" x="8" y="0" :transform="`translate(${tokenColonizedX(index)} , 34)`"  :key="index">{{count}}</text>
    </template>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { Player, factions } from '@gaia-project/engine';
import Token from './Token.vue';
import { planetsWithSteps } from '../data/factions';


@Component<StepInfo>({
  computed: {

    content() {
      return "content";
    },

    title() {
      return "title";
    },
    
  },
  components: {
    Token
  }
})
export default class StepInfo extends Vue {
  
  @Prop()
  player: Player;
  
  tokenX(step,index: number) {
    return 40 + 45*step +14*(step==0 && index==0? 1 : index)  ;
  }

  tokenColonizedX(index: number) {
    return 85 + 28*index  ;
  }

  get planet() {
    return factions[this.player.faction].planet;
  }

  planetsWithSteps(steps: number) {
    return planetsWithSteps(this.planet, steps);
  }

}
export default interface StepInfo {

}

</script>

<style lang="scss" scoped>

svg {
  &.stepInfo {
  
    .content {
      font-family: arial;
      font-size: 1rem;
      color: #212529;
      pointer-events: none;
    }

    
  }
}

</style>
