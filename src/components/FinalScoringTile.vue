<template>
  <g :class='["finalScoringTile", {highlighted}]' v-b-tooltip :title="tooltip">
    <rect x="1" y="1" width="75" height="55" />
    <text class="title" x="5" y="12">{{content}}</text>
    <Token v-for="(player, index) in players" :faction="player.faction" :transform="`translate(${tokenX(index)}, ${tokenY(index)})`" :key="player.faction" :scale="8" />
    <text v-for="(player, index) in players" :key="player.faction + '-text'" :transform="`translate(${tokenX(index)}, ${tokenY(index)+0.5})`" :class="['score', player.faction]">
      {{progress(player)}}
    </text>
  </g>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator';
import { tiles, Event, factions, FinalTile, Phase, Player, finalScorings, Faction } from '@gaia-project/engine';
import Token from "./Token.vue";

@Component<FinalScoringTile>({
  computed: {
    tile() {
      return this.$store.state.gaiaViewer.data.tiles.scorings.final[this.index];
    },

    content() {
      return this.tile;
    },

    players() {
      const pls = this.$store.state.gaiaViewer.data.players.filter(player => !!player && player.faction);

      if (this.$store.state.gaiaViewer.data.players.length === 2) {
        pls.push({faction: "automa"});
      }

      return pls;
    },

    tooltip() {
      const tile = this.tile;
      const players = this.players;

      return players.map(pl => {
        const name = pl.faction === "automa" ? "Automa" : factions[pl.faction].name;
        const points = this.progress(pl);
        return `- ${name}: ${points}`;
      }).join('\n');
    },

    highlighted() {
      return this.$store.state.gaiaViewer.data.phase === Phase.EndGame;
    }
  },

  components: {
    Token
  }
})
export default class FinalScoringTile extends Vue {
  @Prop()
  index: number;

  progress(player: Player) {
    return (player.faction as Faction | "automa") === "automa" ? finalScorings[this.tile].neutralPlayer : player.progress(this.tile);
  }

  tokenX(index: number) {
    return (index%2) * 30 + 23;
  }

  tokenY(index: number) {
    return 25 + (index > 1 ? 17 : 0);
  }
}
export default interface FinalScoringTile {
  tile: FinalTile;
  players: Player[];
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
      dominant-baseline: mathematical;

      &.automa {
        fill: #333;
      }
    }

    g .player-token {
      stroke-width: 0.01;
    }

    line {
      stroke-width: 0.2;
      stroke: #111;
    }

    &.highlighted rect {
      stroke: #2C4;
    }
  }
}

</style>
