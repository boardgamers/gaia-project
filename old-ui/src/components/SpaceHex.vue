<template>
  <g :id="`${hex}`" class="space-hex-cell">
    <title v-text="tooltip" />
    <use xlink:href="#space-hex" :class="polygonClasses(hex)" @click="hexClick(hex)" />

    <use
      v-if="recentOpponentMove"
      xlink:href="#space-hex"
      class="recent-opponent-move"
      :data-recent-opponent-move="recentOpponentMove.command"
      pointer-events="none"
    />
    <use
      v-for="(l, i) in federationLines"
      :key="`fl-${i}`"
      :xlink:href="l.id"
      :transform="`rotate(${l.rotate})`"
      pointer-events="none"
    />
    <use v-if="powerHighlightClass" xlink:href="#space-hex" :class="['space-hex-federation', powerHighlightClass]" />
    <use
      v-if="mapModeHighlight !== null"
      xlink:href="#space-hex"
      :class="['space-hex-federation', 'planet', 'planet-fill', playerPlanet(mapModeHighlight)]"
    />

    <use
      v-if="lostFleetSpaceship"
      xlink:href="#space-hex"
      class="lost-fleet-spaceship__hex"
      :data-ship="lostFleetSpaceship"
      :style="{ fill: lostFleetSpaceshipColor }"
    />

    <g :transform="`rotate(${-contentRotation})`">
      <g
        v-if="lostFleetSectorBadge && !lostFleetSpaceship"
        :class="['lost-fleet-sector-badge', `lost-fleet-sector-badge--${lostFleetSectorBadge.kind}`]"
        :data-sector-type="lostFleetSectorBadge.kind"
        transform="translate(-0.84,-0.79)"
      >
        <rect :width="badgeWidth" height="0.34" rx="0.12" ry="0.12" />
        <text :x="badgeWidth / 2" y="0.17">{{ lostFleetSectorBadge.label }}</text>
      </g>
      <text class="sector-name" v-if="isCenter" x="0" y="0" dy="0.35">
        {{ hex.data.sector[0] === "s" ? parseInt(hex.data.sector.slice(1)) : parseInt(hex.data.sector) }}
      </text>
      <g v-if="lostFleetSpaceship" class="lost-fleet-spaceship">
        <text class="lost-fleet-spaceship__label" y="0" dy="0.315">{{ lostFleetSpaceshipLabel }}</text>
      </g>
      <Planet
        v-if="showPlanet"
        :planet="hex.data.planet"
        :faction="faction(hex.data.player)"
        :classes="planetClasses(hex)"
      />
      <Building
        style="stroke-width: 0.1"
        v-if="hex.data.building"
        :building="hex.data.building"
        :faction="faction(hex.data.player)"
        outline
        :flat="flat"
        transform="scale(1)"
      />
      <Building
        style="stroke-width: 0.1"
        v-if="highlightBuilding"
        :building="highlightBuilding.building"
        :faction="faction(highlightBuilding.player)"
        outline
        :flat="flat"
        transform="scale(1)"
      />
      <Building
        style="stroke-width: 0.1"
        v-if="hex.data.additionalMine !== undefined"
        :faction="faction(hex.data.additionalMine)"
        building="m"
        transform="translate(0.4, 0.2) scale(0.9)"
        class="additionalMine"
        :flat="flat"
        outline
      />
    </g>
  </g>
</template>

<script lang="ts">
import { Component } from "vue-property-decorator";
import CurrentHex from "../../../viewer/src/components/SpaceHex.vue";
import Building from "./Building.vue";
@Component({ components: { Building } })
export default class SpaceHex extends CurrentHex {}
</script>
