<template>
  <div class="d-flex flex-wrap" style="justify-content: center; align-items: center">
    <template v-for="(c, i) in filteredContent">
      <svg
        v-if="c.rewards != null"
        :viewBox="`-10 -13 ${c.rewards.length * 20} 25`"
        :width="width(c.rewards)"
        height="36"
        :key="i"
      >
        <Resource
          v-for="(r, j) in c.rewards"
          :key="j"
          :transform="`translate(${j * 20}, ${y(r.type)}) scale(${scale(r.type)})`"
          :kind="r.type"
          :count="r.count"
        />
      </svg>
      <svg v-else-if="c.building != null" :key="i" viewBox="0 0 10 10" width="36" height="36">
        <Building :building="c.building.type" :faction="c.building.faction" transform="translate(5,5) scale(.8)" />
        <text v-if="c.building.count > 1" x="7" y="14" transform="scale(.5)" :style="buildingCountStyle(c.building)">
          {{ c.building.count }}
        </text>
        <Resource
          v-if="buildingResource(c.building)"
          :kind="buildingResource(c.building)"
          transform="translate(5,5) scale(.3)"
        />
      </svg>
      <SpecialAction
        v-else-if="c.specialAction != null"
        :key="i"
        :action="[c.specialAction]"
        transform="translate(0,1) scale(1)"
      />
      <svg v-else-if="c.text === 'arrow'" :key="i" viewBox="0 0 10 10" width="20" height="20">
        <use xlink:href="#arrow" x="-2" y="5" />
      </svg>
      <div v-else v-html="c.text" :key="i" class="text" />
    </template>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { RichText, RichTextBuilding, RichTextElement } from "../../graphics/rich-text";
import { Building as BuildingEnum, Faction, Resource } from "@gaia-project/engine";
import Reward from "@gaia-project/engine/src/reward";
import Building from "../Building.vue";
import SpecialAction from "../SpecialAction.vue";
import { foregroundColor } from "../../graphics/colors";
import { factionColorVar } from "../../graphics/utils";

@Component({
  components: { Building, SpecialAction },
})
export default class RichTextView extends Vue {
  @Prop()
  content: RichText;

  get filteredContent(): RichText {
    return this.content.flatMap(c => {
      if (c.rewards) {
        return c.rewards.map(r => ({ rewards: [r] } as RichTextElement));
      }
      return c;
    });
  }

  scale(r: Resource): number {
    switch (r) {
      case Resource.VictoryPoint:
        return 1.3;
      case Resource.ChargePower:
      case Resource.PayPower:
        return 1;
    }
    return 1.15;
  }

  y(r: Resource): number {
    switch (r) {
      case Resource.ChargePower:
      case Resource.PayPower:
        return 2;
    }
    return 0;
  }

  width(rewards: Reward[]): number {
    return rewards[0].count as any == "+" ? 15 : rewards.length * 30;
  }

  buildingResource(b: RichTextBuilding): Resource | null {
    if (b.skipResource) {
      return null;
    }
    switch (b.type) {
      case BuildingEnum.Academy1:
        return Resource.Knowledge;
      case BuildingEnum.Academy2:
        return b.faction === Faction.BalTaks ? Resource.Credit : Resource.Qic;
    }
    return null;
  }

  buildingCountStyle(b: RichTextBuilding): string {
    return `fill: ${(foregroundColor(factionColorVar(b.faction)))}; font-weight: bold;`;
  }
}
</script>

<style lang="scss" scoped>
.text {
  margin: 2px;
}
</style>
