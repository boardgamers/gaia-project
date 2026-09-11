<template>
  <g class="building-group">
    <rect
      :x="0"
      y="-1.2"
      :width="width"
      height="2.4"
      stroke="black"
      stroke-width="0.07"
      fill="#ffffff44"
      rx="0.2"
      ry="0.2"
    />
    <Resource
      v-if="factionIncome.length > 0"
      :kind="factionIncome[0].type"
      :count="factionIncome[0].count"
      transform="translate(0.77, 0) scale(0.07)"
    />
    <g
      v-for="i in buildingList"
      :transform="`translate(${(i + 0.5) * buildingSpacing + offset}, 0)`"
      :key="i"
      v-b-tooltip
      :title="tooltip(i)"
    >
      <circle stroke="black" stroke-width="0.07" fill="white" r="1" :key="i" v-if="!isPI" />
      <rect
        stroke="black"
        stroke-width="0.07"
        fill="white"
        :x="-2.2 + offset"
        width="4"
        y="-1"
        height="2"
        :key="i"
        v-else
      />
      <Building
        :building="building"
        class="old-building-in-group"
        :faction="faction"
        :transform="`translate(${isPI ? 0.5 : 0}, 0) scale(1.5)`"
        v-if="showBuilding(i)"
      />
      <Resource
        v-for="(resource, index) in resources(i)"
        :key="'field-' + index"
        :kind="resource.type"
        :count="resource.count"
        :transform="`translate(${index * 1.5 + isPI * 0.5}, 0) scale(0.08)`"
      />
    </g>
  </g>
</template>

<script lang="ts">
import { Component } from "vue-property-decorator";
import CurrentBuildingGroup from "../../../../viewer/src/components/PlayerBoard/BuildingGroup.vue";
import Building from "../Building.vue";
@Component({ components: { Building } })
export default class BuildingGroup extends CurrentBuildingGroup {}
</script>
