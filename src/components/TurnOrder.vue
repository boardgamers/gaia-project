<template>
  <div class="turn-order">
    <h5>Turn order</h5>
    <svg viewBox="-1.2 -1.2 12.5 4">
      <g v-for="(player, index) in turnOrder" :key="index" :transform="`translate(${index * 2.5})`">
        <circle :r="1" :style='stroke(player)'  :class="['player-token', 'planet-fill', planet(player,index)]" />
        <text :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(player, index))}`">{{initial(player,index)}}</text>
        <text :style="`font-size: 1px; text-anchor: middle;`" y="2">{{name(player,index)}}</text>
      </g>

      <g v-for="(player, index) in passedPlayers" :key="'p-' + index" :transform="`translate(${(index + 1 + turnOrder.length) * 2.5})`" style="opacity: 0.5">
        <circle :r="1" :style='stroke(player)' :class="['player-token', 'planet-fill', planet(player,index)]" />
        <text :style="`font-size: 1.2px; text-anchor: middle; dominant-baseline: central; fill: ${planetFill(planet(player,index))}`">{{initial(player,index)}}</text>
        <text :style="`font-size: 1px; text-anchor: middle;`" y="2">{{name(player,index)}}</text>
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

  get phaseBeforeSetupBuilding(): boolean {
    const data = this.gameData;
    return ( data.phase == Phase.SetupInit || data.phase == Phase.SetupBoard || data.phase == Phase.SetupFaction || data.phase == Phase.SetupAuction);
  } 

  get turnOrder(): Player[] {
    const data = this.gameData;
    if ( this.phaseBeforeSetupBuilding ) {
      return data.players;
    }
    if ( data.phase == Phase.SetupBuilding || data.phase == Phase.SetupBooster || data.phase == Phase.SetupShip) {
      return data.setup.map(faction => data.players.find( pl => pl.faction == faction));
    }
    return data.turnOrder.map(player => data.players[player]);
  }

  get passedPlayers(): Player[] {
    return (this.gameData.passedPlayers ?? []).map(player => this.gameData.players[player]);
  }

  isCurrentPlayer(pl: Player) {
    return this.gameData.players[this.gameData.availableCommands?.[0]?.player] === pl && !(this.gameData.phase === Phase.SetupAuction);
  }

  stroke (pl: Player) {
    if (this.gameData.players[this.gameData.currentPlayer] === pl) {
      if (this.gameData.players[this.gameData.playerToMove] === pl) {
        return "stroke-width: 0.16px !important; stroke: #2c4";
      } else {
        return "stroke-width: 0.10px !important; stroke: #2c4";
      }
    }

    if (this.gameData.players[this.gameData.tempCurrentPlayer] === pl) {
      return "stroke-width: 0.18px !important; stroke: rgb(250, 116, 255)";
    }

    return "stroke-width: 0.06px !important";
  }

  planetFill(planet: string) {
    if (planet === Planet.Titanium || planet === Planet.Swamp) {
      return "white";
    }
    return "black";
  }

  planet(player: Player, index: number) {
    if (this.phaseBeforeSetupBuilding && this.gameData.setup[index]) { 
      return factions.planet(this.gameData.setup[index]);
    }

    if (player.faction) {  return factions.planet(player.faction)  };

    return Planet.Lost;
  }

  initial(player: Player, index: number) {
    if (this.phaseBeforeSetupBuilding && this.gameData.setup[index]) {     
      return this.gameData.setup[index][0].toUpperCase();
    }

    if (player.faction) {
      return player.faction[0].toUpperCase();
    }

    return "?";
  }

  name(player: Player, index: number) {

    if (this.phaseBeforeSetupBuilding ) { 
      if (this.gameData.phase === Phase.SetupAuction) {
        player = this.gameData.players.find(pl => pl.faction == this.gameData.setup[index])
      } else {
        return ""
      }      
    } 

    if (player) {
        if (player.name) {
          return player.name.substring(0, 3);
        } else {
          return "P" + (player.player + 1);  
        };
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