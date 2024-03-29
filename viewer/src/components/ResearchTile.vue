<template>
  <g :transform="`translate(0, ${y})`" v-b-tooltip.html.left :title="tooltip" :class="field">
    <rect
      x="2"
      y="2"
      :class="['research-tile', field, { highlighted }]"
      width="56"
      :height="height"
      rx="5"
      ry="2"
      @click="onClick"
    />
    <g style="pointer-events: none">
      <g style="opacity: 0.7">
        <Resource
          v-for="(resource, i) in resources"
          :key="'field-' + i"
          :transform="`translate(${2 + 56 / 2 + resourceX(i)}, ${resourceY(i)}) scale(${scale(resource.type)})`"
          :kind="resource.type"
          :count="resource.count"
        />
        <TechContent
          v-if="techContent.length > 0"
          :event="techContent[0]"
          :transform="`translate(${2 + 56 / 2}, ${height - 10}) scale(0.55)`"
        />
      </g>
      <g
        v-for="player in players"
        :key="player.player.player"
        :transform="`translate(${tokenX(player.player.player)}, ${tokenY(player.player.player)}) scale(0.30)`"
      >
        <Token :faction="player.player.faction" filter="url(#drop-shadow-1)" :class="`${player.class}`" />
        <circle cx="0" cy="0" r="8" :class="['research-tile', player.class]"></circle>
      </g>
      <g v-if="this.federation" transform="translate(30, 25) scale(0.6)">
        <FederationTile
          :federation="this.federation"
          :numTiles="1"
          x="-25"
          y="-25"
          height="50"
          filter="url(#shadow-1)"
        />
      </g>
      <circle v-if="this.lostPlanet" :class="['planet-fill', this.lostPlanet]" cx="30" cy="16" r="9" />
    </g>
    <!-- <text x="0" y="0" :transform="`translate(${2 + 56/2 }, ${height - 10})`" class="levDesc">{{label}}</text> -->
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, {
  AdvTechTilePos,
  canResearchField,
  canTakeAdvancedTechTile,
  Condition,
  Expansion,
  Federation,
  Operator,
  Planet as PlanetEnum,
  Player,
  PlayerEnum,
  ResearchField,
  Resource as ResourceEnum,
  Event,
  researchEvents,
} from "@gaia-project/engine";
import { researchEventsWithCounters, researchLevelDesc } from "../data/research";
import Token from "./Token.vue";
import FederationTile from "./FederationTile.vue";
import Planet from "./Planet.vue";
import Resource from "./Resource.vue";
import { ButtonData } from "../data";
import { plusReward } from "../logic/utils";

@Component<ResearchTile>({
  components: {
    Token,
    FederationTile,
    Resource,
    Planet,
  },
})
export default class ResearchTile extends Vue {
  @Prop()
  field: ResearchField;

  @Prop()
  y: number;

  @Prop({ type: Number })
  level: number;

  resourceX(index: number) {
    const res = this.resources;
    const range = this.smallRange(res[0].type);

    let l = res.length;
    if (range) {
      l = 1;
      index = 0;
    }

    const sep = l <= 2 ? 7 : 6;

    return -6 * (l - 1) + index * 2 * sep - ((res[0].count as any) === "+" ? 2 : 0);
  }

  resourceY(index: number): number {
    const range = this.smallRange((this.resources)[0].type);
    return (this.height / 3) * 2 + 3 + this.resourceOffset + (range ? (index - .4) * 10 : 0);
  }

  scale(resource: ResourceEnum): number {
    return this.smallRange(resource) ? 0.8 : 1;
  }

  smallRange(resource: ResourceEnum): boolean {
    return (resource === ResourceEnum.ShipRange || resource === ResourceEnum.Range)
      && this.engine.expansions === Expansion.Frontiers;
  }

  tokenX(index: PlayerEnum) {
    return 10 + 13 * (index % 4) + 22 * (index > 3 ? 1 : 0);
  }

  tokenY(index: PlayerEnum) {
    return 10 + 13 * (index > 3 ? 1 : 0);
  }

  onClick() {
    if (this.highlighted) {
      this.$store.dispatch("researchClick", { command: this.field } as ButtonData);
    }
  }

  get resourceOffset() {
    return this.techContent.length > 0 ? -15 : 0;
  }

  get resources() {
    const events = researchEventsWithCounters(this.engine, this.field, this.level);
    const rewards = events
      .filter(e => e.spec !== "3pw" && e.condition === Condition.None)
      .flatMap((ev) => ev.rewards);
    if (events[0] && events[0].operator === Operator.Income) {
      rewards.unshift(plusReward);
    }
    return rewards;
  }

  get events() {
    return researchEvents(this.field, this.level, this.engine.expansions);
  }

  get techContent(): Event[] {
    return this.events.filter((event) => event.condition !== Condition.None);
  }

  get highlighted(): boolean {
    return this.$store.state.context.highlighted.researchTiles.has(this.field + "-" + this.level);
  }

  tokenClass(player: Player): string {
    const classes = [];

    if (this.level >= 4) {
      const tilePos = ("adv-" + this.field) as AdvTechTilePos;
      if (
        canTakeAdvancedTechTile(this.engine, player.data, tilePos) ||
        canResearchField(this.engine, player, this.field)
      ) {
        classes.push("warn");
      }
    }
    const c = this.$store.getters.researchClasses.get(player.faction)?.get(this.field);
    if (c) {
      classes.push(c);
    }
    return classes.join(" ");
  }

  get players(): Array<{ player: Player; class: string }> {
    const players = this.engine.players;
    return players
      .filter((player) => player.faction && player.data.research[this.field] === this.level)
      .map((p) => ({ player: p, class: this.tokenClass(p) }));
  }

  get tooltip() {
    return `<b>Level ${this.level}:</b> ${researchLevelDesc(this.engine, this.field, this.level, true).join("<br/>")}`;
  }

  get height() {
    return this.level === 5 ? 46 : 36;
  }

  get federation(): Federation {
    if (this.level === 5) {
      if (this.field === ResearchField.Terraforming) {
        return this.engine.terraformingFederation;
      }
    }
  }

  get lostPlanet(): PlanetEnum {
    if (this.level === 5 && this.field === ResearchField.Navigation) {
      for (const pl of this.players) {
        if (pl.player.data.lostPlanet) {
          return undefined;
        }
      }
      return PlanetEnum.Lost;
    }
  }

  get engine(): Engine {
    return this.$store.state.data;
  }
}
</script>

<style lang="scss">
svg {
  .research-board .research-tile {
    &:hover {
      fill-opacity: 0.5;
    }

    &.highlighted {
      fill-opacity: 0.3;
      cursor: pointer;
    }
  }

  circle.research-tile {
    display: none;
    stroke-width: 3;
  }

  circle.research-tile.recent {
    display: block;
    stroke: black;
    fill: var(--recent);
  }

  circle.research-tile.current-round {
    display: block;
    stroke: transparent;
    fill: var(--current-round);
  }

  .research-tile {
    fill: none;
    stroke: #444;
    stroke-width: 1;

    &.eco {
      fill: var(--rt-eco);
    }

    &.sci {
      fill: var(--rt-sci);
    }

    &.dip {
      fill: var(--rt-dip);
    }

    &.terra {
      fill: var(--rt-terra);
    }

    &.nav {
      fill: var(--rt-nav);
    }

    &.gaia {
      fill: var(--rt-gaia);
    }

    &.int {
      fill: var(--rt-int);
    }
  }

  text {
    font-family: arial;
    font-size: 10px;
    fill: black;

    // &.levDesc {
    //   dominant-baseline: central;
    //   text-anchor: middle;
    //   fill: white;
    //   pointer-events: none;
    //   opacity: 0.8;
    // }
  }
}
</style>
