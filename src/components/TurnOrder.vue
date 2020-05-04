<template>
  <div class="turn-order">
    <h5>Turn order</h5>
    <svg viewBox="-1.2 -1.2 12.5 4">
      <g v-for="(player, index) in turnOrder" :key="index" :transform="`translate(${index * 2.5})`">
        <circle :r="1" :style='isCurrentPlayer(player) ? "stroke-width: 0.16px !important; stroke: #2c4" : "stroke-width: 0.06px !important"'  :class="['player-token', 'planet-fill', planet(player,index)]" />
        <text :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(player, index))}`">{{initial(player,index)}}</text>
        <text :style="`font-size: 1px; text-anchor: middle;`" y="2">{{name(player,index)}}</text>
      </g>

      <g v-for="(player, index) in passedPlayers" :key="'p-' + index" :transform="`translate(${(index + 1 + turnOrder.length) * 2.5})`" style="opacity: 0.5">
        <circle :r="1"  :style='isCurrentPlayer(player) ? "stroke-width: 0.16px !important; stroke: #2c4" : "stroke-width: 0.06px !important"' :class="['player-token', 'planet-fill', planet(player,index)]" />
        <text :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(player,index))}`">{{initial(player,index)}}</text>
      </g>
    </svg>
  </div>
</template>
<script lang="ts">
import {Vue, Component, Prop, Watch} from "vue-property-decorator";
import Engine, { factions, Player, Planet, Phase} from "@gaia-project/engine";
import { isNull } from "util";

@Component
export default class TurnOrder extends Vue {
  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get turnOrder(): Player[] {
    const data = this.gameData;
    if ( data.phase == Phase.SetupInit || data.phase == Phase.SetupBoard || data.phase == Phase.SetupFaction || data.phase == Phase.SetupAuction) {
      return data.players;
    }
    if ( data.phase == Phase.SetupBuilding || data.phase == Phase.SetupBooster || data.phase == Phase.SetupShip) {
      return data.setup.map(bid => data.players[bid.player]);
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

  planet(player: Player, index: number) {
    if (player.faction) {  return factions.planet(player.faction)  };
    
    if (this.gameData.setup[index] && this.gameData.setup[index].faction) { 
      return factions.planet(this.gameData.setup[index].faction);
    } 

    return Planet.Lost;
  }

  initial(player: Player, index: number) {
    if (player.faction) {
      return player.faction[0].toUpperCase();
    }

    if (this.gameData.setup[index] && this.gameData.setup[index].faction) { 
      return this.gameData.setup[index].faction[0].toUpperCase();
    } 

    if (player.name) {
      return player.name[0];
    }

    return "?";
  }

  name(player: Player, index: number) {

    if (this.gameData.setup[index] && !isNull(this.gameData.setup[index].player)) { 
      if (player.name) {
        return player.name;
      } else {
        return "P" + (this.gameData.setup[index].player + 1);  
      }     
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