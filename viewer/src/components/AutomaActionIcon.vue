<template>
  <g>
    <Resource v-if="icon.kind === 'vp'" kind="vp" :count="icon.count" transform="scale(1.65)" />
    <g v-else-if="icon.kind === 'block' || icon.kind === 'board-action'">
      <MobileActionIcon kind="board-actions" x="-24" y="-16" width="48" height="32" />
      <UsedActionMark v-if="icon.kind === 'block'" transform="scale(.75)" />
      <text v-if="icon.count" x="0" y="26" class="icon-count">× {{ icon.count }}</text>
    </g>
    <Condition
      v-else-if="icon.kind === 'research' || icon.kind === 'gaia-research'"
      condition="a"
      :color="icon.kind === 'gaia-research' ? 'var(--rt-gaia)' : undefined"
      transform="scale(.85)"
    />
    <g v-else-if="icon.kind === 'mine'">
      <Building building="m" :faction="faction" :flat="flat" :transform="`translate(0, -6) scale(${flat ? 4 : 2.5})`" />
      <Resource kind="r" :count="icon.count" transform="translate(0, 16) scale(.55)" />
    </g>
    <g v-else-if="icon.kind === 'upgrade'">
      <Building building="ts" :faction="faction" :flat="flat" :transform="`translate(4, 0) scale(${flat ? 4 : 2.3})`" />
      <image
        xlink:href="../assets/operators/trigger.svg"
        width="10"
        height="17"
        transform="translate(-7, 9) rotate(180)"
      />
    </g>
    <Resource v-else-if="icon.kind === 'down-lab'" kind="down-lab" transform="scale(.85)" />
    <Building
      v-else-if="icon.kind === 'ts' || icon.kind === 'lab'"
      :building="icon.kind"
      :faction="faction"
      :flat="flat"
      :transform="`scale(${flat ? 4 : 2.3})`"
    />
    <Condition v-else-if="icon.kind === 'newplanet'" condition="newplanet" />
  </g>
</template>

<script lang="ts">
import type { Faction } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import type { AutomaIcon } from "../data/automa";
import Building from "./Building.vue";
import Condition from "./Condition.vue";
import MobileActionIcon from "./MobileActionIcon.vue";
import Resource from "./Resource.vue";
import UsedActionMark from "./UsedActionMark.vue";

@Component({ components: { Building, Condition, Resource, MobileActionIcon, UsedActionMark } })
export default class AutomaActionIcon extends Vue {
  @Prop() icon: AutomaIcon;
  @Prop() faction: Faction;
  @Prop({ type: Boolean, default: false }) flat: boolean;
}
</script>

<style scoped>
.icon-count {
  text-anchor: middle;
  font-size: 11px;
  fill: #111;
}
</style>
