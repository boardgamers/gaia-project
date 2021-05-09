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
    <TechContent :content="event2" :transform="`translate(0, ${30 - (event2.toString().startsWith('+') ? 4 : 0)})`" />
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Event, boosters } from "@gaia-project/engine";
import { eventDesc } from "../data/event";
import TechContent from "./TechContent.vue";

@Component<Booster>({
  computed: {
    tileObject(): Event[] {
      return boosters[this.booster];
    },

    event1(): Event {
      return this.tileObject[0];
    },

    event2(): Event {
      return this.tileObject[1];
    },

    title(): Booster {
      return this.booster;
    },

    tooltip() {
      return `- ${eventDesc(this.event1)}\n- ${eventDesc(this.event2)}`;
    },
  },
  components: {
    TechContent,
  },
})
export default class Booster extends Vue {
  @Prop()
  booster: Booster;

  @Prop()
  disabled: boolean;

  @Prop({ default: false, type: Boolean })
  highlighted: boolean;
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
