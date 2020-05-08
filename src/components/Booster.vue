<template>
  <svg :class='["booster", {highlighted, disabled}]' v-b-tooltip :title="tooltip" @click="onClick" width="76" height="50" viewBox="0 0 76 50">
    <rect x="1" y="1" width="74" height="48" rx="5" ry="5"/>
    <text class="title" x="6" y="12">{{title}}</text>
    <text class="event1" x="6" y="30">{{event1}}</text>
    <text class="event1" x="6" y="44">{{event2}}</text>
  </svg>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event } from '@gaia-project/engine';
import { eventDesc } from '../data/event';

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

<style lang="scss" scoped>

svg {
  &.booster {
    rect {
      stroke: #333;
      stroke-width: 1px;
      fill: white;
    }
    .title {
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
    }
    .event1, .event2 {
      font-size: 12px;
      pointer-events: none;
    }

    &.highlighted rect {
      stroke: #2C4;
      cursor: pointer;
    }

    &.disabled {
      stroke-opacity: 0.5;
      fill-opacity: 0.7;
    }
  }
}

</style>
