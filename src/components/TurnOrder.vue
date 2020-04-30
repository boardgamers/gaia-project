<template>
  <div class="turn-order">
    <h5>Turn order</h5>
    <svg viewBox="-1.2 -1.2 12.5 2.5">
      <g v-for="(player, index) in turnOrder" :key="index" :transform="`translate(${index * 2.5})`">
        <circle :r="1" :style='isCurrentPlayer(player) ? "stroke-width: 0.16px !important; stroke: #2c4" : "stroke-width: 0.06px !important"'  :class="['player-token', 'planet-fill', planet(player)]" />
        <text :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(player))}`">{{initial(player)}}</text>
      </g>

      <g v-for="(player, index) in passedPlayers" :key="'p-' + index" :transform="`translate(${(index + 1 + turnOrder.length) * 2.5})`" style="opacity: 0.5">
        <circle :r="1"  :style='isCurrentPlayer(player) ? "stroke-width: 0.16px !important; stroke: #2c4" : "stroke-width: 0.06px !important"' :class="['player-token', 'planet-fill', planet(player)]" />
        <text :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(player))}`">{{initial(player)}}</text>
      </g>
    </svg>
  </div>
</template>
<script lang="ts">
import {Vue, Component, Prop, Watch} from "vue-property-decorator";
import Engine, { factions, Player, Planet } from "@gaia-project/engine";

@Component
export default class TurnOrder extends Vue {
  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get turnOrder(): Player[] {
    const data = this.gameData;

    if (!data.round || !data.turnOrder) {
      return data.players;
    }

    return data.turnOrder.map(player => data.players[player]);
  }

  get passedPlayers(): Player[] {
    return (this.gameData.passedPlayers ?? []).map(player => this.gameData.players[player]);
  }

  isCurrentPlayer(pl: Player) {
    return this.gameData.players[this.gameData.availableCommands?.[0]?.player] === pl;
  }

  planetFill(planet: string) {
    if (planet === Planet.Titanium || planet === Planet.Swamp) {
      return "white";
    }
    return "black";
  }

  planet(player: Player) {
    if (!player.faction) {
      return Planet.Lost;
    }

    return factions.planet(player.faction);
  }

  initial(player: Player) {
    if (player.faction) {
      return player.faction[0].toUpperCase();
    }

    if (player.name) {
      return player.name[0];
    }

    return "?";
  }
}

</script>
<style lang="scss">

.turn-order {
  & > svg {
    max-width: 250px;
  }
}

</style>