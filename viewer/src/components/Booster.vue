<template>
  <svg
    :class="['booster', { highlighted, disabled }]"
    v-b-tooltip
    :title="tooltip"
    width="60"
    height="120"
    viewBox="-32 -62 64 124"
    style="overflow: visible"
  >
    <rect
      x="-30"
      y="-60"
      width="60"
      height="120"
      rx="3"
      ry="3"
      stroke="black"
      stroke-width="1"
      class="booster-background"
      filter="url(#shadow-1)"
    />
    <line x1="-29" x2="29" y1="-8" y2="-8" stroke="#aaa" stroke-width="2" />
    <TechContent :content="event1" transform="translate(0, -33)" />
    <TechContent :content="event2" :transform="`translate(0, ${30 - (event2.startsWith('+') ? 4 : 0)})`" />
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, { tiles, Event, Booster as BoosterEnum } from "@gaia-project/engine";
import { eventDesc } from "../data/event";
import TechContent from "./TechContent.vue";

@Component<Booster>({
  components: {
    TechContent,
  },
})
export default class Booster extends Vue {
  @Prop()
  booster: BoosterEnum;

  @Prop()
  disabled: boolean;

  @Prop({ default: false, type: Boolean })
  highlighted: boolean;

  get tileObject() {
    return tiles.boosters[this.booster];
  }

  get event1() {
    return this.tileObject[0];
  }

  get event2() {
    return this.tileObject[1];
  }

  get title() {
    return this.booster;
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get tooltip() {
    return `- ${eventDesc(new Event(this.event1), this.engine.expansions)}\n- ${eventDesc(new Event(this.event2), this.engine.expansions)}`;
  }
}
</script>

<style lang="scss">
svg {
  &.booster {
    .booster-background {
      fill: var(--booster-tile);
    }
    .title {
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
    }
    .event1,
    .event2 {
      font-size: 12px;
      pointer-events: none;
    }

    &.highlighted .booster-background {
      stroke: var(--highlighted);
      cursor: pointer;
      stroke-width: 2px;
    }

    &.disabled {
      opacity: 0.5;
    }
  }
}
</style>
