<template>
  <g>
    <circle :r="radius" :class="['planet-fill', planet]" style="pointer-events: none" />
    <circle :r="radius" :class="['planet-fill', 'faction-fill', fill]" v-if="faction" style="pointer-events: none" />
    <circle :r="radius" :class="['planet', planet]" />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import planets from "../data/planets";
import { Component, Prop } from "vue-property-decorator";
import { Planet as PlanetEnum, factions, Faction, factionPlanet } from "@gaia-project/engine";

@Component
export default class Planet extends Vue {
  @Prop()
  planet: PlanetEnum;

  @Prop()
  faction: Faction;

  get radius() {
    return planets[this.planet].radius;
  }

  get fill() {
    // Comment for planet staying planets!
    if (this.faction) {
      return factionPlanet(this.faction);
    }
    return this.planet;
  }
}
</script>

<style lang="scss">
@import "../stylesheets/planets.scss";

svg {
  .planet {
    stroke-width: 0.04;
    fill: none;
    pointer-events: none;

    // terra
    &.r {
      stroke: $terra;
    }
    // desert
    &.d {
      stroke: $desert;
    }
    // swamp
    &.s {
      stroke: $swamp;
    }
    // oxide
    &.o {
      stroke: $oxide;
    }
    // titanium
    &.t {
      stroke: $titanium;
    }
    // ice
    &.i {
      stroke: $ice;
    }
    // volcanic
    &.v {
      stroke: $volcanic;
    }
    // gaia
    &.g {
      stroke: $gaia;
    }
    // transdim
    &.m {
      stroke: $transdim;
    }
    // lost planet
    &.l {
      stroke: $lost;
    }
  }

  .planet-fill,
  .planet-stroke {
    .no-faction-fill &.faction-fill {
      display: none;
    }

    // terra
    &.r {
      fill: $terra;
    }
    // desert
    &.d {
      fill: $desert;
    }
    // swamp
    &.s {
      fill: $swamp;
    }
    // oxide
    &.o {
      fill: $oxide;
    }
    // titanium
    &.t {
      fill: $titanium;
    }
    // ice
    &.i {
      fill: $ice;
    }
    // volcanic
    &.v {
      fill: $volcanic;
    }
    // gaia
    &.g {
      fill: $gaia;
    }
    // transdim
    &.m {
      fill: $transdim;
    }
    // lost planet
    &.l {
      fill: $lost;
    }
  }
}
</style>
