<template>
  <div class="faction-info-card" :style="{ backgroundColor: info.color, color: info.textColor }">
    <div class="faction-info-card__title">{{ info.name }}</div>

    <div class="faction-info-card__section">
      <div class="faction-info-card__label">Starting resources</div>
      <div class="faction-info-card__resources-row">
        <RichTextView :content="startingResourcesContent" />
        <span class="faction-info-card__power">
          <svg viewBox="-12 -12 24 24" width="28" height="28">
            <Resource kind="t" :count="info.power.area1" />
          </svg>
          <span class="faction-info-card__power-label">Bowl I</span>
        </span>
        <span class="faction-info-card__power">
          <svg viewBox="-12 -12 24 24" width="28" height="28">
            <Resource kind="t" :count="info.power.area2" />
          </svg>
          <span class="faction-info-card__power-label">Bowl II</span>
        </span>
        <span v-if="info.power.brainstone" class="faction-info-card__power">
          <svg viewBox="-12 -12 24 24" width="28" height="28">
            <Resource kind="brainstone" />
          </svg>
          <span class="faction-info-card__power-label">Brainstone in Bowl I</span>
        </span>
      </div>
    </div>

    <div class="faction-info-card__section">
      <div class="faction-info-card__label">Round income</div>
      <RichTextView v-if="info.roundIncome.length" :content="roundIncomeContent" />
      <span v-else>~</span>
    </div>

    <div class="faction-info-card__section">
      <div class="faction-info-card__label">Faction board</div>
      <FactionBoardPreview :faction="info.faction" :buildings="info.buildings" :starting-resources="info.startingResources" />
    </div>

    <div v-if="info.lostFleetChanges.length" class="faction-info-card__section">
      <div class="faction-info-card__label">Lost Fleet changes</div>
      <ul class="faction-info-card__list">
        <li v-for="(line, i) in info.lostFleetChanges" :key="i">{{ line }}</li>
      </ul>
    </div>

    <div class="faction-info-card__section">
      <div class="faction-info-card__label">Faction ability</div>
      <p class="faction-info-card__text">{{ info.ability }}</p>
    </div>

    <div class="faction-info-card__section">
      <div class="faction-info-card__label">Planetary Institute ability</div>
      <p class="faction-info-card__text">{{ info.pi }}</p>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Expansion, Faction } from "@gaia-project/engine";
import { FactionBoardRaw } from "@gaia-project/engine/src/faction-boards";
import { factionInfoData, FactionInfoData } from "../data/factions";
import { richTextRewards, RichText } from "../graphics/rich-text";
import Resource from "./Resource.vue";
import RichTextView from "./Resources/RichTextView.vue";
import FactionBoardPreview from "./FactionBoardPreview.vue";

@Component({
  components: { Resource, RichTextView, FactionBoardPreview },
})
export default class FactionInfoCard extends Vue {
  @Prop()
  faction: Faction;

  @Prop({ default: null })
  variant: FactionBoardRaw | null;

  @Prop()
  expansion: Expansion;

  get info(): FactionInfoData {
    return factionInfoData(this.faction, this.variant, this.expansion);
  }

  get startingResourcesContent(): RichText {
    return [richTextRewards(this.info.startingResources)];
  }

  get roundIncomeContent(): RichText {
    return [richTextRewards(this.info.roundIncome)];
  }
}
</script>

<style lang="scss" scoped>
.faction-info-card {
  border-radius: 10px;
  padding: 0.9rem 1rem 1.1rem;
}

.faction-info-card__title {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  margin-bottom: 0.7rem;
}

.faction-info-card__section {
  margin-bottom: 0.9rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.faction-info-card__label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.85;
  margin-bottom: 0.3rem;
}

.faction-info-card__resources-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.faction-info-card__power {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.78rem;
}

.faction-info-card__power-label {
  opacity: 0.85;
}

.faction-info-card__list {
  margin: 0;
  padding-left: 1.1rem;
}

.faction-info-card__text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.35;
  white-space: pre-line;
}
</style>
