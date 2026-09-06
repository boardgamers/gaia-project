<template>
  <g>
    <!-- The flat planet disc - every consumer (map, faction wheel, condition icons, player board)
         shows this same flat fill. Owner decision: planets are always flat. -->
    <circle
      :r="radius"
      :class="['planet-fill', 'planet-disc', planet, { 'flat-pref': flatBuildings }].concat(...(classes || []))"
      style="pointer-events: none"
    />
    <circle :r="radius" :class="['planet-fill', 'faction-fill', fill]" v-if="faction" style="pointer-events: none" />
    <!-- The old sphere-gradient disc, kept in the template but permanently hidden by CSS (planets
         are flat now). Harmless to leave; easy to fully remove later. -->
    <circle
      :r="radius"
      :class="['planet-sphere', planet, { 'flat-pref': flatBuildings }]"
      style="pointer-events: none"
    />
    <circle :r="radius" :class="['planet', planet].concat(...(classes || []))" />
  </g>
</template>

<script lang="ts">
import { Faction, Planet as PlanetEnum } from "@gaia-project/engine";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import planets from "../data/planets";
import { factionPiecePlanet } from "../graphics/utils";

@Component
export default class Planet extends Vue {
  @Prop()
  planet: PlanetEnum;

  @Prop()
  faction: Faction;

  @Prop({ default: () => [] })
  classes: string[];

  /** Owner decision (2026-09): planets render FLAT always - treated as if the "flat buildings"
   * preference were on for planets specifically (buildings keep their own separate preference).
   * This drives the `.flat-pref` class on the disc/sphere, which keeps the disc's flat fill and
   * leaves the (already-hidden) sphere off. */
  get flatBuildings(): boolean {
    return true;
  }

  get radius() {
    return planets[this.planet].radius;
  }

  get fill() {
    // Comment for planet staying planets!
    if (this.faction) {
      return factionPiecePlanet(this.faction);
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
  }

  .accessible-space-map &.space-map .ship .planet.v {
    stroke-dasharray: 0.4;
    stroke-width: 0.3;
  }

  .planet {
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

      &.warn {
        stroke-width: 0.1;
        stroke: black;
      }
    }

    // titanium
    &.t {
      stroke: var(--titanium);
    }

    // ice
    &.i {
      stroke: var(--ice);

      &.highlighted:not(.warn) {
        stroke-width: 0.1;
        stroke: black;
      }
    }

    // volcanic
    &.v {
      stroke: var(--volcanic);
    }

    .accessible-space-map &.v {
      stroke-dasharray: 0.25;
      stroke-width: 0.15;
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
      stroke-dasharray: 0.25;
      stroke-width: 0.15;
    }

    // asteroid
    &.a {
      stroke: var(--asteroid);

      &.highlighted:not(.warn) {
        stroke-width: 0.1;
        stroke: black;
      }
    }

    // protoplanet
    &.p {
      stroke: var(--protoplanet);

      &.highlighted:not(.warn) {
        stroke-width: 0.1;
        stroke: black;
      }
    }

    // lost planet
    &.l {
      stroke: var(--lost);
    }
  }

  .ship {
    stroke: none;
  }

  // --- Sphere shading (space map only) -------------------------------------------------------
  // The map draws a dedicated `.planet-sphere` circle for the gradient so that the game-state
  // overrides (highlight / warn / faction-claim) can cleanly win over it; everywhere else, the
  // global `planets.css` rule shades the flat `.planet-fill` disc directly. The sphere is hidden
  // by default and only shown on the map.
  .planet-sphere {
    display: none;
  }

  // Owner decision (2026-09): planets render FLAT everywhere, always - the sphere gradient is
  // disabled. `.planet-sphere` stays `display: none` in every context (the default rule above);
  // the map's `.space-map` block below keeps only the game-state fill logic, no sphere reveal.
  &.space-map,
  .space-map & {
    // Flat planets: the disc keeps its normal flat fill (no suppression), the sphere stays hidden.
    // (All the old sphere-reveal and game-state sphere overrides were removed - there is no sphere
    // to coordinate with anymore.)
    .planet-sphere {
      display: none;
    }
  }

  // With "flat buildings" on, planets stay flat everywhere (not just on the map): undo the global
  // planets.css gradient on the flat disc. The `.flat-pref` class is repeated to out-specify both
  // the global `svg .planet-fill.<type>` rule and this file's own `.planet-fill.&.<type>` color
  // rules, so the plain color wins over the gradient.
  @each $p,
    $var
      in (
        r: --terra,
        d: --desert,
        s: --swamp,
        o: --oxide,
        t: --titanium,
        i: --ice,
        v: --volcanic,
        g: --gaia,
        m: --transdim,
        a: --asteroid,
        p: --protoplanet,
        l: --lost
      )
  {
    .planet-fill.flat-pref.flat-pref.#{$p} {
      fill: var(#{$var});
    }
  }

  .planet-fill {
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

    // asteroid
    &.a {
      fill: var(--asteroid);
    }

    // protoplanet
    &.p {
      fill: var(--protoplanet);
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

  .ship .planet-fill.i {
    fill: black;
  }
}
</style>
