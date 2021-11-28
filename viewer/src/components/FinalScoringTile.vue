<template>
  <g :class="['finalScoringTile', { highlighted }]" v-b-tooltip :title="tooltip">
    <rect x="1" y="1" width="75" height="55" />
    <text class="title" x="5" y="12">{{ content }}</text>
    <Token
      v-for="(player, index) in players"
      :faction="player.faction"
      :transform="` translate(${tokenX(index)}, ${tokenY(index)}) scale(0.4)`"
      :key="player.faction"
    />
    <text
      v-for="(player, index) in players"
      :key="player.faction + '-text'"
      :transform="`translate(${tokenX(index)}, ${tokenY(index)})`"
      :class="['score', player.faction]"
    >
      {{ progress(player) }}
    </text>
    <circle
      v-for="(mode, index) in mapModeType"
      :key="mode.player.faction + '-circle'"
      :transform="`translate(${tokenX(index)}, ${tokenY(index)})`"
      class="button"
      role="button"
      @click="toggleMapMode(mode.type, mode.player)"
      r="9"
    />
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Phase, Player, finalScorings, Faction, FinalTile } from "@gaia-project/engine";
import Token from "./Token.vue";
import { factionName } from "../data/factions";
import { MapMode, MapModeType } from "../data/actions";

@Component<FinalScoringTile>({
  computed: {
    tooltip() {
      const tile = this.tile;
      const players = this.players;

      return players
        .map((pl) => {
          const name = pl.faction === "automa" ? "Automa" : factionName(pl.faction);
          const points = this.progress(pl);
          return `- ${name}: ${points}`;
        })
        .join("\n");
    },

    highlighted() {
      return this.$store.state.data.phase === Phase.EndGame;
    },
  },

  components: {
    Token,
  },
})
export default class FinalScoringTile extends Vue {
  @Prop()
  index: number;

  progress(player: Player) {
    return (player.faction as Faction | "automa") === "automa"
      ? finalScorings[this.tile].neutralPlayer
      : player.progress(this.tile);
  }

  get tile(): FinalTile {
    return this.$store.state.data.tiles.scorings.final[this.index];
  }

  get mapModeType(): { type: MapModeType; player: Player }[] {
    const m = (type: MapModeType) => this.players.filter(p => p.faction != "automa").map(player => ({ type, player }));
    switch (this.tile) {
      case FinalTile.Sector:
        return m("sectors");
      case FinalTile.StructureFed:
      case FinalTile.Satellite:
        return m("federations");
    }
    return [];
  }

  toggleMapMode(mode: MapModeType, player: Player) {
    this.$store.commit("toggleMapMode", { type: mode, player: player.player  } as MapMode);
  }

  get content() {
    return this.tile;
  }

  get players() {
    const pls = this.$store.state.data.players.filter((player) => !!player && player.faction);

    if (this.$store.state.data.players.length === 2) {
      pls.push({ faction: "automa" });
    }

    return pls;
  }

  tokenX(index: number) {
    return (index % 2) * 30 + 23;
  }

  tokenY(index: number) {
    return 25 + (index > 1 ? 19 : 0);
  }
}
</script>

<style lang="scss">
g {
  &.finalScoringTile {
    rect {
      stroke: #333;
      stroke-width: 1px;
      fill: white;
    }
    .title {
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
    }
    .score {
      font-size: 12px;
      pointer-events: none;
      fill: white;
      text-anchor: middle;
      dominant-baseline: central;

      &.automa,
      &.gleens,
      &.xenos,
      &.itars,
      &.nevlas {
        fill: #333;
      }
    }

    line {
      stroke-width: 0.2;
      stroke: #111;
    }

    &.highlighted rect {
      stroke: var(--highlighted);
    }

    .player-token {
      stroke: #111;
      stroke-width: 1;
    }

    .button {
      opacity: 0;
    }
  }
}
</style>
