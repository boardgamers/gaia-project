<template>
  <g class="building-group">
    <rect :x="0" y="-1.2" :width=width height=2.4 stroke=black stroke-width=0.07 fill="#ffffff44" rx=0.2 ry=0.2 />
    <Resource v-if="factionIncome.length > 0" :kind="factionIncome[0].type" :count="factionIncome[0].count" transform="translate(0.77, 0) scale(0.07)" />
    <g v-for="i in buildingList" :transform="`translate(${(i+0.5)*buildingSpacing+offset}, 0)`" :key=i v-b-tooltip :title="tooltip(i)">
      <circle stroke=black stroke-width=0.07 fill=white r=1  :key=i v-if="!isPI" />
      <rect stroke=black stroke-width=0.07 fill=white :x="-2.2+offset" width=4 y=-1 height=2  :key=i v-else />
      <Building :building="building" class="building-in-group" :faction="faction" :transform="`translate(${isPI ? 0.5 : 0}, 0) scale(0.15)`" v-if="showBuilding(i)" outline />
      <Resource v-for="(resource,index) in resources(i)" :key="'field-' + index"  :kind="resource.type" :count="resource.count" :transform="`translate(${index*1.5 + isPI*0.5}, 0) scale(0.08)`" />
    </g>
  </g>
</template>

<script lang="ts">
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import Building from '../Building.vue';
import Resource from '../Resource.vue';
import { Building as BuildingEnum, Faction, Reward, FactionBoard, factionBoard, Operator, Resource as ResourceEnum } from '@gaia-project/engine';

@Component({
  components: {
    Building,
    Resource
  },
  watch: {
    faction (newVal) {
      this.board = factionBoard(newVal);
    }
  }
})
export default class BuildingGroup extends Vue {
  @Prop()
  nBuildings: number;

  @Prop()
  building: BuildingEnum;

  @Prop()
  faction: Faction;

  @Prop()
  placed: number;

  @Prop()
  resource: ResourceEnum[];

  @Prop({ default: false })
  ac1: boolean;

  @Prop({ default: false })
  ac2: boolean;

  board: FactionBoard = factionBoard(this.faction || Faction.Terrans);

  get buildingList () {
    return [0, 1, 2, 3, 4, 5, 6, 7].slice(0, this.nBuildings);
  }

  get isPI () {
    return this.building === BuildingEnum.PlanetaryInstitute;
  }

  tooltip (i: number) {
    return "Income: " + (this.resources(i, true).join(", ") || "~");
  }

  get offset () {
    return 1.4;
  }

  get buildingSpacing () {
    return 2.2;
  }

  get paddingRight () {
    return 0.2;
  }

  get width () {
    return Math.max(this.nBuildings, 2) * this.buildingSpacing + this.offset + this.paddingRight;
  }

  get factionIncome (): Reward[] {
    const income: Reward[] = [].concat(...this.board.income.filter(ev => ev.operator === Operator.Income).map(ev => ev.rewards));

    return income.filter(rew => this.resource.includes(rew.type));
  }

  showBuilding (i: number) {
    if (this.ac1 || this.ac2) {
      return i === 0 ? !this.ac1 : !this.ac2;
    }
    return i >= this.placed;
  }

  resources (i: number, forced = false): Reward[] {
    if (this.showBuilding(i) && !forced) {
      return [];
    }

    let building = this.building;

    if (this.building === BuildingEnum.Academy1 && i > 0) {
      building = BuildingEnum.Academy2;
      i = 0;
    }

    return [].concat(...this.board.buildings[building].income[i].filter(ev => {
      if (ev.operator === Operator.Income) {
        return true;
      }
      const rew = ev.rewards.toString();

      return ev.operator === Operator.Activate && (rew === "1q" || rew === "4c");
    }).map(ev => ev.rewards));
  }
}

</script>

<style lang="scss">
.player-board {
  .building-group {
    .building-in-group {
      stroke-width: 0.05px;
    }
  }
}
</style>
