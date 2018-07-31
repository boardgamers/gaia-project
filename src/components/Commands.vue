<template>
  <div id="move">
    <div id="move-title">
      <h5>
        <span v-if="init">Pick the number of players</span>
        <span v-else>
          {{[player, ...titles].join(' - ')}}
        </span>
      </h5>
    </div>
    <div id="move-buttons">
      <div v-if="init">
        <MoveButton v-for="i in [2,3,4]" :button="{command: `init ${i} randomSeed`}" @trigger="handleCommand" :key="i">{{i}} players</MoveButton>
      </div>
      <div v-else-if="chooseFaction">
        <MoveButton v-for="faction in command.data" :button="{command: `${command.name} ${faction}`,  tooltip:`${tooltip(faction)}`}" @trigger="handleCommand" :key="faction">
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
import { AvailableCommand, Command, factions, Building, GaiaHex, Booster, tiles, Event, Federation, Faction } from '@gaia-project/engine';
import MoveButton from './MoveButton.vue';
import {buildingName} from '../data/building';
import {GameContext, ButtonData} from '../data';
import { eventDesc } from '@/data/event';
import { factionDesc } from '@/data/factions';

@Component<Commands>({
  watch: {
    availableCommands(this: Commands, val) {
      this.loadCommands(val);
    }
  },
  methods: {
    tooltip(faction: Faction) {
      return `<b>Ability: </b> ${factionDesc[faction].ability} </br><b>PI: </b> ${factionDesc[faction].PI} `;
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
    if (this.$store.state.game.data.players[this.command.player].faction) {
      return factions[this.$store.state.game.data.players[this.command.player].faction].name;
    }
    if (this.$store.state.game.data.players[this.command.player].name) {
      return this.$store.state.game.data.players[this.command.player].name;
    }
    return "Player " + (this.command.player+1);
  }

  get playerSlug(): string {
    return this.$store.state.game.data.players[this.command.player].faction || `p${this.command.player+1}`;
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
      this.$emit("command", `${this.playerSlug} ${[...this.commandChain, command].join(' ')}`);
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
              let label = `Build a ${buildingName(building)}`;

              if (coordinates[0].upgrade) {
                label = `Upgrade to ${buildingName(building)}`;
              } else if (coordinates[0].downgrade) {
                label = `Downgrade to ${buildingName(building)}`;
              } else if (coordinates[0].cost === "~" || building === Building.SpaceStation || building === Building.GaiaFormer) {
                label = `Place a ${buildingName(building)}`;
              }

              ret.push({
                label,
                command: `${Command.Build} ${building}`,
                hexes: new Map(coordinates.map(coord => [this.context.coordsMap.get(coord.coordinates), coord]))
              });
            }
          }

          break;
        }

        case Command.PISwap: {
          ret.push({
            label: "Swap Planetary Institute",
            command: command.name,
            hexes: new Map(command.data.buildings.map(coord => [this.context.coordsMap.get(coord.coordinates), coord]))
          });
          break;
        }

        case Command.PlaceLostPlanet: {
          ret.push({
            label: "Place Lost Planet",
            command: command.name,
            hexes: new Map(command.data.spaces.map(coord => [this.context.coordsMap.get(coord.coordinates), coord]))
          });
          break;
        }

        case Command.Pass: 
        case Command.ChooseRoundBooster: {
          const buttons: ButtonData[] = [];

          Object.values(Booster).forEach((booster, i) => {
            if (command.data.boosters.includes(booster)) {
              buttons.push({
                command: booster,
                label: `Booster ${i+1}`,
                tooltip: tiles.boosters[booster].map(spec => eventDesc(new Event(spec))).join("\n")
              });
            }
          });

          ret.push({
            label: command.name === Command.Pass ? "Pass" : "Pick booster",
            command: command.name,
            buttons,
            boosters: command.data.boosters
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
            label: command.name === Command.ChooseCoverTechTile ? "Pick tech tile to cover" : "Pick tech tile",
            command: command.name,
            techs: command.data.tiles.map(tile => tile.pos),
            buttons: command.data.tiles.map(tile => ({command: tile.pos}))
          });
          break;
        }

        case Command.ChargePower: {
          const leech = command.data.offer;
          const gainToken = command.data.freeIncome;

          if (gainToken) {
            ret.push({
              label: "Charge " + leech + " get " + gainToken,
              command: `${Command.ChargePower} ${leech},${gainToken}`
            }, {
              label: "Get " + gainToken + " charge " + leech,
              command: `${Command.ChargePower} ${gainToken},${leech}`
            });
          } else {
            ret.push({
              label: command.data.cost && command.data.cost !== "~" ? "Charge " + leech + " for " + command.data.cost : "Charge " + leech,
              command: `${Command.ChargePower} ${leech}`
            });
          }
          break;
        }

        case Command.Decline: {
          ret.push({
            label: `Decline ${command.data.offer}`,
            command: Command.Decline
          });
          break;
        }

        case Command.BrainStone: {
          ret.push(...command.data.sort().map(area => ({
            label: `Brainstone ${area}`,
            command: `${command.name} ${area}`
          })));
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
            actions: command.data.poweracts.map(act => act.name),
            buttons: command.data.poweracts.map(act => ({command: act.name, label: `Spend ${act.cost} for ${act.income.join(" / ")}`}))
          });
          break;
        }

        case Command.Special: {
          ret.push({
            label: "Special Action",
            command: Command.Special,
            actions: command.data.specialacts.map(act => act.income),
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
          const tilesButtons = command.data.tiles.map((fed, i) => ({
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

          locationButtons.push({
            label: "Custom location",
            selectHexes: true,
            hexes: locationButtons[0].hexes,
            buttons: tilesButtons
          });

          ret.push(({
            label: "Form federation",
            command: Command.FormFederation,
            buttons: locationButtons
          }));
          break;
        }

        case Command.ChooseFederationTile: {
          const tilesButtons = command.data.tiles.map((fed, i) => ({
            command: fed,
            label: `Federation ${i+1}: ${tiles.federations[fed]}`
          }));

          ret.push(({
            label: "Rescore federation",
            command: Command.ChooseFederationTile,
            buttons: tilesButtons
          }));
          break;
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

<style lang="scss">

@import "../stylesheets/frontend.scss";

#move-title {
  @extend .mb-2;
}

i.planet {
  &::before {
    content: "\25cf";

    .player-info & {
      font-size: 25px;
    }
  }

  // terra
  &.r {color: #99ccff; filter: drop-shadow(0px 0px 1px black);}
  // desert
  &.d {color: #ffd700; filter: drop-shadow(0px 0px 1px black);}
  // swamp
  &.s {color: #a25b15; filter: drop-shadow(0px 0px 1px white);}
  // oxide
  &.o {color: #f30 ; filter: drop-shadow(0px 0px 1px white);}
  // titanium
  &.t {color: #3d3d5c; filter: drop-shadow(0px 0px 1px white);}
  // ice
  &.i {color: #cff; filter: drop-shadow(0px 0px 1px black);}
  // volcanic
  &.v {color: #f90; filter: drop-shadow(0px 0px 1px white);}
  // gaia
  &.g {color: #093; filter: drop-shadow(0px 0px 1px white);}
  // transdim
  &.m {color: #a64dff; filter: drop-shadow(0px 0px 1px white);}
}

</style>
