<template>
  <defs>
    <filter id="shadow-1" x="-20%" y="-20%" width="140%" height="140%">
      <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="1"></feMorphology>

      <feFlood flood-color="black" flood-opacity="0.8" result="PINK"></feFlood>
      <feComposite in="PINK" in2="DILATED" operator="in" result="OUTLINE"></feComposite>
      <feGaussianBlur in="OUTLINE" stdDeviation="2" result="BLURRED" />

      <feMerge>
        <feMergeNode in="BLURRED" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="drop-shadow-1" x="-20%" y="-20%" width="140%" height="140%">
      <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="0"></feMorphology>
      <feFlood flood-color="black" flood-opacity="1" result="BLACK"></feFlood>
      <feComposite in="BLACK" in2="DILATED" operator="in" result="OUTLINE"></feComposite>
      <feGaussianBlur in="OUTLINE" stdDeviation="2" result="BLURRED" />
      <feOffset in="BLURRED" dx="2" dy="2" result="DROPPED" />

      <feMerge>
        <feMergeNode in="DROPPED" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="shadow-5" x="-20%" y="-20%" width="140%" height="140%">
      <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="5"></feMorphology>

      <feFlood flood-color="black" flood-opacity="1" result="PINK"></feFlood>
      <feComposite in="PINK" in2="DILATED" operator="in" result="OUTLINE"></feComposite>
      <feGaussianBlur in="OUTLINE" stdDeviation="1" result="BLURRED" />

      <feMerge>
        <feMergeNode in="BLURRED" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="white-shadow-1" x="-20%" y="-20%" width="140%" height="140%">
      <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="1"></feMorphology>

      <feFlood flood-color="white" flood-opacity="0.8" result="PINK"></feFlood>
      <feComposite in="PINK" in2="DILATED" operator="in" result="OUTLINE"></feComposite>
      <feGaussianBlur in="OUTLINE" stdDeviation="3" result="BLURRED" />

      <feMerge>
        <feMergeNode in="BLURRED" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="white-shadow-5" x="-20%" y="-20%" width="140%" height="140%">
      <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="5"></feMorphology>

      <feFlood flood-color="white" flood-opacity="0.8" result="PINK"></feFlood>
      <feComposite in="PINK" in2="DILATED" operator="in" result="OUTLINE"></feComposite>
      <feGaussianBlur in="OUTLINE" stdDeviation="4" result="BLURRED" />

      <feMerge>
        <feMergeNode in="BLURRED" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="outline-1">
      <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="1"></feMorphology>

      <feFlood flood-color="black" flood-opacity="0.8" result="PINK"></feFlood>
      <feComposite in="PINK" in2="DILATED" operator="in" result="OUTLINE"></feComposite>

      <feMerge>
        <feMergeNode in="OUTLINE" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="outline-2">
      <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="2"></feMorphology>

      <feFlood flood-color="black" flood-opacity="0.8" result="PINK"></feFlood>
      <feComposite in="PINK" in2="DILATED" operator="in" result="OUTLINE"></feComposite>

      <feMerge>
        <feMergeNode in="OUTLINE" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <template v-for="[faction, r, g, b, x, s] in factionData">
      <filter :id="`color-${faction}`" :key="faction">
        <feColorMatrix
          type="matrix"
          result="A"
          :values="`${r / x} 0 0 0 0
                                                ${g / x} 0 0 0 0
                                                ${b / x} 0 0 0 0
                                                  0    0   0 1 0`"
        />
        <feColorMatrix in="A" type="saturate" :values="s" />
      </filter>
    </template>
    <template v-for="[planet, r, g, b, x] in planetData">
      <filter :id="`color-planet-${planet}`" :key="'pl-' + planet">
        <feColorMatrix
          type="matrix"
          :values="`${r / (3 * x)} ${r / (3 * x)} ${r / (3 * x)} 0 0
                                                        ${g / (3 * x)} ${g / (3 * x)} ${g / (3 * x)} 0 0
                                                        ${b / (3 * x)} ${b / (3 * x)} ${b / (3 * x)} 0 0
                                                          0    0   0 1 0`"
        />
      </filter>
    </template>
    <!-- Planet sphere-shading gradients + shared geometry. These live in THIS single static <defs>
         (Filters.vue already declares one) rather than a separate PlanetGradients.vue <defs>, so
         the map still renders exactly 3 <defs> blocks - the invariant SpaceMap.spec.ts asserts to
         guard against defs being duplicated per hex. One radialGradient per planet type (palette
         from data/planets.ts's `gradient`, white-falloff default) - Planet.vue fills each map
         planet with it. SVG-1.1 attrs only (no `href`, no CSS `fill` on stops) for the older
         renderers the CDN stack meets. -->
    <radialGradient
      v-for="g in planetGradients"
      :id="`planet-gradient-${g.id}`"
      :key="`pg-${g.id}`"
      cx="0.38"
      cy="0.32"
      r="0.95"
    >
      <stop offset="0" :stop-color="g.light" />
      <stop :offset="g.midOffset" :stop-color="g.base" />
      <stop offset="1" :stop-color="g.dark" />
    </radialGradient>
  </defs>
</template>
<script lang="ts">
import { Expansion, Faction, Planet } from "@gaia-project/engine";
import { Component, Vue } from "vue-property-decorator";
import { planetGradients } from "../../data/planets";
import { factionColor, planetColor } from "../../graphics/utils";

function getDarkness(faction: string): number {
  switch (faction) {
    case Faction.Ambas:
    case Faction.Taklons:
      return 2;
    case Faction.Bescods:
    case Faction.Firaks:
      return 2.4;
    case Faction.Itars:
    case Faction.Nevlas:
      return 0.8;
    default:
      return 1.2;
  }
}

@Component
export default class Filters extends Vue {
  get factionData() {
    const factions = ["gen", "gaia", ...Faction.values(Expansion.All)];
    return factions.map((faction) => {
      /* Gaia faction is used for gaia-colored gaia formers for Baltaks */
      const color = faction === "gaia" ? planetColor(Planet.Gaia) : factionColor(faction as Faction);
      const darkness = getDarkness(faction);
      const saturation = faction === (Faction.Ivits || faction === Faction.HadschHallas) ? 1 : 1.5;

      return [
        faction,
        parseInt(color.slice(1, 3), 16) / 255,
        parseInt(color.slice(3, 5), 16) / 255,
        parseInt(color.slice(5, 7), 16) / 255,
        darkness,
        saturation,
      ];
    });
  }

  get planetData() {
    const planetList = Planet.values(Expansion.All).filter((pl) => pl !== Planet.Empty) as Exclude<
      Planet,
      Planet.Empty
    >[];
    return planetList.map((planet) => {
      const color = planetColor(planet);
      const darkness = 1;

      return [
        planet,
        parseInt(color.slice(1, 3), 16) / 255,
        parseInt(color.slice(3, 5), 16) / 255,
        parseInt(color.slice(5, 7), 16) / 255,
        darkness,
      ];
    });
  }

  /** Sphere-shading gradients above, driven by the shared per-planet stops (data/planets.ts's
   *  `planetGradients()`), so the map and the research board shade every planet identically. */
  get planetGradients() {
    return planetGradients();
  }
}
</script>
