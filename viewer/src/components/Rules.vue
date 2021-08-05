<template>
  <b-modal :id="id" size="lg" title="Rules and Factions" footer-class="rules">
    <div class="gaia-viewer-modal">
      <div class="d-flex" style="justify-content: center; align-items: center">
        <b-dropdown size="sm" class="mr-2 mb-2" text="Type">
          <b-dropdown-item @click="selectRule('rules')">Rules</b-dropdown-item>
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
          <div v-text="'Rules'" v-else-if="rule === 'rules'" />
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
      <div v-else-if="rule === 'rules'">
        <ul>
          <li>
            <a
              href="https://images.zmangames.com/filer_public/ce/89/ce890bfd-227e-4249-a52a-976bc5f20d19/en_gaia_rulebook_lo.pdf"
              >Rules for the base game</a
            >
          </li>
          <li><a href="https://www.boardgamers.space/page/gaia-project/auction">Rules for auction</a></li>
          <li><a href="https://www.boardgamers.space/page/gaia-project/settings">Game settings</a></li>
          <li><a href="https://www.boardgamers.space/page/gaia-project/preferences">Game preferences</a></li>
          <li><a href="https://boardgamegeek.com/thread/2120375/official-federation-faq">Federation FAQ</a></li>
          <li><a href="https://www.boardgamers.space/page/gaia-project/faction-variants">Faction Variants</a></li>
          <li><a href="https://www.boardgamers.space/page/karma">How Karma works</a></li>
          <li><a href="https://www.boardgamers.space/page/elo">How Elo works</a></li>
        </ul>
        <h4>Recent changes</h4>
        <h5>2021-08-06</h5>
        <ul>
          <li>This page - a summary of links to rules and all factions.</li>
          <li>The current player is displayed more prominently - where you'd usually see your possible moves.</li>
          <li>The movement of power tokens is displayed in the game log.</li>
          <li>During bidding, you now see the influence of the faction variant in the player board.</li>
          <li>
            The "1 terraforming step" booster can no longer be used to build on a gaia planet (this was the last item of
            the <a href="https://boardgamegeek.com/thread/1909662/article/36261169#36261169">rules clarification</a>.
          </li>
          <li>
            The number of tech tiles is limited to the number of players. It doesn't affect the gameplay, but makes it
            easier to see that a tech tile has been bought by all players in a 2 or 3 player game.
          </li>
          <li>
            New <a href="https://www.boardgamers.space/page/gaia-project/faction-variants">Beta Faction Variant</a>.
          </li>
        </ul>
      </div>
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


type Rule = Faction | "rules" | "scoring";

@Component
export default class Rules extends Vue {

  @Prop()
  id: string;

  @Prop({ default: "rules" })
  type: Rule;

  private rule: Rule = "rules";

  private finalScoringFields: any[] = null;
  private finalScoringItems: any[] = null;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  mounted() {
    const element = document.getElementById("root");
    this.finalScoringFields = finalScoringFields(element);
    this.finalScoringItems = finalScoringItems(element);

    this.selectRule(this.type ?? "rules");
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
    return factionColor(rule as Faction);
  }

  color(rule: Rule): string {
    return planetFill(factionPlanet(rule as Faction));
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
footer.rules .btn-secondary {
  display: none !important;
}
</style>
