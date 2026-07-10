<template>
  <div class="faction-board-preview">
    <div class="faction-board-preview__resources">
      <span class="faction-board-preview__resources-label">On the board</span>
      <RichTextView :content="startingResourcesContent" />
    </div>
    <div class="faction-board-preview__buildings">
      <div v-for="b in buildings" :key="b.building" class="faction-board-preview__building">
        <svg viewBox="0 0 10 10" width="40" height="40">
          <Building :building="b.building" :faction="faction" transform="translate(5,5) scale(1.6)" flat />
        </svg>
        <div class="faction-board-preview__building-name">{{ b.name }} <span class="faction-board-preview__stock">&times;{{ b.stock }}</span></div>
        <div class="faction-board-preview__building-row">
          <span class="faction-board-preview__building-label">Cost</span>
          <RichTextView v-if="b.cost.length" :content="[costContent(b.cost)]" />
          <span v-else>~</span>
        </div>
        <div class="faction-board-preview__building-row">
          <span class="faction-board-preview__building-label">Income</span>
          <RichTextView :content="incomeContent(b.income)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Building as BuildingEnum, Event, Faction, Reward } from "@gaia-project/engine";
import Building from "./Building.vue";
import RichTextView from "./Resources/RichTextView.vue";
import { richText, richTextRewards, RichText } from "../graphics/rich-text";
import { FactionInfoBuilding } from "../data/factions";

@Component({
  components: { Building, RichTextView },
})
export default class FactionBoardPreview extends Vue {
  @Prop()
  faction: Faction;

  @Prop()
  buildings: FactionInfoBuilding[];

  @Prop()
  startingResources: Reward[];

  get startingResourcesContent(): RichText {
    return this.startingResources.length ? [richTextRewards(this.startingResources)] : [richText("~")];
  }

  costContent(cost: Reward[]) {
    return richTextRewards(cost, true);
  }

  // One "/"-separated icon group per building copy owned (matches the physical board's per-copy
  // income row exactly, including empty rows shown as "~" - nothing filtered out).
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
.faction-board-preview {
  border: 2px solid rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  background: rgba(255, 255, 255, 0.12);
}

.faction-board-preview__resources {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.25);
}

.faction-board-preview__resources-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  opacity: 0.75;
}

.faction-board-preview__buildings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
  gap: 0.5rem;
}

.faction-board-preview__building {
  background: rgba(255, 255, 255, 0.55);
  border-radius: 8px;
  padding: 0.35rem 0.4rem;
  color: #22293b;
  text-align: center;
}

.faction-board-preview__building-name {
  font-size: 0.78rem;
  font-weight: 600;
  margin-bottom: 0.2rem;
}

.faction-board-preview__stock {
  font-weight: 400;
  opacity: 0.7;
}

.faction-board-preview__building-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.2rem;
  font-size: 0.72rem;
}

.faction-board-preview__building-label {
  opacity: 0.65;
  margin-right: 0.15rem;
}
</style>
