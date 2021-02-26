<template>
  <g>
    <circle :r="1" :style="stroke()" :class="['player-token', 'planet-fill', planet()]" />
    <text :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet())}`">
      {{ initial() }}
    </text>
    <text :style="`font-size: 1px; text-anchor: middle;`" y="2">{{ name() }}</text>
  </g>
</template>
<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import Engine, { factions, Phase, Planet, Player, PlayerEnum } from "@gaia-project/engine";
import { phaseBeforeSetupBuilding } from "../logic/charts";

@Component
export default class PlayerCircle extends Vue {
  @Prop()
  index: PlayerEnum;

  @Prop()
  player: Player;

  @Prop()
  chart: boolean;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  stroke() {
    if (this.chart) {
      return "";
    }

    if (this.gameData.players[this.gameData.currentPlayer] === this.player) {
      if (this.gameData.players[this.gameData.playerToMove] === this.player) {
        return "stroke-width: 0.16px !important; stroke: #2C4";
      } else {
        return "stroke-width: 0.10px !important; stroke: #2C4";
      }
    }

    if (this.gameData.players[this.gameData.tempCurrentPlayer] === this.player) {
      return "stroke-width: 0.18px !important; stroke: rgb(250, 116, 255)";
    }

    return "stroke-width: 0.06px !important";
  }

  planetFill(planet: string) {
    if (planet === Planet.Lost || planet === Planet.Titanium || planet === Planet.Swamp) {
      return "white";
    }
    return "black";
  }

  planet() {
    if (this.index === PlayerEnum.All) {
      return Planet.Lost;
    }

    if (phaseBeforeSetupBuilding(this.gameData) && this.gameData.setup[this.index]) {
      return factions.planet(this.gameData.setup[this.index]);
    }

    if (this.player?.faction) {
      return factions.planet(this.player.faction);
    }

    return Planet.Lost;
  }

  initial() {
    if (this.index === PlayerEnum.All) {
      return "A";
    }

    if (phaseBeforeSetupBuilding(this.gameData) && this.gameData.setup[this.index]) {
      return this.gameData.setup[this.index][0].toUpperCase();
    }

    if (this.player?.faction) {
      return this.player.faction[0].toUpperCase();
    }

    return "?";
  }

  name() {
    if (this.index === PlayerEnum.All) {
      return "All";
    }
    let player = this.player;

    if (phaseBeforeSetupBuilding(this.gameData)) {
      if (this.gameData.phase === Phase.SetupAuction) {
        player = this.gameData.players.find((pl) => pl.faction === this.gameData.setup[this.index]);
      } else {
        return "";
      }
    }

    if (player) {
      if (player.name) {
        return player.name.substring(0, 3);
      } else {
        return "P" + (player.player + 1);
      }
    }

    return "?";
  }
}
</script>
