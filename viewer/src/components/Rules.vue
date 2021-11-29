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
        <h5>2021-11-28</h5>
        <ul>
          <li>Click on final tiles to highlight sectors or federations on</li>
        </ul>
        <h5>2021-11-27</h5>
        <ul>
          <li>Show cost on build buttons</li>
          <li>Game creator can now decide player order</li>
          <li>New Preference: Warnings</li>
        </ul>
        <h5>2021-11-25</h5>
        <ul>
          <li>Confirm actions in gaia phase (Itars, Terrans)</li>
        </ul>
        <h5>2021-11-22</h5>
        <ul>
          <li>Buttons for building locations</li>
          <li>Click on federation icon in player board: highlight federations of that player</li>
          <li>Click on sectors icon in player board: highlight colonized sectors of that player</li>
          <li>Click on planets in player board or faction wheel: highlight planets of that type</li>
          <li>Warning when adding a building to an existing federation</li>
        </ul>
        <h5>2021-11-12</h5>
        <ul>
          <li>New Option: Custom board setup</li>
          <li>Game creator can now decide player order</li>
        </ul>
        <h5>2021-10-19</h5>
        <ul>
          <li>Charts: new "Power Leech" chart.</li>
          <li>Charts: new "Faction Specials" chart.</li>
          <li>
            Charts: Terran special abilities is counted as charge, using tokens in area2 or area3 reduces charge, burn
            doesn't count as charge at all.
          </li>
          <li>Show first letter of faction in faction wheel.</li>
          <li>Show power value and lantids guest mine in space map tooltip.</li>
        </ul>
        <h5>2021-09-25</h5>
        <ul>
          <li>Charts: new "Power Leverage" type in Resources.</li>
        </ul>
        <h5>2021-09-22</h5>
        <ul>
          <li>
            Select, but not click federation location on devices that don't support hover (you need to click OK to
            select the location).
          </li>
          <li>Charts: New chart "Boosters (Victory Points)".</li>
        </ul>
        <h5>2021-09-20</h5>
        <ul>
          <li>Charts: New Power Charges chart.</li>
          <li>Charts: Power charges include burn.</li>
          <li>Charts: Show name of final scoring condition instead of Final (A/B).</li>
          <li>Charts: Show "Tech Tiles (Itars)" in Free Actions</li>
          <li>
            Show more details when forming a federation: power value of federation, new satellites needed, currently
            selected federation button.
          </li>
        </ul>
        <h5>2021-09-15</h5>
        <ul>
          <li>Show the warning of the currently selected federation.</li>
          <li>Don't show recent buildings when placing a building.</li>
          <li>Avoid unnecessary sub-dialogs for "Pick tech tile", "Pick tech tile to cover", "Research".</li>
          <li>Automatically activate if it's a single button: "Pick Booster" and for any building.</li>
          <li>Explain remaining satellites when forming a federation.</li>
        </ul>
        <h5>2021-09-12</h5>
        <ul>
          <li>Improve selection of lost planet (translucent background).</li>
          <li>Improve selection of ice and oxide planets (black border).</li>
          <li>Auto-select the first federation.</li>
          <li>Use sub-dialog for custom federation.</li>
          <li>Highlight the active button in blue (e.g. when clicking on "Build mine").</li>
          <li>Charts: Separate academy 1 and 2 for buildings.</li>
        </ul>
        <h5>2021-09-08</h5>
        <ul>
          <li>Fix replay of games with "beta" variant.</li>
          <li>Charts: Show victory points of advanced tech tiles.</li>
          <li>Charts: Use compact table by default on smaller devices.</li>
          <li>Improve display of Xenos PI in "balanced" variant (needs more space).</li>
          <li>Show the number of remaining satellites on the player board.</li>
        </ul>
        <h5>2021-09-02</h5>
        <ul>
          <li>
            Charts: Project the points of pass advanced tech tiles (e.g. 3 VP/lab when passing) for all remaining
            rounds.
          </li>
        </ul>
        <h5>2021-08-17</h5>
        <ul>
          <li>Make replay more permissive (this should fix replay in some older games)</li>
          <li>Improve sector rotation (can click anywhere in the sector, center stays visible)</li>
        </ul>
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
import { finalScoringFields, finalScoringItems } from "../logic/final-scoring-rules";
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
    return this.$store.state.data;
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
    const variant = player?.variant?.board ?? factionVariantBoard(this.gameData.factionCustomization, faction)?.board;
    return factionDesc(faction, variant, this.gameData.expansions);
  }
}
</script>

<style lang="scss">
footer.rules .btn-secondary {
  display: none !important;
}

.final-store-table th {
  padding: 0 !important;
}

.final-store-table th > span,
.final-store-table th > span > span,
.final-store-table th > div {
  display: block;
}
</style>
