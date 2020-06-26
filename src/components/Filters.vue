<template>
  <defs>
    <filter id="shadow-5">
      <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="2"></feMorphology>

      <feFlood flood-color="black" flood-opacity="1" result="PINK"></feFlood>
      <feComposite in="PINK" in2="DILATED" operator="in" result="OUTLINE"></feComposite>
      <feGaussianBlur in="OUTLINE" stdDeviation=4 result="BLURRED"/>

      <feMerge>
        <feMergeNode in="BLURRED" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="outline-1">
      <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="1"></feMorphology>

      <feFlood flood-color="black" flood-opacity="1" result="PINK"></feFlood>
      <feComposite in="PINK" in2="DILATED" operator="in" result="OUTLINE"></feComposite>

      <feMerge>
        <feMergeNode in="OUTLINE" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="outline-2">
      <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="2"></feMorphology>

      <feFlood flood-color="black" flood-opacity="1" result="PINK"></feFlood>
      <feComposite in="PINK" in2="DILATED" operator="in" result="OUTLINE"></feComposite>

      <feMerge>
        <feMergeNode in="OUTLINE" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <template v-for="[faction, r, g, b, x, s] in factionData">
      <filter :id="`color-${faction}`" :key=faction>
        <feColorMatrix type="matrix" result=A :values="`${r/x} 0 0 0 0
                                                ${g/x} 0 0 0 0
                                                ${b/x} 0 0 0 0
                                                  0    0   0 1 0`"/>
        <feColorMatrix in="A" type="saturate" :values="s"/>
      </filter>
    </template>
    <template v-for="[planet, r, g, b, x] in planetData">
      <filter :id="`color-planet-${planet}`" :key="'pl-' + planet">
        <feColorMatrix type="matrix" :values="`${r/(3*x)} ${r/(3*x)} ${r/(3*x)} 0 0
                                                        ${g/(3*x)} ${g/(3*x)} ${g/(3*x)} 0 0
                                                        ${b/(3*x)} ${b/(3*x)} ${b/(3*x)} 0 0
                                                          0    0   0 1 0`"/>
      </filter>
    </template>
  </defs>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import { Faction, Planet } from "@gaia-project/engine";
import { factionColor, planetColor } from "../graphics/utils";
export default class Filters extends Vue {
  get factionData () {
    const factions = Object.values(Faction);
    return factions.map(faction => {
      const color = (faction === Faction.Ambas || faction === Faction.Taklons) ? "#8A482C" : factionColor(faction);
      const darkness = (faction === Faction.Ambas || faction === Faction.Taklons) ? 1 : 0.5;
      const saturation = faction === (Faction.Ivits || faction === Faction.HadschHallas) ? 1.2 : 2;

      return [faction, parseInt(color.slice(1, 3), 16) / 255, parseInt(color.slice(3, 5), 16) / 255, parseInt(color.slice(5, 7), 16) / 255, darkness, saturation];
    });
  }

  get planetData () {
    const planets = Object.values(Planet).filter(pl => pl !== Planet.Empty);
    return planets.map(planet => {
      const color = planetColor(planet);
      const darkness = 1;

      return [planet, parseInt(color.slice(1, 3), 16) / 255, parseInt(color.slice(3, 5), 16) / 255, parseInt(color.slice(5, 7), 16) / 255, darkness];
    });
  }
}
</script>
