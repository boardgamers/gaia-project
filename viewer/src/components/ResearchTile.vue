<template>
  <g
    :transform="`translate(0, ${y})`"
    v-b-tooltip.nofade.html.left="tooltipTriggerConfig()"
    :title="tooltip"
    :class="field"
  >
    <rect x="2" y="2" :class="['research-tile', field, { highlighted }]" width="56" :height="height" @click="onClick" />
    <g style="pointer-events: none">
      <g style="opacity: 0.7">
        <Resource
          v-for="(resource, i) in resources"
          :key="'field-' + i"
          :transform="`translate(${2 + 56 / 2 + resourceX(i)}, ${resourceY(i)}) scale(1)`"
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
      <!-- The lost planet, as a plain `.planet-fill` disc - the global planets.css rule shades it
           with the same sphere gradient as the map's planets (and every other planet readout). -->
      <circle v-if="this.lostPlanet" :class="['planet-fill', this.lostPlanet]" cx="30" cy="16" r="9" />
    </g>
    <!-- <text x="0" y="0" :transform="`translate(${2 + 56/2 }, ${height - 10})`" class="levDesc">{{label}}</text> -->
  </g>
</template>

<script lang="ts">
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
  researchEvents,
  ResearchField,
} from "@gaia-project/engine";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import type { ButtonData } from "../data";
import { effectivePreviewPlayer } from "../data/faction-preview";
import { researchEventsWithCounters, researchLevelDesc } from "../data/research";
import { tooltipTriggerConfig } from "../logic/tooltip";
import { plusReward } from "../logic/utils";
import FederationTile from "./FederationTile.vue";
import Planet from "./Planet.vue";
import Resource from "./Resource.vue";
import Token from "./Token.vue";

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

  resourceY(index: number): number {
    return (this.height / 3) * 2 + 3 + this.resourceOffset;
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
      .filter((e) => e.spec !== "3pw" && e.condition === Condition.None)
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
    // An opponent advanced this track since the viewer's last turn - a gold dot in the middle of the
    // token they moved. Its rule comes last in the stylesheet, so it wins over "recent"/"current-round"
    // when the same token qualifies for both.
    if (this.$store.getters.recentOpponentResearch.get(player.faction)?.has(this.field)) {
      classes.push("last-move");
    }
    return classes.join(" ");
  }

  // A player whose faction is picked but not yet loaded (still true throughout the pick/ban/bid
  // setup phases - see `effectivePreviewPlayer`) has `player.data.research[field]` stuck at the
  // unloaded default of 0, which would draw their token on the base tile regardless of a starting
  // research bump like Moweyds'/Terrans' "up-gaia". Read the position from the effective (possibly
  // preview) player instead, while the token itself still renders for the real player/seat.
  get players(): Array<{ player: Player; class: string }> {
    const players = this.engine.players;
    return players
      .filter((player) => player.faction && effectivePreviewPlayer(player).data.research[this.field] === this.level)
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

  tooltipTriggerConfig = tooltipTriggerConfig;
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

  circle.research-tile.last-move {
    display: block;
    stroke: black;
    fill: var(--recent);
  }

  // Each research track is rendered as ONE column (the rounded `.track-bg` rect in
  // ResearchTrack.vue carries the silhouette, edge and lift); the per-level cells are flat,
  // crisp and borderless so the column reads as a single track, not six floating cards.
  .research-tile {
    fill: none;
    stroke: none;

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
