<template>
  <g class="resource">
    <rect v-if="kind=='q'" class="qic" width="14" height="14" x="-7" y="-7" />
    <rect v-else-if="kind=='o'" class="ore" width="14" height="14" x="-7" y="-7" />
    <rect v-else-if="kind=='c'" class="credit" width="14" height="14" ry="7" rx="7" x="-7" y="-7" />
    <rect v-else-if="kind=='pw' || kind=='t'" class="power" width="14" height="14" ry="7" rx="7" x="-7" y="-7" />
    <Building v-else-if="kind=='k'" faction="terrans" building="gf" transform="translate(0.5, 0) scale(20)" />
    <Building v-else-if="kind=='gf'" faction="ivits" building="gf" transform="translate(0.5, 0) scale(20)" style="fill: none !important" />
    <text x="0" y="0" v-if="count && (['o','c','q','k','pw','t','vp','r','d'].includes(kind) || count === '+')" :class="{plus: count === '+'}">{{label(kind,count,level)}}</text>
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { Resource as ResourceEnum } from '@gaia-project/engine';
import Building from './Building.vue';

@Component({
  components: {
    Building
  }
})
export default class Resource extends Vue {
  @Prop()
  kind: Resource;

  @Prop()
  count: number;

  @Prop()
  level: number;

  label(kind,count,level): string {
       
    if (kind == 'd') {
      return this.level == 2 ? "cost 2" : this.level == 3 ? "cost 1" : "";
    };
    if (kind == 'r') {
      return this.level == 2 ? "nav 2" : this.level == 4 ? "nav 3" : this.level == 5 ? "nav 4" : "";
    };
      
    return kind !== 'vp' ? count : '4vp, g>vp';
  }

}
</script>


<style lang="scss">
g.resource {
  pointer-events: none;
  opacity: 0.7;

  .hide-research-track-resources & {
    display: none;
  }

  rect {
    stroke: #333;
    stroke-width: 0.8px;
  }

  .qic {
    fill: green;
  }

  .ore {
    fill: #bbb;
  }

  .credit {
    fill: #e8de24;
  }

  .power {
    fill: #a41894;
  }

  .building {
    stroke-width: 0.04px;
  }

  .ore, .credit, .building.r {
    & + text {
      fill: black
    }
  }

  text {
    font-family: arial;
    font-size: 10px;
    fill: white;
    dominant-baseline: central;
    text-anchor: middle;

    &.plus {
      font-size: 15px;
      font-weight: bold;
      
      fill: #333;
    }
  }
}
</style>
