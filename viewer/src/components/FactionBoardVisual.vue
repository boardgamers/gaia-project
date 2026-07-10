<template>
  <div class="faction-board-visual" :style="{ backgroundColor: color, color: textColor }">
    <svg viewBox="-0.2 -0.5 19.9 8.2" class="faction-board-visual__top">
      <rect
        x="-0.5"
        y="-0.5"
        width="19.9"
        height="7.6"
        rx="0.1"
        ry="0.1"
        fill="#ffffff37"
        stroke="black"
        stroke-width="0.07"
      />
      <text class="faction-board-visual__name" x="0" y="1">{{ name }}</text>

      <g transform="translate(0, 3)">
        <text class="faction-board-visual__label" x="0" y="0">R</text>
        <g transform="translate(2.2, 0)">
          <Resource kind="c" :count="resources.c" transform="scale(0.1)" />
          <text class="faction-board-visual__label" transform="translate(1,0) scale(0.7)">/{{ maxCredits }}</text>
        </g>
        <g transform="translate(5.5, 0)">
          <Resource kind="o" :count="resources.o" transform="scale(0.1)" />
          <text class="faction-board-visual__label" transform="translate(1,0) scale(0.7)">/{{ maxOres }}</text>
        </g>
        <g transform="translate(9, 0)">
          <Resource kind="k" :count="resources.k" transform="scale(0.1)" />
          <text class="faction-board-visual__label" transform="translate(1,0) scale(0.7)">/{{ maxKnowledge }}</text>
        </g>
        <Resource kind="q" :count="resources.q" :center-left="true" transform="translate(12.5,0) scale(0.1)" />

        <g transform="translate(15, -3) scale(0.2)">
          <VictoryPoint width="15" height="15" />
          <text class="faction-board-visual__vp-text" x="7" y="10">{{ victoryPoints }}</text>
        </g>

        <g transform="translate(15.2, 1.4)">
          <image
            xlink:href="../assets/other/satellite.svg"
            height="16"
            width="22"
            x="-11"
            y="-8"
            transform="scale(0.07)"
          />
          <text class="faction-board-visual__label" transform="translate(1,0) scale(0.8)">0, {{ maxSatellites }}</text>
        </g>
        <g transform="translate(12.4, 3.5)">
          <image
            xlink:href="../assets/conditions/sector.svg"
            height="16"
            width="22"
            x="-11"
            y="-8"
            transform="scale(0.1)"
          />
          <text class="faction-board-visual__label" transform="translate(1.4,-.1) scale(0.8)" text-anchor="middle">
            0
          </text>
        </g>
        <g transform="translate(15.2, 3.5)">
          <image
            xlink:href="../assets/conditions/federation.svg"
            height="16"
            width="22"
            x="-11"
            y="-8"
            transform="scale(0.1)"
          />
          <text class="faction-board-visual__label" transform="translate(1,-.1) scale(0.8)">0, 0</text>
        </g>
      </g>

      <g v-for="i in researchWheel.length" :key="i" :transform="`translate(${(i - 1) * 2 + 1.1},6.5) scale(1)`">
        <polygon
          points="-7.5,3 -3,7.5 3,7.5 7.5,3 7.5,-3 3,-7.5 -3,-7.5 -7.5,-3"
          transform="scale(0.1)"
          :style="`fill: ${researchWheel[i - 1].style.backgroundColor}`"
        />
        <text
          class="faction-board-visual__research-text"
          transform="scale(0.8)"
          x="-.35"
          y="-.15"
          :style="`fill: ${researchWheel[i - 1].style.color}`"
        >
          {{ researchWheel[i - 1].level }}
        </text>
      </g>
    </svg>

    <svg viewBox="0 -3 12 8" class="faction-board-visual__bowls">
      <g class="faction-board-visual__power-bowls" transform="translate(6, 0)">
        <circle r="1.7" class="faction-board-visual__bowl faction-board-visual__bowl--gaia" />

        <g transform="translate(-2.2, 2.9)">
          <circle r="1.7" class="faction-board-visual__bowl faction-board-visual__bowl--1" />
          <Resource v-if="power.brainstone" kind="brainstone" transform="scale(0.11)" />
          <text v-else y="0.6">{{ power.area1 }}</text>
          <text class="faction-board-visual__bowl-label" x="-2.5" y="0.5">I</text>
        </g>
        <g transform="translate(-2.2, -2.9)">
          <circle r="1.7" class="faction-board-visual__bowl faction-board-visual__bowl--2" />
          <text y="0.6">{{ power.area2 }}</text>
          <text class="faction-board-visual__bowl-label" x="-2.5" y="0.5">II</text>
        </g>
        <g transform="translate(2.4, 0)">
          <circle r="1.7" class="faction-board-visual__bowl faction-board-visual__bowl--3" />
          <text y="0.6">0</text>
          <text class="faction-board-visual__bowl-label" x="0" y="2.9">III</text>
        </g>
      </g>
    </svg>

    <div class="faction-board-visual__buildings">
      <div v-for="b in buildings" :key="b.building" class="faction-board-visual__building">
        <svg viewBox="0 0 10 10" width="34" height="34">
          <Building :building="b.building" :faction="faction" transform="translate(5,5) scale(1.6)" flat />
        </svg>
        <div class="faction-board-visual__building-name">
          {{ b.name }} <span class="faction-board-visual__stock">&times;{{ b.stock }}</span>
        </div>
        <div class="faction-board-visual__building-row">
          <span class="faction-board-visual__building-label">Cost</span>
          <RichTextView v-if="b.cost.length" :content="[costContent(b.cost)]" />
          <span v-else>~</span>
        </div>
        <div class="faction-board-visual__building-row">
          <span class="faction-board-visual__building-label">Income</span>
          <RichTextView :content="incomeContent(b.income)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import {
  Building as BuildingEnum,
  Event,
  Faction,
  Reward,
  Resource as ResourceEnum,
  ResearchField,
} from "@gaia-project/engine";
import { MAX_SATELLITES } from "@gaia-project/engine/src/player";
import Building from "./Building.vue";
import Resource from "./Resource.vue";
import VictoryPoint from "./Resources/VictoryPoint.vue";
import RichTextView from "./Resources/RichTextView.vue";
import { richTextRewards, RichText, richText } from "../graphics/rich-text";
import { FactionInfoBuilding } from "../data/factions";
import { researchColor } from "../data/research";
import { CellStyle } from "../graphics/colors";

const MAX_CREDITS = 30;
const MAX_ORES = 15;
const MAX_KNOWLEDGE = 15;

@Component({
  components: { Building, Resource, VictoryPoint, RichTextView },
})
export default class FactionBoardVisual extends Vue {
  @Prop()
  faction: Faction;

  @Prop()
  name: string;

  @Prop()
  color: string;

  @Prop()
  textColor: string;

  @Prop()
  startingResources: Reward[];

  @Prop()
  power: { area1: number; area2: number; brainstone: boolean };

  @Prop()
  victoryPoints: number;

  @Prop()
  researchLevels: { [key in ResearchField]: number };

  @Prop()
  researchFields: ResearchField[];

  @Prop()
  buildings: FactionInfoBuilding[];

  get maxCredits() {
    return MAX_CREDITS;
  }

  get maxOres() {
    return MAX_ORES;
  }

  get maxKnowledge() {
    return MAX_KNOWLEDGE;
  }

  get maxSatellites() {
    return MAX_SATELLITES;
  }

  get resources(): { c: number; o: number; k: number; q: number } {
    const counts = { c: 0, o: 0, k: 0, q: 0 };
    for (const reward of this.startingResources) {
      if (reward.type === ResourceEnum.Credit) counts.c += reward.count;
      if (reward.type === ResourceEnum.Ore) counts.o += reward.count;
      if (reward.type === ResourceEnum.Knowledge) counts.k += reward.count;
      if (reward.type === ResourceEnum.Qic) counts.q += reward.count;
    }
    return counts;
  }

  get researchWheel(): { level: number; style: CellStyle }[] {
    return this.researchFields.map((field) => ({
      level: this.researchLevels[field] ?? 0,
      style: researchColor(field),
    }));
  }

  costContent(cost: Reward[]) {
    return richTextRewards(cost, true);
  }

  incomeContent(income: Event[][]): RichText {
    const parts: RichText = [];
    income.forEach((row, i) => {
      if (i > 0) {
        parts.push(richText("/"));
      }
      if (row.length === 0) {
        parts.push(richText("~"));
      } else {
        row.forEach((event) => parts.push(richTextRewards(event.rewards)));
      }
    });
    return parts;
  }
}
</script>

<style lang="scss" scoped>
.faction-board-visual {
  border: 2px solid rgba(0, 0, 0, 0.35);
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  color: black;
}

.faction-board-visual__top {
  width: 100%;
  height: auto;
  display: block;
  margin-bottom: 0.4rem;
}

.faction-board-visual__name {
  font-size: 1px;
  font-weight: 700;
}

.faction-board-visual__label {
  font-size: 0.7px;
}

.faction-board-visual__vp-text {
  font-size: 7px;
  fill: white;
  font-weight: 600;
  text-anchor: middle;
}

.faction-board-visual__research-text {
  font-size: 1px;
  text-anchor: middle;
}

.faction-board-visual__bowls {
  width: 100%;
  max-width: 12rem;
  height: auto;
  display: block;
  margin: 0 auto 0.5rem;

  text {
    fill: white;
    font-size: 1.1px;
    text-anchor: middle;
    font-weight: 600;
  }
}

.faction-board-visual__bowl {
  stroke: black;
  stroke-width: 0.05px;

  &--gaia {
    fill: #00aa00;
  }

  &--1 {
    fill: #c9a3e0;
  }

  &--2 {
    fill: #9855c9;
  }

  &--3 {
    fill: #5c1f82;
  }
}

.faction-board-visual__bowl-label {
  fill: #222 !important;
  font-size: 0.9px !important;
}

.faction-board-visual__buildings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
  gap: 0.5rem;
}

.faction-board-visual__building {
  background: rgba(255, 255, 255, 0.55);
  border-radius: 8px;
  padding: 0.35rem 0.4rem;
  color: #22293b;
  text-align: center;
}

.faction-board-visual__building-name {
  font-size: 0.78rem;
  font-weight: 600;
  margin-bottom: 0.2rem;
}

.faction-board-visual__stock {
  font-weight: 400;
  opacity: 0.7;
}

.faction-board-visual__building-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.2rem;
  font-size: 0.72rem;
}

.faction-board-visual__building-label {
  opacity: 0.65;
  margin-right: 0.15rem;
}
</style>
