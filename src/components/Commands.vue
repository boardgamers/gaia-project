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
        <MoveButton v-for="i in [2,3,4,5]" :button="{command: `init ${i} randomSeed`}" @trigger="handleCommand" :key="i">{{i}} players</MoveButton>
      </div>
      <div v-else-if="chooseFaction">
        <MoveButton v-for="faction in command.data" :button="{command: `${command.name} ${faction}`}" @trigger="handleCommand" :key="faction">
          {{factions[faction].name}}
          <i :class="['planet', factions[faction].planet]"></i>
        </MoveButton>
      </div>
      <div v-else>
        <MoveButton v-for="button in buttons" v-show="!button.hide" @trigger="handleCommand" :button="button" :key="button.label || button.command">
          {{button.label || button.command}}
        </MoveButton>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import * as $ from "jquery";
import { Component } from 'vue-property-decorator';
import { AvailableCommand, Command, factions, Building, GaiaHex, Booster, tiles, Event, Federation } from '@gaia-project/engine';
import MoveButton, {ButtonData} from './MoveButton.vue';
import {buildingName} from '../data/building';
import {GameContext} from '../data';
import { eventDesc } from '@/data/event';

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
    this.customButtons = [];
    this.commandChain = [];

    for (const command of val) {
      if (command.name === Command.ChooseFaction) {
        this.title('Choose your faction');
        return;
      }
    }

    // If there's only one button, save the player the hassle and click it
    if (val.length === 1) {
      setTimeout(() => {
        if ($(".move-button").length <= 1)  {
          $(".move-button").click();
        }
      });
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

  handleCommand(command: string, source: MoveButton, final: boolean) {
    console.log("handle command", command);
    if (source.button.buttons && source.button.buttons.length > 0 && !final) {
      this.commandTitles.push(source.button.label);
      this.commandChain.push(source.button.command);
      this.customButtons = source.button.buttons;

      return;
    }
    if (this.init) {
      this.$emit("command", command);
    } else {
      this.$emit("command", `p${this.command.player+1} ${[...this.commandChain, command].join(' ')}`);
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
                hexes: new Map(coordinates.map(coord => [this.context.coordsMap.get(coord.coordinates), coord]))
              });
            }
          }

          break;
        }

        case Command.Pass: 
        case Command.ChooseRoundBooster: {
          const buttons: ButtonData[] = [];

          Object.values(Booster).forEach((booster, i) => {
            if (command.data.boosters.includes(booster)) {
              buttons.push({
                command: booster,
                label: `Booster ${i+1}: ${tiles.boosters[booster]}`,
                tooltip: tiles.boosters[booster].map(spec => eventDesc(new Event(spec))).join("\n")
              });
            }
          });

          ret.push({
            label: command.name === Command.Pass ? "Pass" : "Pick booster",
            command: command.name,
            buttons
          });

          break;
        };

        case Command.UpgradeResearch: {
          ret.push({
            label: "Advance research",
            command: command.name,
            // track.to contains actual level, to use when implementing research viewer
            buttons: command.data.tracks.map(track => ({command: track.field})),
            researchTiles: command.data.tracks.map(track => track.field + "-" + track.to),
          });
          break;
        }

        case Command.ChooseTechTile: case Command.ChooseCoverTechTile: {
          ret.push({
            label: command.name === Command.ChooseCoverTechTile ? "- Pick tech tile to cover" : " - Pick tech tile",
            command: command.name,
            techs: command.data.tiles.map(tile => tile.tilePos),
            buttons: command.data.tiles.map(tile => ({command: tile.tilePos}))
          });
          break;
        }

        case Command.Leech: {
          const leech = command.data.leech;
          const gainToken = command.data.freeIncome;

          if (gainToken) {
            ret.push({
              label: "Charge " + leech + " get " + gainToken,
              command: `${Command.Leech} ${leech},${gainToken}`
            }, {
              label: "Get " + gainToken + " charge " + leech,
              command: `${Command.Leech} ${gainToken},${leech}`
            });
          } else {
            ret.push({
              label: "Charge " + leech,
              command: `${Command.Leech} ${leech}`
            });
          }
          break;
        }

        case Command.DeclineLeech: {
          ret.push({
            label: "Decline charge power",
            command: Command.DeclineLeech
          });
          break;
        }

        case Command.Spend: {
          ret.push({
            label: "Free action",
            command: Command.Spend,
            buttons: command.data.acts.map(act => ({label: `Spend ${act.cost} to gain ${act.income}`, command: `${act.cost} for ${act.income}`}))
          });
          break;
        };

        case Command.Action: {
          ret.push({
            label: "Power/Q.I.C Action",
            command: Command.Action,
            buttons: command.data.poweracts.map(act => ({command: act.name, label: `Spend ${act.cost} for ${act.income.join(" / ")}`}))
          });
          break;
        }

        case Command.Special: {
          ret.push({
            label: "Special Action",
            command: Command.Special,
            buttons: command.data.specialacts.map(act => ({command: act.income}))
          });
          break;
        }

        case Command.BurnPower: {
          ret.push({
            label: "Burn power",
            command: Command.BurnPower,
            buttons: command.data.map(val => ({command: val}))
          });
          break;
        }

        case Command.EndTurn: {
          ret.push({
            label: "End Turn",
            command: Command.EndTurn
          });
          break;
        }

        case Command.ChooseIncome: {
          ret.push({
            label: "Income order",
            command: Command.ChooseIncome,
            buttons: command.data.map(command => ({command}))
          });
          break;
        }

        case Command.FormFederation: {
          const tilesButtons = Object.values(Federation).map((fed, i) => ({
            command: fed,
            label: `Federation ${i+1}: ${tiles.federations[fed]}`
          }));

          const locationButtons = command.data.federations.map((fed, i) => ({
            command: fed.hexes,
            label: `Location ${i+1}`,
            hexes: new Map(fed.hexes.split(',').map(coord => [this.context.coordsMap.get(coord), {coordinates: coord}])),
            hover: true,
            buttons: tilesButtons
          }));

          ret.push(({
            label: "Form federation",
            command: Command.FormFederation,
            buttons: locationButtons
          }));
        }
      }
    }

    if (this.customButtons.length > 0) {
      for (const button of ret) {
        button.hide = true;
      }

      ret.push(...this.customButtons);
    }

    return ret;
  }

  private commandTitles: string[] = [];
  private customButtons: ButtonData[] = [];
  private commandChain: string[] = [];
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
