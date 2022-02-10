<template>
  <g class="building-group">
    <rect
      :x="0"
      y="-1.2"
      :width="width"
      height="2.4"
      stroke="black"
      stroke-width="0.07"
      fill="#ffffff44"
      rx="0.2"
      ry="0.2"
    />
    <Resource
      v-if="factionIncome.length > 0"
      :kind="factionIncome[0].type"
      :count="factionIncome[0].count"
      transform="translate(0.77, 0) scale(0.07)"
      style="opacity: 0.7"
    />
    <g
      v-for="i in buildingList"
      :transform="`translate(${(i + 0.5) * buildingSpacing + offset}, 0)`"
      :key="i"
      v-b-tooltip.html
      :title="tooltip(i)"
    >
      <circle
        stroke="black"
        stroke-width="0.07"
        fill="white"
        r="1"
        v-if="!isPI"
        :class="{ recent: recentlyBuilt(i), 'current-round': currentRoundBuilt(i) }"
      />
      <rect
        stroke="black"
        stroke-width="0.07"
        fill="white"
        :x="-2.2 + offset"
        :width="2 * incomeTypes"
        y="-1"
        height="2"
        :class="{ recent: recentlyBuilt(i), 'current-round': currentRoundBuilt(i) }"
        v-else
      />
      <Building
        :building="building"
        class="building-in-group"
        :faction="faction"
        :transform="`translate(${isPI ? 0.5 : 0}, 0) scale(0.15)`"
        v-if="showBuilding(i)"
        :flat="flat"
        outline
      />
      <Planet v-if="gaiaFormerForegroundPlanet(i)" :planet="gaiaFormerForegroundPlanet(i)" />
      <Resource
        v-for="(resource, index) in resources(i)"
        :key="'field-' + index"
        :kind="resource.type"
        :count="resource.count"
        :transform="resourceTranslate(i, index)"
        style="opacity: 0.7"
      />
      <g v-if="isDeployed(i)">
        <line y1="-.1" y2=".1" x1="-.1" x2=".1" stroke="#333" stroke-width="2" />
        <line y1=".1" y2="-.1" x1="-.1" x2=".1" stroke="#333" stroke-width="2" />
      </g>
    </g>
    <!--    not displayed because military is not implemented yet-->
    <!--    <g v-if="isShip" transform="translate(7.5,0)" v-b-tooltip="destroyedTooltip">-->
    <!--      <circle r=".6" class="destroyed" />-->
    <!--      <text transform="translate(-.33,-.1)" class="board-text">{{ destroyed }}</text>-->
    <!--    </g>-->
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Resource from "../Resource.vue";
import Engine, {
  Building as BuildingEnum,
  factionBoard,
  factionVariantBoard,
  isShip,
  Operator,
  Planet as PlanetEnum,
  Player,
  Resource as ResourceEnum,
  Reward,
} from "@gaia-project/engine";
import { CommandObject, markBuilding } from "../../logic/recent";
import { buildingName } from "../../data/building";
import { radiusTranslate } from "../../logic/utils";
import Planet from "../Planet.vue";
import Building from "../Building.vue";

@Component({
  components: {
    Planet,
    Building,
    Resource,
  },
})
export default class BuildingGroup extends Vue {
  @Prop()
  nBuildings: number;

  @Prop()
  building: BuildingEnum;

  @Prop()
  player!: Player;

  @Prop()
  placed: number;

  @Prop({ default: 0 })
  gaia: number;

  @Prop({ default: 0 })
  destroyed: number;

  @Prop({ default: 0 })
  deployed: number;

  @Prop({ default: 0 })
  discount: number;

  @Prop()
  resource: ResourceEnum[];

  @Prop({ default: false })
  ac1: boolean;

  @Prop({ default: false })
  ac2: boolean;

  get board() {
    if (this.player.board) {
      return this.player.board;
    }
    const factionVariant = factionVariantBoard(this.engine.factionCustomization, this.faction)?.board;
    return factionBoard(this.faction, factionVariant);
  }

  get engine() {
    return this.$store.state.data as Engine;
  }

  get faction() {
    return this.player.faction;
  }

  get buildingList() {
    return [0, 1, 2, 3, 4, 5, 6, 7].slice(0, this.nBuildings);
  }

  get isPI() {
    return this.building === BuildingEnum.PlanetaryInstitute;
  }

  get isShip() {
    return isShip(this.building);
  }

  tooltip(i: number) {
    const building = this.building;
    const b = this.board.buildings[building];
    const cost = this.discount
      ? b.cost.map((c) => `${c.count - this.discount}${c.type}`).join(", ")
      : b.cost.join(", ") || "~";
    const isolatedCost = b.isolatedCost ? " Isolated cost: " + (b.isolatedCost.join(", ") || "~") : "";
    const income = building === BuildingEnum.GaiaFormer || isShip(building) ? null : (this.resources(i, true).join(", ") || "~");
    const rows = [
      buildingName(building, this.faction) + (this.isDeployed(i) ? " (deployed)" : ""),
      `Cost: ${cost}${isolatedCost}`,
      income,
      `Power Value: ${this.player.buildingValue(null, {building})}`,
    ];
    return rows.filter(r => r).join("<br/>");
  }

  get destroyedTooltip() {
    return `Destroyed ${buildingName(this.building, this.faction)}s`;
  }

  get offset() {
    return this.resource.length == 0 ? 0.2 : 1.4;
  }

  get buildingSpacing() {
    return 2.2;
  }

  get paddingRight() {
    return 0.2;
  }

  get width() {
    let minWidth = 2;
    if (this.building === BuildingEnum.GaiaFormer) {
      minWidth = 3;
    } else if (this.building === BuildingEnum.PlanetaryInstitute) {
      minWidth = this.incomeTypes;
    } else if (isShip(this.building)) {
      minWidth = 3.6;
    }
    return Math.max(this.nBuildings, minWidth) * this.buildingSpacing + this.offset + this.paddingRight;
  }

  get incomeTypes() {
    return Math.max(
      2,
      this.board.buildings[this.building].income[0].filter((e) => e.operator == Operator.Income).length
    );
  }

  get factionIncome(): Reward[] {
    const income: Reward[] = [].concat(
      ...this.board.income.filter((ev) => ev.operator === Operator.Income).map((ev) => ev.rewards)
    );

    return income.filter((rew) => this.resource.includes(rew.type));
  }

  get flat() {
    return this.$store.state.preferences.flatBuildings;
  }

  showBuilding(i: number) {
    if (this.ac1 || this.ac2) {
      return i === 0 ? !this.ac1 : !this.ac2;
    }
    return i >= this.placed + this.gaia;
  }

  isDeployed(i: number): boolean {
    return i < this.deployed;
  }

  recentlyBuilt(i: number): boolean {
    return this.shouldMarkBuilding(
      this.$store.getters.currentRoundBuildingCommands.get(this.faction) ?? [],
      this.$store.getters.recentBuildingCommands.get(this.faction) ?? [],
      i
    );
  }

  currentRoundBuilt(i: number): boolean {
    const commands = this.$store.getters.currentRoundBuildingCommands.get(this.faction) ?? [];
    return this.shouldMarkBuilding(commands, commands, i);
  }

  private shouldMarkBuilding(roundMoves: CommandObject[], moves: CommandObject[], i: number): boolean {
    let b = this.building;
    if (this.ac1) {
      b = BuildingEnum.Academy1;
    }
    if (this.ac2 && i == 1) {
      b = BuildingEnum.Academy2;
      i--;
    }
    function countMoves(commands: CommandObject[]) {
      return commands.filter((c) => (c.args[0] as BuildingEnum) === b).length;
    }

    return markBuilding(i, countMoves(roundMoves), this.placed, countMoves(moves), this.nBuildings);
  }

  gaiaFormerForegroundPlanet(i: number): PlanetEnum | null {
    if (this.building == BuildingEnum.GaiaFormer && i < this.placed + this.gaia) {
      if (i < this.gaia) {
        return PlanetEnum.Volcanic;
      }
      const onGaia = [...this.engine.map.grid.values()]
        .filter(h => h.buildingOf(this.player.player) === BuildingEnum.GaiaFormer && h.data.planet == PlanetEnum.Gaia).length;
      return i < onGaia + this.gaia ? PlanetEnum.Gaia : PlanetEnum.Transdim;
    }
  }

  resourceTranslate(building: number, resource: number): string {
    if (this.isPI) {
      return `translate(${resource * 1.5 + 0.5}, 0) scale(0.08)`;
    } else {
      const n = this.resources(building).length;
      if (n == 1) {
        return `scale(0.08)`;
      }
      return radiusTranslate(.55, resource, n) + " scale(0.04)";
    }
  }

  resources(i: number, tooltip = false): Array<string | Reward> {
    if (this.showBuilding(i) && !tooltip) {
      return [];
    }

    if (this.building === BuildingEnum.GaiaFormer) {
      return [];
    }

    let building = this.building;

    if (this.building === BuildingEnum.Academy1 && i > 0) {
      building = BuildingEnum.Academy2;
      i = 0;
    }

    let incomeAdded = false;
    const ret = this.board.buildings[building].income[i].map((ev) => {
      const rew = ev.rewards.toString();
      const special = ev.operator === Operator.Activate && (rew === "q" || rew === "4c");

      if (ev.operator === Operator.Income) {
        const income = special || incomeAdded ? "" : "Income: ";
        incomeAdded = true;
        return tooltip ? income + ev.rewards.toString() : ev.rewards;
      }

      if (ev.operator === Operator.Once && tooltip) {
        return "Once: " + rew;
      }

      if (special) {
        return tooltip ? "Special Action: " + rew : ev.rewards;
      }
      return null;
    });

    return [].concat(...ret).filter((r) => r != null);
  }
}
</script>

<style lang="scss">
.player-board {
  .building-group {
    .building-in-group {
      stroke-width: 5px;
    }

    .current-round {
      fill: var(--current-round);
      opacity: 0.7;
    }

    .recent {
      fill: var(--recent);
      opacity: 1;
    }

    .destroyed {
      fill: red;
      opacity: 1;
    }
  }
}
</style>
