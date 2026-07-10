<template>
  <div class="faction-info-card">
    <!-- A true duplicate of the in-game faction board (PlayerInfo in preview mode), driven by a
         self-contained preview store: no buildings placed, resources and power tokens at their
         starting values. Everything the board already shows (starting resources, income, research
         bumps, power bowls, terraform costs, board special actions) is intentionally not repeated
         below. -->
    <FactionBoardPreview :engine="previewEngine" :player="previewPlayer" />

    <div class="faction-info-card__facts">
      <div class="faction-info-card__fact">
        <span class="faction-info-card__label">Explore cost</span>
        <RichTextView :content="exploreCostContent" />
        <span v-if="!exploreIsDefault" class="faction-info-card__default">
          (default&nbsp;<RichTextView :content="defaultExploreContent" />)
        </span>
      </div>
      <div v-if="gaiaSurcharge" class="faction-info-card__fact">
        <span class="faction-info-card__label">Gaia mine cost</span>
        <RichTextView :content="gaiaMineCostContent" />
        <span class="faction-info-card__default"
          >(default&nbsp;<RichTextView :content="defaultGaiaMineContent" />)</span
        >
      </div>
    </div>

    <p v-if="exploreNote" class="faction-info-card__note">{{ exploreNote }}</p>

    <div v-if="buildingActions.length || piTech" class="faction-info-card__section">
      <div class="faction-info-card__label">Building actions (granted once built)</div>
      <div class="faction-info-card__actions">
        <div v-for="(a, i) in buildingActions" :key="'act-' + i" class="faction-info-card__action">
          <span class="faction-info-card__building">
            <svg viewBox="0 0 10 10" width="30" height="30">
              <Building :building="a.building" :faction="faction" transform="translate(5,5) scale(0.8)" outline />
            </svg>
            <span class="faction-info-card__building-label">{{ buildingLabel(a.building) }}</span>
          </span>
          <span class="faction-info-card__arrow">&rarr;</span>
          <SpecialAction :action="[a.income]" board />
        </div>
        <div v-if="piTech" class="faction-info-card__action">
          <span class="faction-info-card__building">
            <svg viewBox="0 0 10 10" width="30" height="30">
              <Building :building="PI" :faction="faction" transform="translate(5,5) scale(0.8)" outline />
            </svg>
            <span class="faction-info-card__building-label">PI</span>
          </span>
          <span class="faction-info-card__arrow">&rarr;</span>
          <span class="faction-info-card__chip">tech tile of choice</span>
        </div>
      </div>
    </div>

    <div v-if="boardActionNote" class="faction-info-card__section">
      <div class="faction-info-card__label">Special action</div>
      <div class="faction-info-card__action">
        <SpecialAction v-if="boardActionSpec" :action="[boardActionSpec]" board />
        <p class="faction-info-card__text faction-info-card__action-text">{{ boardActionNote }}</p>
      </div>
    </div>

    <div v-if="tinkering" class="faction-info-card__section">
      <div class="faction-info-card__label">Tinkering tiles (one special action per round)</div>
      <div v-for="(round, i) in tinkering" :key="'tk-' + i" class="faction-info-card__tinkering-row">
        <span class="faction-info-card__tinkering-label">{{ round.label }}</span>
        <SpecialAction v-for="(tile, j) in round.tiles" :key="'tk-' + i + '-' + j" :action="[tile]" board />
      </div>
    </div>

    <div v-if="terraformNote" class="faction-info-card__section">
      <div class="faction-info-card__label">Terraforming costs</div>
      <p class="faction-info-card__text">{{ terraformNote }}</p>
      <div v-if="terraformBoard.length" class="faction-info-card__swatches">
        <span
          v-for="(planet, i) in terraformBoard"
          :key="i"
          class="faction-info-card__swatch"
          :class="{ 'faction-info-card__swatch--cost3': cost3Set.includes(planet) }"
          :style="{ background: planetColor(planet) }"
          :title="`Colour ${i + 1}: ${cost3Set.includes(planet) ? 3 : 1} terraforming step${
            cost3Set.includes(planet) ? 's' : ''
          }`"
        >
          <span class="faction-info-card__swatch-cost">{{ cost3Set.includes(planet) ? 3 : 1 }}</span>
        </span>
      </div>
    </div>

    <div v-if="lostFleetChanges.length || lantidsPiRows.length" class="faction-info-card__section">
      <div class="faction-info-card__label">Lost Fleet changes</div>
      <ul v-if="lostFleetChanges.length" class="faction-info-card__list">
        <li v-for="(line, i) in lostFleetChanges" :key="i">{{ line }}</li>
      </ul>
      <div v-if="lantidsPiRows.length" class="faction-info-card__pi-rows">
        <div class="faction-info-card__sublabel">Planetary Institute (Lost Fleet adjusted tiles, by player count)</div>
        <div v-for="(row, i) in lantidsPiRows" :key="i" class="faction-info-card__pi-row">
          <span class="faction-info-card__pi-count">{{ row.label }}</span>
          <RichTextView :content="row.content" />
        </div>
      </div>
    </div>

    <div v-if="startingNote" class="faction-info-card__section">
      <div class="faction-info-card__label">Starting setup</div>
      <p class="faction-info-card__text">{{ startingNote }}</p>
    </div>

    <div class="faction-info-card__accordion">
      <details class="faction-info-card__acc-item">
        <summary class="faction-info-card__acc-header">Faction ability</summary>
        <p class="faction-info-card__text">{{ ability }}</p>
      </details>
      <details class="faction-info-card__acc-item">
        <summary class="faction-info-card__acc-header">Planetary Institute ability</summary>
        <p class="faction-info-card__text">{{ pi }}</p>
        <div v-if="piConversions.length" class="faction-info-card__conversions">
          <span class="faction-info-card__conv-label">Conversions:</span>
          <div v-for="(c, i) in piConversions" :key="i" class="faction-info-card__conversion">
            <RichTextView :content="conversionContent(c)" />
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<script lang="ts">
import Vue, { markRaw } from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, {
  Building as BuildingEnum,
  Expansion,
  Faction,
  factionBoard,
  Planet,
  Player,
  Reward,
} from "@gaia-project/engine";
import { FactionBoardRaw } from "@gaia-project/engine/src/faction-boards";
import { makeStore } from "../store";
import { factionPreviewEngine } from "../data/faction-preview";
import { factionData, factionName } from "../data/factions";
import {
  baseFactionLostFleetChanges,
  boardActionNote,
  boardActionSpec,
  BuildingSpecialAction,
  buildingSpecialActions,
  buildingShortLabel,
  Conversion,
  DEFAULT_EXPLORE_COST,
  DEFAULT_GAIA_MINE_COST,
  exploreCostIsDefault,
  exploreDeployCost,
  exploreNote,
  gaiaMineExtraCost,
  hasGaiaMineSurcharge,
  isExpansionFaction,
  piConversions,
  piGrantsTechTile,
  startingBuildingNote,
  terraformCost3Set,
  terraformCostDependsOnFactions,
  TinkeringRound,
  tinkeringRounds,
} from "../data/faction-overview";
import { lostFleetTerraformingBoard } from "@gaia-project/engine/src/factions";
import { gameSeed } from "../logic/utils";
import { planetColor } from "../graphics/utils";
import { richText, richTextPlanet, richTextRewards, RichText, richTextArrow } from "../graphics/rich-text";
import RichTextView from "./Resources/RichTextView.vue";
import PlayerInfo from "./PlayerInfo.vue";
import Building from "./Building.vue";
import SpecialAction from "./SpecialAction.vue";
import Buildings from "./definitions/Buildings.vue";

// A thin wrapper that renders the in-game faction board (PlayerInfo, preview mode) against a
// dedicated read-only preview store instead of the live game store. Swapping `$store` in
// `beforeCreate` (after Vuex's own mixin has set the inherited store) makes every descendant board
// component read the preview engine, with clicks/tooltips/highlights inertly no-ops. The engine
// committed here is the same instance the parent reads for its supplemental costs, so board and
// text never drift.
//
// It also emits a `<Buildings>` <defs> block on the preview store: those building images
// (`#ac-<faction>`, `#gf-<faction>`, `#sp-<faction>`, ...) are otherwise only generated for factions
// already in the live game, so during faction selection they don't exist and every building `<use>`
// (the reused board's gaiaformer, the Ivits space-station action icon, the building-action icons)
// renders blank. Emitting them here - keyed by the preview player's faction - makes them resolve.
@Component({ components: { PlayerInfo, Buildings } })
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
    return h("div", [
      h("svg", { attrs: { width: 0, height: 0 }, style: { position: "absolute" } }, [h(Buildings)]),
      h(PlayerInfo, { props: { player: this.player, preview: true } }),
    ]);
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
      const engine = markRaw(factionPreviewEngine(this.faction));
      // The preview's own cost-3 terraforming set is computed against a throwaway filler opponent and
      // the preview seed, so it would contradict the real 7-colour row we show. Replace it with the
      // set computed from the live game's board + opponents so the board markers and swatches agree.
      if (terraformCostDependsOnFactions(this.faction)) {
        engine.players[0].data.lostFleetCost3Planets = this.cost3Set;
      }
      this.engineInstance = engine;
    }
    return this.engineInstance;
  }

  // Live-game terraforming row (the 7 swatches) and the cost-3 subset for this faction.
  get cost3Set(): Planet[] {
    return terraformCost3Set(this.$store.state.data as Engine, this.faction, this.terraformBoard);
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

  get exploreIsDefault(): boolean {
    return exploreCostIsDefault(this.previewPlayer);
  }

  get defaultExploreContent(): RichText {
    return [richTextRewards(DEFAULT_EXPLORE_COST)];
  }

  get gaiaMineCostContent(): RichText {
    return [richTextRewards([gaiaMineExtraCost(this.previewPlayer)])];
  }

  get defaultGaiaMineContent(): RichText {
    return [richTextRewards([DEFAULT_GAIA_MINE_COST])];
  }

  get gaiaSurcharge(): boolean {
    return hasGaiaMineSurcharge(this.previewPlayer);
  }

  get exploreNote(): string | null {
    return exploreNote(this.faction);
  }

  // Lantids' Planetary Institute uses Lost Fleet adjusted tiles below 4 players (§I2). Rendered with
  // real reward/planet iconography rather than prose, under "Lost Fleet changes".
  get lantidsPiRows(): { label: string; content: RichText }[] {
    if (this.faction !== Faction.Lantids) {
      return [];
    }
    const k2 = richTextRewards(Reward.parse("2k"));
    const k2pw1 = richTextRewards(Reward.parse("2k,1pw"));
    return [
      {
        label: "4p",
        content: [richText("mine on an opponent-colonised planet"), richTextArrow, k2],
      },
      {
        label: "3p",
        content: [richText("mine on an opponent-colonised planet"), richTextArrow, k2pw1],
      },
      {
        label: "2p",
        content: [richText("mine on a home"), richTextPlanet(Planet.Terra), richText("planet"), richTextArrow, k2],
      },
    ];
  }

  get piConversions(): Conversion[] {
    return piConversions(this.faction);
  }

  conversionContent(c: Conversion): RichText {
    return [richTextRewards(Reward.parse(c.cost)), richTextArrow, richTextRewards(Reward.parse(c.income))];
  }

  get boardActionNote(): string | null {
    return boardActionNote(this.faction);
  }

  get boardActionSpec(): string | null {
    return boardActionSpec(this.faction);
  }

  planetColor(planet: Planet): string {
    return planetColor(planet as Exclude<Planet, Planet.Empty>);
  }

  // The real game's Lost Fleet Terraforming board (the 7 colour swatches shown top-right of the map),
  // read from the live engine's seed - NOT the preview engine, whose seed differs. Only meaningful
  // for the two factions whose per-planet cost is drawn from it.
  get terraformBoard(): Planet[] {
    if (!terraformCostDependsOnFactions(this.faction)) {
      return [];
    }
    const engine = this.$store.state.data as Engine;
    const seed = engine ? gameSeed(engine) : undefined;
    return seed ? lostFleetTerraformingBoard(seed) : [];
  }

  get terraformNote(): string | null {
    return terraformCostDependsOnFactions(this.faction)
      ? "Per-planet terraforming costs come from the Lost Fleet Terraforming board - the 7 colour " +
          "swatches below (also shown top-right of the map), each marked with its step cost. " +
          "Opponents' home colours always cost 3; the rest of the three cost-3 colours fill from the " +
          "row left-to-right. This is provisional until every faction is chosen."
      : null;
  }

  buildingLabel(building: BuildingEnum): string {
    return buildingShortLabel(building);
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
  margin-bottom: 0.6rem;

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
  margin-bottom: 0.25rem;
}

.faction-info-card__hint {
  font-size: 0.72rem;
  opacity: 0.6;
}

// Compact "label: value" rows (explore cost, Gaia mine) that sit inline instead of stacking.
.faction-info-card__facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.1rem 1.4rem;
  margin-bottom: 0.6rem;
}

.faction-info-card__fact {
  display: flex;
  align-items: center;
  gap: 0.4rem;

  .faction-info-card__label {
    margin-bottom: 0;
  }
}

// "(default <icon>)" reference shown next to a non-default cost. The reward svg carries a wide
// (length*30) intrinsic width around a 20-unit viewBox, so pin both dimensions to the icon's real
// aspect to drop the empty side padding, and collapse RichTextView's own flex spacing.
.faction-info-card__default {
  display: inline-flex;
  align-items: center;
  font-size: 0.74rem;
  opacity: 0.7;

  ::v-deep > div {
    display: inline-flex;
    margin: 0;
  }

  ::v-deep svg {
    height: 18px;
    width: 15px;
  }
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

.faction-info-card__note {
  margin: -0.2rem 0 0.6rem;
  font-size: 0.8rem;
  line-height: 1.3;
  opacity: 0.75;
}

.faction-info-card__conversions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem 0.9rem;
  margin: 0 0 0.5rem;
}

.faction-info-card__conv-label {
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0.7;
}

.faction-info-card__conversion ::v-deep svg {
  height: 24px;
}

.faction-info-card__sublabel {
  font-size: 0.74rem;
  font-weight: 600;
  opacity: 0.7;
  margin: 0.3rem 0 0.15rem;
}

.faction-info-card__pi-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;

  ::v-deep svg {
    height: 22px;
  }
}

.faction-info-card__pi-count {
  min-width: 3.6rem;
  font-weight: 700;
  opacity: 0.75;
}

.faction-info-card__action-text {
  margin: 0;
  font-size: 0.82rem;
}

.faction-info-card__swatches {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.4rem;
}

.faction-info-card__swatch {
  position: relative;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.5);

  &--cost3 {
    border: 2px solid #111;
    box-shadow: 0 0 0 1px #fff inset;
  }
}

.faction-info-card__swatch-cost {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 0 2px #000, 0 0 2px #000, 0 0 2px #000;
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
  gap: 0.25rem;
}

.faction-info-card__building {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
}

.faction-info-card__building-label {
  font-size: 0.62rem;
  font-weight: 700;
  opacity: 0.7;
  margin-top: 0.05rem;
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

// Native <details> accordion for the ability text - one item per ability, closed by default.
.faction-info-card__accordion {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  overflow: hidden;
}

.faction-info-card__acc-item {
  & + & {
    border-top: 1px solid rgba(0, 0, 0, 0.12);
  }

  .faction-info-card__text {
    margin: 0;
    padding: 0 0.7rem 0.7rem;
  }
}

.faction-info-card__acc-header {
  list-style: none;
  cursor: pointer;
  padding: 0.5rem 0.7rem;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  user-select: none;

  &::-webkit-details-marker {
    display: none;
  }

  &::before {
    content: "▸";
    display: inline-block;
    margin-right: 0.4rem;
    opacity: 0.6;
    transition: transform 0.15s ease;
  }
}

details[open] > .faction-info-card__acc-header::before {
  transform: rotate(90deg);
}
</style>
