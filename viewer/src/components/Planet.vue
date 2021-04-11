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
import { Planet as PlanetEnum, factions, Faction } from "@gaia-project/engine";
import {factionPlanet} from "@gaia-project/engine/src/factions";

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
svg {
  .planet {
    stroke-width: 0.04;
    fill: none;
    pointer-events: none;

    // terra
    &.r {
      stroke: var(--terra);
    }
    // desert
    &.d {
      stroke: var(--desert);
    }
    // swamp
    &.s {
      stroke: var(--swamp);
    }
    // oxide
    &.o {
      stroke: var(--oxide);
    }
    // titanium
    &.t {
      stroke: var(--titanium);
    }
    // ice
    &.i {
      stroke: var(--ice);
    }
    // volcanic
    &.v {
      stroke: var(--volcanic);
    }
    .accessible-space-map &.v {
      stroke-dasharray: 0.25;
      stroke-width: 0.1;
    }
    // gaia
    &.g {
      stroke: var(--gaia);
    }
    .accessible-space-map &.g {
      stroke-dasharray: 0.14;
      stroke-width: 0.1;
    }
    // transdim
    &.m {
      stroke: var(--transdim);
    }
    .accessible-space-map &.m {
      stroke-dasharray: 0.14;
      stroke-width: 0.1;
    }
    // lost planet
    &.l {
      stroke: var(--lost);
    }
  }

  .planet-fill,
  .planet-stroke {
    .no-faction-fill &.faction-fill {
      display: none;
    }
    // terra
    &.r {
      fill: var(--terra);
    }
    // desert
    &.d {
      fill: var(--desert);
    }
    // swamp
    &.s {
      fill: var(--swamp);
    }
    // oxide
    &.o {
      fill: var(--oxide);
    }
    // titanium
    &.t {
      fill: var(--titanium);
    }
    // ice
    &.i {
      fill: var(--ice);
    }
    // volcanic
    &.v {
      fill: var(--volcanic);
    }
    // gaia
    &.g {
      fill: var(--gaia);
    }
    // transdim
    &.m {
      fill: var(--transdim);
    }
    // lost planet
    &.l {
      fill: var(--lost);
    }
    // generic planet
    &.gen {
      fill: var(--generic);
    }
    //diggable planet
    &.dig {
      fill: var(--dig);
    }
  }
}
</style>
