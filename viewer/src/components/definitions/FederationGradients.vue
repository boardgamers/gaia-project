<template>
  <g>
    <linearGradient
      v-for="p in planetColors"
      :key="`lg-${p.planet}`"
      :id="`federation-gradient-line-${p.planet}`"
      gradientUnits="userSpaceOnUse"
      x1="-1"
      y1="-1"
      x2="1"
      y2="1"
      gradientTransform="rotate(135)"
    >
      <stop offset="40%" stop-opacity="0" />
      <stop offset="50%" stop-opacity="1" :stop-color="p.color" />
      <stop offset="60%" stop-opacity="0" />
    </linearGradient>

    <line
      v-for="p in planetColors"
      :key="`l-${p.planet}`"
      :id="`federation-line-${p.planet}`"
      x1="0"
      y1="0"
      x2="0"
      y2="0.9"
      :stroke="`url(#federation-gradient-line-${p.planet})`"
      stroke-width="1"
      opacity=".5"
    />

    <linearGradient
      v-for="p in planetColors"
      :key="`blg-${p.planet}`"
      :id="`federation-gradient-big-line-${p.planet}`"
      gradientUnits="userSpaceOnUse"
      x1="-1"
      y1="-1"
      x2="1"
      y2="1"
      gradientTransform="rotate(135)"
    >
      <stop offset="10%" stop-opacity="0" />
      <stop offset="50%" stop-opacity="1" :stop-color="p.color" />
      <stop offset="90%" stop-opacity="0" />
    </linearGradient>

    <line
      v-for="p in planetColors"
      :key="`bl-${p.planet}`"
      :id="`federation-big-line-${p.planet}`"
      x1="0"
      y1="0"
      x2="0"
      y2="0.9"
      :stroke="`url(#federation-gradient-big-line-${p.planet})`"
      stroke-width="1"
    />

    <radialGradient
      v-for="p in planetColors"
      :key="`rg-${p.planet}`"
      :id="`federation-gradient-arc-${p.planet}`"
      gradientUnits="userSpaceOnUse"
      cx="0"
      cy="0"
      r="3"
    >
      <stop offset="41%" stop-opacity="0" />
      <stop offset="50%" stop-opacity=".5" :stop-color="p.color" />
      <stop offset="59%" stop-opacity="0" />
    </radialGradient>

    <path
      v-for="p in planetColors"
      :key="`arc-${p.planet}`"
      :id="`federation-arc-${p.planet}`"
      d="M 1.5 0 A 1.5 1.5 0 0 0 0.7500000000000002 -1.299038105676658"
      fill="none"
      :stroke="`url(#federation-gradient-arc-${p.planet})`"
      stroke-width=".7"
      transform="translate(-1.52,.86)"
    />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import planets from "../../data/planets";

@Component
export default class FederationGradients extends Vue {
  // Planet colours are static, so these federation gradient/line/arc defs are
  // identical for every hex. They are defined once here (globally) instead of
  // being re-rendered inside all ~90 SpaceHex components on every map re-render.
  planetColors = Object.entries(planets).map((e) => ({ planet: e[0], color: e[1].color }));
}
</script>
