<template>
  <b-modal :id="id" size="lg" title="Rules and Factions">
    <div class="gaia-viewer-modal">
      <div class="d-flex" style="justify-content: center; align-items: center">
        <b-dropdown size="sm" class="mr-2 mb-2" text="Type">
          <b-dropdown-item @click="selectRule('scoring')">Final Scoring</b-dropdown-item>
          <b-dropdown-divider />
          <b-dropdown-item
            v-for="(f, i) in factions"
            :key="`rule${i}`"
            @click="selectRule(f)"
            :style="{ 'background-color': backgroundColor(f) }"
          >
            <span :style="{ color: color(f) }">{{ factionName(f) }}</span>
          </b-dropdown-item>
        </b-dropdown>
        <h4>
          <div v-text="'Final Scoring'" v-if="rule === 'scoring'" />
          <div v-text="factionName(this.rule)" v-else />
        </h4>
      </div>
      <b-table
        v-if="rule === 'scoring'"
        striped
        bordered
        small
        responsive="true"
        hover
        :items="finalScoringItems"
        :fields="finalScoringFields"
        class="final-store-table"
      >
        <template #cell(Name)="data">
          <span v-html="data.value"></span>
        </template>
        <template #cell()="data">
          <b-checkbox :checked="data.value" disabled />
        </template>
      </b-table>
      <div v-else v-html="factionTooltip"></div>
    </div>
  </b-modal>
</template>

<script lang="ts">
import { factionDesc, factionName } from "../data/factions";

import { Component, Prop, Vue } from "vue-property-decorator";
import Engine, { Faction, factionPlanet, factionVariantBoard } from "@gaia-project/engine";
import { finalScoringFields, finalScoringItems } from "../logic/final-scoring";
import { factionColor, planetFill } from "../graphics/utils";


type Rule = Faction | "scoring";

@Component
export default class Rules extends Vue {

  @Prop()
  id: string;

  @Prop({ default: "scoring" })
  type: Rule;

  private rule: Rule = "scoring";

  private finalScoringFields: any[] = null;
  private finalScoringItems: any[] = null;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  mounted() {
    const element = document.getElementById("root");
    this.finalScoringFields = finalScoringFields(element);
    this.finalScoringItems = finalScoringItems(element);

    this.selectRule(this.type ?? "scoring");
  }

  selectRule(rule: Rule) {
    this.rule = rule;
  }

  get factions(): Faction[] {
    return Object.values(Faction);
  }

  factionName(faction: Rule): string {
    return factionName(faction as Faction);
  }

  backgroundColor(rule: Rule): string {
    return rule === "scoring" ? "white" : factionColor(rule as Faction);
  }

  color(rule: Rule): string {
    return rule === "scoring" ? "black" : planetFill(factionPlanet(rule as Faction));
  }

  get factionTooltip(): string {
    const faction = this.rule as Faction;

    const player = this.gameData.players.find((p) => p.faction == faction);
    const variant = player?.factionVariant ?? factionVariantBoard(this.gameData.factionCustomization, faction);
    return factionDesc(faction, variant);
  }
}
</script>

<style lang="scss">
.gaia-viewer-modal {
  padding: 1rem;
}
</style>
