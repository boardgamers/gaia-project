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
      v-b-tooltip
      :title="tooltip(i)"
    >
      <circle
        stroke="black"
        stroke-width="0.07"
        fill="white"
        r="1"
        :key="i"
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
        :key="i"
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
      <Resource
        v-for="(resource, index) in resources(i)"
        :key="'field-' + index"
        :kind="resource.type"
        :count="resource.count"
        :transform="`translate(${index * 1.5 + isPI * 0.5}, 0) scale(0.08)`"
        style="opacity: 0.7"
      />
    </g>
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Building from "../Building.vue";
import Resource from "../Resource.vue";
import Engine, {
  Building as BuildingEnum,
  factionBoard,
  factionVariantBoard,
  Operator,
  Player,
  Resource as ResourceEnum,
  Reward,
} from "@gaia-project/engine";
import { CommandObject, markBuilding } from "../../logic/recent";

@Component({
  components: {
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
    const engine = this.$store.state.data as Engine;
    const factionVariant = factionVariantBoard(engine.factionCustomization, this.faction)?.board;
    return factionBoard(this.faction, factionVariant);
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

  tooltip(i: number) {
    const building = this.building;
    const b = this.board.buildings[building];
    const cost = this.discount
      ? b.cost.map((c) => `${c.count - this.discount}${c.type}`).join(", ")
      : b.cost.join(", ") || "~";
    const isolatedCost = b.isolatedCost ? "\n Isolated cost: " + (b.isolatedCost.join(", ") || "~") : "";
    const income = building === BuildingEnum.GaiaFormer ? "" : "\n " + (this.resources(i, true).join(", ") || "~");
    return `Cost: ${cost}${isolatedCost}${income} Power Value: ${this.player.buildingValue(null, {building})}`;
  }

  get offset() {
    return this.building === BuildingEnum.GaiaFormer ? 0.2 : 1.4;
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
      const special = ev.operator === Operator.Activate && (rew === "1q" || rew === "4c");

      if (ev.operator === Operator.Income) {
        const income = special || incomeAdded ? "" : "Income: ";
        incomeAdded = true;
        return tooltip ? income + ev.rewards.toString() : ev.rewards;
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
  }
}
</style>
