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
          :transform="`translate(${2 + 56 / 2 + resourceX(i)}, ${(height / 3) * 2 + 3 + resourceOffset})`"
          :kind="resource.type"
          :count="resource.count"
        />
        <TechContent
          v-if="techContent.length > 0"
          :content="techContent[0].toString()"
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
  Event,
  Federation,
  Operator,
  Planet as PlanetEnum,
  Player,
  PlayerEnum,
  ResearchField,
  researchTracks,
  Resource as ResourceEnum,
  Reward,
} from "@gaia-project/engine";
import { descriptions } from "../data/research";
import Token from "./Token.vue";
import FederationTile from "./FederationTile.vue";
import Planet from "./Planet.vue";
import Resource from "./Resource.vue";
import { ButtonData } from "../data";

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
    const l = res.length;
    const sep = l <= 2 ? 7 : 6;

    return -6 * (l - 1) + index * 2 * sep - ((res[0].count as any) === "+" ? 2 : 0);
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
    const rewards = Reward.merge(...this.events.slice(0, 1).map((ev) => ev.rewards));

    if (this.events[0] && this.events[0].operator === Operator.Income) {
      rewards.unshift(new Reward("+", ResourceEnum.None));
      rewards[0].count = "+" as any;
    }

    const extraRewards = new Map<ResearchField, Map<number, string>>([
      [
        ResearchField.Terraforming,
        new Map([
          [0, "d"],
          [2, "2d"],
          [3, "3d"],
        ]),
      ],
      [
        ResearchField.Navigation,
        new Map([
          [0, "1r"],
          [2, "2r"],
          [4, "3r"],
          [5, "4r"],
        ]),
      ],
      [
        ResearchField.GaiaProject,
        new Map([
          [1, "6tg"],
          [3, "4tg"],
          [4, "3tg"],
        ]),
      ],
    ]);

    const extra = extraRewards.get(this.field)?.get(this.level);
    if (extra) {
      const r = Reward.parse(extra);
      if (this.field === ResearchField.GaiaProject) {
        return rewards.concat(r);
      }
      return r;
    }
    return rewards;
  }

  get events() {
    return researchTracks[this.field][this.level].map((s) => new Event(s));
  }

  get techContent() {
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
        canTakeAdvancedTechTile(this.gameData, player.data, tilePos) ||
        canResearchField(this.gameData, player, this.field)
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
    const players = this.gameData.players;
    return players
      .filter((player) => player.faction && player.data.research[this.field] === this.level)
      .map((p) => ({ player: p, class: this.tokenClass(p) }));
  }

  get tooltip() {
    return `<b>Level ${this.level}:</b> ${descriptions[this.field][this.level]}`;
  }

  get height() {
    return this.level === 5 ? 46 : 36;
  }

  get federation(): Federation {
    if (this.level === 5) {
      if (this.field === ResearchField.Terraforming) {
        return this.gameData.terraformingFederation;
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

  get gameData(): Engine {
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
