<template>
  <div class="faction-info-card">
    <!-- A true duplicate of the in-game faction board (PlayerInfo in preview mode), driven by a
         self-contained preview store: no buildings placed, resources and power tokens at their
         starting values. Everything the board already shows (starting resources, income, research
         bumps, power bowls, terraform costs, board special actions) is intentionally not repeated
         below. -->
    <FactionBoardPreview :engine="previewEngine" :player="previewPlayer" />

    <div class="faction-info-card__section">
      <div class="faction-info-card__label">Explore cost</div>
      <RichTextView :content="exploreCostContent" />
      <div class="faction-info-card__hint">Deploy cost only; range Q.I.C. depends on board position.</div>
    </div>

    <div class="faction-info-card__section">
      <div class="faction-info-card__label">Mine on a Gaia planet (extra)</div>
      <RichTextView :content="gaiaMineCostContent" />
    </div>

    <div v-if="buildingActions.length || piTech" class="faction-info-card__section">
      <div class="faction-info-card__label">Building actions (granted once built)</div>
      <div class="faction-info-card__actions">
        <div v-for="(a, i) in buildingActions" :key="'act-' + i" class="faction-info-card__action">
          <svg viewBox="0 0 10 10" width="30" height="30">
            <Building :building="a.building" :faction="faction" transform="translate(5,5) scale(1.3)" flat />
          </svg>
          <span class="faction-info-card__arrow">&rarr;</span>
          <SpecialAction :action="[a.income]" board />
        </div>
        <div v-if="piTech" class="faction-info-card__action">
          <svg viewBox="0 0 10 10" width="30" height="30">
            <Building :building="PI" :faction="faction" transform="translate(5,5) scale(1.3)" flat />
          </svg>
          <span class="faction-info-card__arrow">&rarr;</span>
          <span class="faction-info-card__chip">tech tile of choice</span>
        </div>
      </div>
    </div>

    <div v-if="tinkering" class="faction-info-card__section">
      <div class="faction-info-card__label">Tinkering tiles (one action per round)</div>
      <div v-for="(round, i) in tinkering" :key="'tk-' + i" class="faction-info-card__tinkering-row">
        <span class="faction-info-card__tinkering-label">{{ round.label }}</span>
        <RichTextView :content="tinkeringContent(round)" />
      </div>
    </div>

    <div v-if="lostFleetChanges.length" class="faction-info-card__section">
      <div class="faction-info-card__label">Lost Fleet changes</div>
      <ul class="faction-info-card__list">
        <li v-for="(line, i) in lostFleetChanges" :key="i">{{ line }}</li>
      </ul>
    </div>

    <div v-if="startingNote" class="faction-info-card__section">
      <div class="faction-info-card__label">Starting setup</div>
      <p class="faction-info-card__text">{{ startingNote }}</p>
    </div>

    <div class="faction-info-card__section">
      <button type="button" class="faction-info-card__toggle" @click="showAbilities = !showAbilities">
        {{ showAbilities ? "Hide" : "Show" }} faction &amp; Planetary Institute abilities
      </button>
      <div v-show="showAbilities" class="faction-info-card__abilities">
        <div class="faction-info-card__label">Faction ability</div>
        <p class="faction-info-card__text">{{ ability }}</p>
        <div class="faction-info-card__label">Planetary Institute ability</div>
        <p class="faction-info-card__text">{{ pi }}</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue, { markRaw } from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, { Building as BuildingEnum, Expansion, Faction, factionBoard, Player } from "@gaia-project/engine";
import { FactionBoardRaw } from "@gaia-project/engine/src/faction-boards";
import { makeStore } from "../store";
import { factionPreviewEngine } from "../data/faction-preview";
import { factionData, factionName } from "../data/factions";
import {
  baseFactionLostFleetChanges,
  BuildingSpecialAction,
  buildingSpecialActions,
  exploreDeployCost,
  gaiaMineExtraCost,
  isExpansionFaction,
  piGrantsTechTile,
  startingBuildingNote,
  TinkeringRound,
  tinkeringRounds,
} from "../data/faction-overview";
import { richText, richTextRewards, RichText } from "../graphics/rich-text";
import RichTextView from "./Resources/RichTextView.vue";
import PlayerInfo from "./PlayerInfo.vue";
import Building from "./Building.vue";
import SpecialAction from "./SpecialAction.vue";

// A thin wrapper that renders the in-game faction board (PlayerInfo, preview mode) against a
// dedicated read-only preview store instead of the live game store. Swapping `$store` in
// `beforeCreate` (after Vuex's own mixin has set the inherited store) makes every descendant board
// component read the preview engine, with clicks/tooltips/highlights inertly no-ops. The engine
// committed here is the same instance the parent reads for its supplemental costs, so board and
// text never drift.
@Component({ components: { PlayerInfo } })
class FactionBoardPreview extends Vue {
  @Prop()
  engine: Engine;

  @Prop()
  player: Player;

  beforeCreate() {
    const store = makeStore();
    const engine = (this.$options.propsData as { engine?: Engine })?.engine;
    if (engine) {
      store.commit("receiveData", engine);
    }
    (this as any).$store = store;
  }

  render(h: any) {
    return h(PlayerInfo, { props: { player: this.player, preview: true } });
  }
}

@Component({
  components: { RichTextView, Building, SpecialAction, FactionBoardPreview },
})
export default class FactionInfoCard extends Vue {
  @Prop()
  faction: Faction;

  @Prop({ default: null })
  variant: FactionBoardRaw | null;

  @Prop()
  expansion: Expansion;

  protected showAbilities = false;

  // Built once and shared between the board and every supplemental getter. markRaw keeps Vue from
  // deep-observing the large engine graph (it is read-only display data that never mutates here).
  private engineInstance: Engine | null = null;

  get PI(): BuildingEnum {
    return BuildingEnum.PlanetaryInstitute;
  }

  // A self-contained preview engine (round-1, no buildings placed) read purely as data - the source
  // for the reused board and for all supplemental costs below.
  get previewEngine(): Engine {
    if (!this.engineInstance) {
      this.engineInstance = markRaw(factionPreviewEngine(this.faction));
    }
    return this.engineInstance;
  }

  get previewPlayer(): Player {
    return this.previewEngine.players[0];
  }

  get board() {
    return this.previewPlayer.board ?? factionBoard(this.faction, this.variant ?? undefined);
  }

  get exploreCostContent(): RichText {
    return [richTextRewards(exploreDeployCost(this.previewPlayer))];
  }

  get gaiaMineCostContent(): RichText {
    return [richTextRewards([gaiaMineExtraCost(this.previewPlayer)])];
  }

  get buildingActions(): BuildingSpecialAction[] {
    return buildingSpecialActions(this.board);
  }

  get piTech(): boolean {
    return piGrantsTechTile(this.board);
  }

  get tinkering(): TinkeringRound[] | null {
    return this.faction === Faction.Tinkeroids ? tinkeringRounds() : null;
  }

  tinkeringContent(round: TinkeringRound): RichText {
    const parts: RichText = [];
    round.rewards.forEach((rewards, i) => {
      if (i > 0) {
        parts.push(richText("/"));
      }
      parts.push(richTextRewards(rewards));
    });
    return parts;
  }

  get lostFleetChanges(): string[] {
    if ((this.expansion & Expansion.LostFleet) === 0 || isExpansionFaction(this.faction)) {
      return [];
    }
    return baseFactionLostFleetChanges(this.faction);
  }

  get startingNote(): string | null {
    return startingBuildingNote(this.faction);
  }

  get ability(): string {
    return factionData[this.faction].ability;
  }

  get pi(): string {
    return factionData[this.faction].PI;
  }

  get factionName(): string {
    return factionName(this.faction);
  }
}
</script>

<style lang="scss" scoped>
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

.faction-info-card__hint {
  font-size: 0.72rem;
  opacity: 0.6;
  margin-top: 0.15rem;
}

.faction-info-card__list {
  margin: 0;
  padding-left: 1.1rem;
}

.faction-info-card__text {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  line-height: 1.35;
  white-space: pre-line;
}

.faction-info-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
  align-items: center;
}

.faction-info-card__action {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.faction-info-card__arrow {
  opacity: 0.6;
}

.faction-info-card__chip {
  font-size: 0.8rem;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 0.1rem 0.4rem;
}

.faction-info-card__tinkering-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.faction-info-card__tinkering-label {
  font-size: 0.82rem;
  font-weight: 600;
  min-width: 5rem;
}

.faction-info-card__toggle {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--highlighted, #3273dc);
  cursor: pointer;
  text-decoration: underline;
}

.faction-info-card__abilities {
  margin-top: 0.5rem;
}
</style>
