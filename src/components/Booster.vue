<template>
  <svg :class='["booster", {highlighted, disabled}]' v-b-tooltip :title="tooltip" @click="onClick" width="60" height="120" viewBox="-32 -62 64 124">
    <rect x="-30" y="-60" width="60" height="120" rx="3" ry="3" stroke="black" stroke-width=0 fill="#777" />
    <line x1=-29 x2=29 y1=-8 y2=-8 stroke=#aaa stroke-width=2 />
    <TechContent :content=event1 transform="translate(0, -33)" />
    <TechContent :content=event2 :transform="`translate(0, ${30 - (event2.startsWith('+') ? 4 : 0)})`" />
    <rect x="-30" y="-60" width="60" height="120" rx="3" ry="3" stroke="black" stroke-width=1 fill="none" />
  </svg>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event } from '@gaia-project/engine';
import { eventDesc } from '../data/event';
import TechContent from './TechContent.vue';

@Component<Booster>({
  computed: {
    tileObject () {
      return tiles.boosters[this.booster];
    },

    event1 () {
      return this.tileObject[0];
    },

    event2 () {
      return this.tileObject[1];
    },

    title () {
      return this.booster;
    },

    tooltip () {
      return `- ${eventDesc(new Event(this.event1))}\n- ${eventDesc(new Event(this.event2))}`;
    }
  },
  components: {
    TechContent
  }
})
export default class Booster extends Vue {
  @Prop()
  booster: Booster;

  @Prop()
  disabled: boolean;

  onClick () {
    if (this.highlighted) {
      this.$store.dispatch("gaiaViewer/boosterClick", this.booster);
    }
  }

  get highlighted () {
    return this.$store.state.gaiaViewer.context.highlighted.boosters.has(this.booster);
  }
}
</script>

<style lang="scss">

svg {
  &.booster {
    .title {
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
    }
    .event1, .event2 {
      font-size: 12px;
      pointer-events: none;
    }

    &.highlighted > rect {
      stroke: #2C4;
      cursor: pointer;
      stroke-width: 2px;
    }

    &.disabled {
      opacity: 0.5;
    }
  }
}

</style>
