<template>
  <g>
    <!-- Plain flat fill for every consumer outside the space map (faction wheel, condition icons,
         player board, ...) - those stay exactly as they always looked. Only the map's planets get
         the sphere treatment below, via the `.space-map .planet-fill` rules further down. -->
    <circle
      :r="radius"
      :class="['planet-fill', 'planet-disc', planet, { 'flat-pref': flatBuildings }].concat(...classes)"
      style="pointer-events: none"
    />
    <circle :r="radius" :class="['planet-fill', 'faction-fill', fill]" v-if="faction" style="pointer-events: none" />
    <!-- Sphere shading: the radial-gradient disc (the same class carries the game-state `fill` - a
         faction recolor - and the CSS only swaps the gradient in when no such state fill applies).
         Drawn between the flat fill and the outline stroke so the stroke and every highlight
         variant (warn/highlighted/dash rings) keep working untouched. No drop shadow or night-side
         crescent - the owner asked for a clean lit sphere. -->
    <circle
      :r="radius"
      :class="['planet-sphere', planet, { 'flat-pref': flatBuildings }]"
      style="pointer-events: none"
    />
    <circle :r="radius" :class="['planet', planet].concat(...classes)" />
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

  @Prop()
  classes: string[];

  /** The player's "flat buildings" display preference, read the same place SpaceHex/Building/etc.
   * read it. When on, the map's planets keep their flat color discs (the sphere gradient is the
   * 3D look this preference turns off) - see the `.flat-planets` CSS gate below. */
  get flatBuildings(): boolean {
    return this.$store.state.preferences.flatBuildings;
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

  // `&.space-map`, not `.space-map` alone: Game.vue puts the `space-map` class ON the
  // SpaceMap.vue <svg> root itself, so the map's planets are its descendants, not nested under a
  // further `.space-map` element. `.space-map &` covers the remaining setups that wrap the map
  // in an extra `.space-map` container instead.
  &.space-map,
  .space-map & {
    .planet-sphere {
      display: block;
      pointer-events: none;
    }

    // The map's flat disc would pick up the global planets.css gradient (it IS a planet), which
    // would fight the dedicated sphere circle - keep it invisible here so only the sphere shows.
    // Scoped to `.planet-disc`: the faction-claim overlay, the FactionWheel legend rings and
    // SpaceHex's map-mode hex fill are separate `.planet-fill` circles that must keep their fill.
    .planet-fill.planet-disc {
      fill-opacity: 0;
    }

    // The sphere uses the same shared gradient as every other planet readout (planets.css), via
    // its planet-type class; it isn't a `.planet-fill`, so the global rule doesn't reach it -
    // point it at the gradient explicitly.
    @each $p in r, d, s, o, t, i, v, g, m, a, p, l {
      .planet-sphere.#{$p} {
        fill: url(#planet-gradient-#{$p});
      }
    }

    // Game states that recolor the planet must win over the sphere: a faction-claimed planet is
    // painted in the claiming faction's own planet color (with the sphere shading on top, since
    // the claim color IS a planet type), and a highlighted/selectable planet keeps its old solid
    // fill so the selection read never changes. In both cases the flat fill needs its opacity
    // back and the sphere hides.
    .planet-fill.planet-disc.faction-fill,
    .planet-fill.planet-disc.highlighted,
    .planet-fill.planet-disc.warn {
      fill-opacity: 1;
    }

    .planet-fill.planet-disc.highlighted ~ .planet-sphere,
    .planet-fill.planet-disc.warn ~ .planet-sphere {
      display: none;
    }

    // A claimed planet's gradient is the faction's planet type, not the hex's native one.
    @each $p in r, d, s, o, t, i, v, g, m, a, p, l {
      .planet-fill.planet-disc.faction-fill.#{$p} ~ .planet-sphere {
        fill: url(#planet-gradient-#{$p});
      }
    }

    // The "flat buildings" preference turns the sphere off too (the gradient IS the 3D look it
    // disables). `.flat-pref` is bound from the preference onto BOTH the disc and the sphere (see
    // the template), so: hide the sphere, and keep the disc's flat fill instead of suppressing it.
    // The flat-pref disc also overrides the global planets.css gradient via the extra class.
    .planet-sphere.flat-pref {
      display: none;
    }

    .planet-fill.planet-disc.flat-pref {
      fill-opacity: 1;
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
