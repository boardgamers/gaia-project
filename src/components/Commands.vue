<template>
  <div id="move">
    <div id="move-title">
      <span v-if="init">Pick the number of players</span>
      <span v-else>
        {{[player, ...titles].join(' - ')}}
      </span>
    </div>
    <div id="move-buttons">
      <div v-if="init">
        <MoveButton v-for="i in [2,3,4,5]" :command="`init ${i} randomSeed`" @trigger="handleCommand">{{i}} players</MoveButton>
      </div>
      <div v-else-if="chooseFaction">
        <MoveButton v-for="faction in command.data" :command="`${command.name} ${faction}`" @trigger="handleCommand">
          {{factions[faction].name}}
          <i :class="['planet', factions[faction].planet]"></i>
        </MoveButton>
      </div>
      <div v-else>
        <MoveButton v-for="button in buttons" :command="button.command" @trigger="handleCommand" :hexes="button.hexes">
          {{button.label}}
        </MoveButton>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component } from 'vue-property-decorator';
import { AvailableCommand, Command, factions, Building, GaiaHex } from '@gaia-project/engine';
import MoveButton from './MoveButton.vue';
import {buildingName} from '../data/building';
import {GameContext} from '../data';

@Component<Commands>({
  watch: {
    availableCommands(this: Commands, val) {
      this.loadCommands(val);
    }
  },
  components: {
    MoveButton
  }
})
export default class Commands extends Vue {
  loadCommands(val: AvailableCommand[]) {
    this.commandTitles = [];

    for (const command of val) {
      if (command.name === Command.ChooseFaction) {
        this.title('Choose your faction');
        return;
      }
    }
  }

  get availableCommands(): AvailableCommand[] {
    return this.$store.state.game.data.availableCommands;
  }

  get command(): AvailableCommand {
    return this.availableCommands ? this.availableCommands[0] : null;
  }

  get player(): string {
    return "Player " + (this.command.player+1);
  }

  get init() {
    return !this.command || this.command.name === Command.Init;
  }

  get commandName () {
    return this.command ? this.command.name : null;
  }

  get chooseFaction() {
    return this.commandName === Command.ChooseFaction;
  }

  get titles() {
    return this.commandTitles.length === 0 ? ["Your turn"] : this.commandTitles;
  }

  get factions() {
    return factions;
  }

  handleCommand(command: string) {
    if (this.init) {
      this.$emit("command", command);
    } else {
      this.$emit("command", `p${this.command.player+1} ${command}`);
    }
  }

  title(title: string) {
    this.commandTitles.push(title);
  }

  get context(): GameContext {
    return this.$store.state.game.context;
  }

  get buttons(): ButtonData[] {
    const ret: ButtonData[] = [];

    for (const command of this.availableCommands) {
      switch (command.name) {
        case Command.Build: {
          for (const building of Object.values(Building)) {
            const coordinates = command.data.buildings.filter(bld => bld.building === building);

            if (coordinates.length > 0) {
              ret.push({
                label: (building === Building.Mine ? "Build a" : building === Building.GaiaFormer ? "Place a ": "Upgrade to") + " " + buildingName(building),
                command: `${Command.Build} ${building}`,
                hexes: coordinates.map(coord => this.context.coordsMap.get(coord.coordinates))
              });
            }
          }

          break;
        }

        // case Command.Pass: 
        // case Command.ChooseRoundBooster: {
        //   const values = [];
        //   const labels = [];
        //   const tooltips = [];

        //   Object.values(Booster).forEach((booster, i) => {
        //     if (command.data.boosters.includes(booster)) {
        //       values.push(booster);
        //       labels.push(`Booster ${i+1}: ${tiles.boosters[booster]}`);
        //       tooltips.push(tiles.boosters[booster].map(spec => eventDesc(new Event(spec))).join("\n"));
        //     }
        //   });

        //   addButton(command.name === Command.Pass ? "Pass" : "Pick booster", `${player} ${command.name}`, {values, labels, tooltips});
        //   break;
        // };

        // case Command.UpgradeResearch: {
        //   addButton("Advance research", `${player} ${Command.UpgradeResearch}`, {
        //     tracks: command.data.tracks.map(tr => ({level: tr.to, field: tr.field}))
        //   });

        //   break;
        // }

        // case Command.ChooseTechTile: case Command.ChooseCoverTechTile: {
        //   $("#move-title").append(command.name === Command.ChooseCoverTechTile ? "- Pick tech tile to cover" : " - Pick tech tile");
        //   for (const tile of command.data.tiles) {
        //     addButton(tile.tilePos, `${player} ${command.name} ${tile.tilePos}`);
        //   }
        //   pendingCommand = `${player} ${command.name}`,
        //   renderer.render(lastData, {techs: command.data.tiles.map(tile => tile.tilePos)});
        //   break;
        // }

        // case Command.Leech: {
        //   const leech = command.data.leech;
        //   const gainToken = command.data.freeIncome;

        //   if (gainToken) {
        //     addButton("Charge " + leech + " get " + gainToken, `${player} ${Command.Leech} ${leech},${gainToken}`);
        //     addButton("Get " + gainToken + " charge " + leech, `${player} ${Command.Leech} ${gainToken},${leech}`);
        //   } else {
        //     addButton("Charge " + leech, `${player} ${Command.Leech} ${leech}`);
        //   }
        //   break;
        // }

        // case Command.DeclineLeech: {
        //   addButton("Decline charge power", `${player} ${Command.DeclineLeech}`);
        //   break;
        // }

        // case Command.Spend: {
        //   const acts = command.data.acts;
        //   const values = acts.map(act => `${act.cost} for ${act.income}`);
        //   const labels = acts.map(act => `Spend ${act.cost} to gain ${act.income}`);
        //   addButton("Free action", `${player} ${Command.Spend}`, {values, labels});
        //   break;
        // };

        // case Command.Action: {
        //   const acts = command.data.poweracts;
        //   addButton("Power/Q.I.C Action", `${player} ${Command.Action}`, {values: acts.map(act => act.name), labels: acts.map(act => `Spend ${act.cost} for ${act.income.join(" / ")}`)});
        //   break;
        // }

        // case Command.Special: {
        //   const acts = command.data.specialacts;
        //   addButton("Special Action", `${player} ${Command.Special}`, {values: acts.map(act => act.income)});
        //   break;
        // }

        // case Command.BurnPower: {
        //   addButton("Burn power", `${player} ${Command.BurnPower}`, {values: command.data});
        //   break;
        // }

        // case Command.EndTurn: {
        //   addButton("End turn", `${player} ${Command.EndTurn}`);
        //   break;
        // }

        // case Command.FormFederation: {
        //   const values = [];
        //   const labels = [];
          
        //   Object.values(Federation).forEach((federation, i) => {
        //     if (command.data.tiles.includes(federation)) {
        //       values.push(federation);
        //       labels.push(`Federation ${i+1}: ${tiles.federations[federation]}`);
        //     }
        //   });

        //   addButton("Form federation", `${player} ${Command.FormFederation}`, {
        //     hexGroups: command.data.federations.map(fed => fed.hexes),
        //     values,
        //     labels
        //   });
        // }
      }
    }

    return ret;
  }

  private commandTitles = [];
}

interface ButtonData {
  label: string;
  command: string;
  hexes?: GaiaHex[];
}

</script>

<style lang="scss" scoped>

@import "../stylesheets/frontend.scss";

#move-title {
  @extend .mb-2;
}

i.planet {
  &::before {
    content: "\25cf";
    filter: drop-shadow(0px 0px 3px white);
  }

  // terra
  &.r {color: #99ccff}
  // desert
  &.d {color: #ffd700}
  // swamp
  &.s {color: #a25b15}
  // oxide
  &.o {color: #f30}
  // titanium
  &.t {color: #3d3d5c}
  // ice
  &.i {color: #cff}
  // volcanic
  &.v {color: #f90}
  // gaia
  &.g {color: #093}
  // transdim
  &.m {color: #a64dff}
}

</style>
