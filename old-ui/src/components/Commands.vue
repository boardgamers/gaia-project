<template>
  <div id="move">
    <div id="move-title">
      <h5>
        <span v-if="init">Pick the number of players</span>
        <span v-else>
          {{ [player, ...titles].join(" - ") }}
          <a href="#" v-if="commandChain.length > 0" class="smaller small" @click.prevent="back()">(back)</a>
          <a href="#" v-else-if="canUndo" class="smaller small" @click.prevent="undo()">(undo)</a>
        </span>
      </h5>
    </div>
    <div id="move-buttons">
      <div v-if="init">
        <MoveButton
          v-for="i in [2, 3, 4]"
          :button="{ command: `init ${i} randomSeed`, label: `${i} players` }"
          @trigger="handleCommand"
          :key="i"
        ></MoveButton>
      </div>
      <div v-else-if="chooseFaction">
        <MoveButton
          v-for="faction in command.data"
          :button="{
            command: `${command.name} ${faction}`,
            modal: tooltip(faction),
            title: factionName(faction),
            label: `${factionName(faction)} <i class='planet ${factionPlanet(faction)}'></i>`,
          }"
          @trigger="handleCommand"
          :key="faction"
        />
        <MoveButton :button="randomFactionButton" @cancel="updateRandomFaction" @trigger="handleCommand" />
      </div>
      <div v-else>
        <MoveButton
          v-for="(button, i) in buttons"
          :class="{ 'd-none': button.hide, shown: !button.hide }"
          :ref="`button-${i}`"
          :data-ref="`button-${i}`"
          @trigger="handleCommand"
          :button="button"
          :key="(button.label || button.command) + '-' + i"
        >
          {{ button.label || button.command }}
        </MoveButton>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, {
  AvailableCommand,
  Booster,
  Building,
  Command,
  Event,
  Expansion,
  Faction,
  factionPlanet,
  GaiaHex,
  SpaceMap,
} from "@gaia-project/engine";
import MoveButton from "./MoveButton.vue";
import { buildingName } from "../data/building";
import { ButtonData, GameContext, HighlightHexData } from "../data";
import { eventDesc } from "../data/event";
import { factionDesc, factionName } from "../data/factions";
import { boosterEvents } from "@gaia-project/engine/src/tiles/boosters";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";

@Component<Commands>({
  watch: {
    availableCommands(this: Commands, val) {
      this.loadCommands(val);
    },
  },
  methods: {
    tooltip(faction: Faction) {
      return factionDesc(faction);
    },
  },
  computed: {
    canUndo() {
      return !this.$store.state.data.newTurn;
    },
    randomFactionButton() {
      this.updater = this.updater + 1;
      const command = this.command;
      const faction = command.data[Math.floor(Math.random() * command.data.length)];

      return {
        command: `${command.name} ${faction}`,
        label: "Random",
        modal: this.tooltip(faction),
        title: factionName(faction),
      };
    },
  },
  components: {
    MoveButton,
  },
})
export default class Commands extends Vue {
  @Prop({ default: "" })
  remainingTime: string;

  updater = 0;

  loadCommands(val: AvailableCommand[]) {
    this.commandTitles = [];
    this.customButtons = [];
    this.commandChain = [];
    this.buttonChain = [];

    for (const command of val) {
      if (command.name === Command.ChooseFaction) {
        this.title("Choose your faction");
        return;
      }
    }

    // Seems to cause problems on mobile
    // If there's only one button, save the player the hassle and click it
    // setTimeout(() => {
    //   if ($(".move-button.shown").length === 1)  {
    //     const ref = $(".move-button.shown").attr("data-ref");
    //     (this.$refs[ref][0] as MoveButton).handleClick();
    //   }
    // });
  }

  get availableCommands(): AvailableCommand[] {
    return this.engine.availableCommands;
  }

  get command(): AvailableCommand {
    return this.availableCommands ? this.availableCommands[0] : null;
  }

  get player(): string {
    if (this.engine.players[this.command.player].faction) {
      return factionName(this.engine.players[this.command.player].faction);
    }
    if (this.engine.players[this.command.player].name) {
      return this.engine.players[this.command.player].name;
    }
    return "Player " + (this.command.player + 1);
  }

  get playerSlug(): string {
    return this.$store.state.data.players[this.command.player].faction || `p${this.command.player + 1}`;
  }

  get init() {
    return (!this.command && this.engine.moveHistory.length === 0) || this.command.name === Command.Init;
  }

  get commandName() {
    return this.command ? this.command.name : null;
  }

  get chooseFaction() {
    return this.commandName === Command.ChooseFaction;
  }

  get titles() {
    return this.commandTitles.length === 0 ? ["Your turn"] : this.commandTitles;
  }

  factionName(faction: Faction) {
    return factionName(faction);
  }

  factionPlanet(faction: Faction) {
    return factionPlanet(faction);
  }

  updateRandomFaction() {
    this.updater += 1;
  }

  handleCommand(command: string, source: MoveButton, final: boolean) {
    console.log("handle command", command);

    // Some users seem to have a bug with repeating commands on mobile, like clicking the income button twice
    if (
      this.commandChain.length > 0 &&
      this.commandChain.slice(-1).pop() === command &&
      (command === "income" || command === "booster")
    ) {
      console.log("repeating command, ignoring");
      return;
    }

    if (source.button.buttons && source.button.buttons.length > 0 && !final) {
      this.commandTitles.push(source.button.label);
      this.commandChain.push(source.button.command);
      this.buttonChain.push(source.button);
      this.customButtons = source.button.buttons;

      // Seems to cause problems on mobile
      // setTimeout(() => {
      //   if ($(".move-button.shown").length <= 1)  {
      //     const ref = $(".move-button.shown").attr("data-ref");
      //     (this.$refs[ref][0] as MoveButton).handleClick();
      //   }
      // });

      return;
    }
    if (this.init) {
      this.$emit("command", command);
    } else {
      this.$emit("command", `${this.playerSlug} ${[...this.commandChain, command].join(" ")}`);
    }
  }

  undo() {
    this.$emit("undo");
  }

  title(title: string) {
    this.commandTitles.push(title);
  }

  get context(): GameContext {
    return this.$store.state.context;
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get map(): SpaceMap {
    return this.engine.map;
  }

  get buttons(): ButtonData[] {
    const ret: ButtonData[] = [];
    for (const command of this.availableCommands) {
      switch (command.name) {
        case Command.RotateSectors: {
          ret.push({
            label: "Rotate sectors",
            command: Command.RotateSectors,
            hexes: new Map<GaiaHex, {}>(
              this.map.configuration().centers.map((center) => [this.engine.map.grid.get(center), {}] as const)
            ),
            rotation: true,
          });
          break;
        }
        case Command.Build: {
          for (const building of Building.values(Expansion.None)) {
            const coordinates = command.data.buildings.filter((bld) => bld.building === building);
            if (coordinates.length > 0) {
              let label = `Build a ${buildingName(building)}`;
              if (coordinates[0].upgrade) {
                label = `Upgrade to ${buildingName(building)}`;
              } else if (coordinates[0].downgrade) {
                label = `Downgrade to ${buildingName(building)}`;
              } else if (
                coordinates[0].cost === "~" ||
                building === Building.SpaceStation ||
                building === Building.GaiaFormer
              ) {
                label = `Place a ${buildingName(building)}`;
              }
              ret.push({
                label,
                command: `${Command.Build} ${building}`,
                hexes: new Map<GaiaHex, { cost?: string }>(
                  coordinates.map((coord) => [this.engine.map.getS(coord.coordinates), coord])
                ),
              });
            }
          }
          break;
        }
        case Command.PISwap: {
          ret.push({
            label: "Swap Planetary Institute",
            command: command.name,
            hexes: new Map(command.data.buildings.map((coord) => [this.engine.map.getS(coord.coordinates), coord])),
          });
          break;
        }
        case Command.PlaceLostPlanet: {
          ret.push({
            label: "Place Lost Planet",
            command: command.name,
            hexes: new Map(command.data.spaces.map((coord) => [this.engine.map.getS(coord.coordinates), coord])),
          });
          break;
        }
        case Command.Pass:
        case Command.ChooseRoundBooster: {
          const buttons: ButtonData[] = [];
          Booster.values(Expansion.All).forEach((booster, i) => {
            if (command.data.boosters.includes(booster)) {
              buttons.push({
                command: booster,
                label: `Booster ${i + 1}`,
                booster,
                needConfirm: true,
                tooltip: boosterEvents(booster).map((e) => eventDesc(e)).join("\n"),
              });
            }
          });
          // need a Pass confirmation if it's the last round, where Command = PAss but no Boosters
          if (command.data.boosters.length === 0) {
            ret.push({
              label: "Pass",
              command: Command.Pass,
              needConfirm: true,
              buttons: [
                {
                  command: "",
                  label: `Confirm Pass`,
                },
              ],
            });
          } else {
            ret.push({
              label: command.name === Command.Pass ? "Pass" : "Pick booster",
              command: command.name,
              buttons,
              boosters: command.data.boosters,
            });
          }
          break;
        }
        case Command.UpgradeResearch: {
          if (command.data.tracks.length === 1) {
            ret.push({
              label: "Advance " + command.data.tracks[0].field,
              command: `${Command.UpgradeResearch} ${command.data.tracks[0].field}`,
            });
          } else {
            ret.push({
              label: "Advance research",
              command: command.name,
              // track.to contains actual level, to use when implementing research viewer
              buttons: command.data.tracks.map((track) => ({ command: track.field })),
              researchTiles: command.data.tracks.map((track) => track.field + "-" + track.to),
            });
          }
          break;
        }
        case Command.ChooseTechTile:
        case Command.ChooseCoverTechTile: {
          ret.push({
            label: command.name === Command.ChooseCoverTechTile ? "Pick tech tile to cover" : "Pick tech tile",
            command: command.name,
            techs: command.data.tiles.map((tile) => tile.pos),
            buttons: command.data.tiles.map((tile) => ({ command: tile.pos })),
          });
          break;
        }
        case Command.ChargePower: {
          for (const offer of command.data.offers) {
            const leech = offer.offer;
            const action = leech.includes("pw") ? "Charge" : "Gain";
            ret.push({
              label: offer.cost && offer.cost !== "~" ? `${action} ${leech} for ${offer.cost}` : `${action} ${leech}`,
              command: `${Command.ChargePower} ${leech}`,
            });
          }
          break;
        }
        case Command.Decline: {
          ret.push({
            label: `Decline ${command.data.offers[0].offer}`,
            command: `${Command.Decline} ${command.data.offers[0].offer}`,
          });
          break;
        }
        case Command.BrainStone: {
          ret.push(
            ...command.data.choices.sort().map(({ area }) => ({
              label: `Brainstone ${area}`,
              command: `${command.name} ${area}`,
            }))
          );
          break;
        }
        case Command.Spend: {
          ret.push({
            label: "Free action",
            command: Command.Spend,
            buttons: command.data.acts.map((act) => ({
              label: `Spend ${act.cost} to gain ${act.income}`,
              command: `${act.cost} for ${act.income}`,
              times: act.range,
            })),
          });
          break;
        }
        case Command.Action: {
          ret.push({
            label: "Power/Q.I.C Action",
            command: Command.Action,
            actions: command.data.poweracts.map((act) => act.name),
            buttons: command.data.poweracts.map((act) => ({
              command: act.name,
              label: `Spend ${act.cost} for ${act.income.join(" / ")}`,
            })),
          });
          break;
        }
        case Command.Special: {
          ret.push({
            label: "Special Action",
            command: Command.Special,
            actions: command.data.specialacts.map((act) => act.income),
            buttons: command.data.specialacts.map((act) => ({ command: act.income })),
          });
          break;
        }
        case Command.BurnPower: {
          ret.push({
            label: "Burn power",
            command: Command.BurnPower,
            buttons: command.data.map((val) => ({ command: val })),
          });
          break;
        }
        case Command.EndTurn: {
          ret.push({
            label: "End Turn",
            command: Command.EndTurn,
            needConfirm: true,
            buttons: [
              {
                command: Command.EndTurn,
                label: `Confirm End Turn`,
              },
            ],
          });
          break;
        }
        case Command.ChooseIncome: {
          ret.push(
            ...command.data.map((income) => ({
              label: `Income ${income}`,
              command: `${Command.ChooseIncome} ${income}`,
            }))
          );
          break;
        }
        case Command.Bid: {
          ret.push(
            ...command.data.bids.map((pos) => ({
              label: `Bid ${pos.bid[0]} for ${pos.faction}`,
              command: `${Command.Bid} ${pos.faction} $times`,
              times: pos.bid,
            }))
          );
          break;
        }
        case Command.FormFederation: {
          const tilesButtons = command.data.tiles.map((fed, i) => ({
            command: fed,
            label: `Federation ${i + 1}: ${federationRewards(fed).join(",")}`,
          }));
          const locationButtons: ButtonData[] = command.data.federations.map((fed, i) => ({
            command: fed.hexes,
            label: `Location ${i + 1}`,
            hexes: new Map(
              fed.hexes.split(",").map((coord) => [this.engine.map.getS(coord), { coordinates: coord }])
            ) as HighlightHexData,
            hover: true,
            buttons: tilesButtons,
          }));
          locationButtons.push({
            label: "Custom location",
            selectHexes: true,
            buttons: tilesButtons,
          });
          ret.push({
            label: "Form federation",
            command: Command.FormFederation,
            buttons: locationButtons,
          });
          break;
        }
        case Command.ChooseFederationTile: {
          const tilesButtons = command.data.tiles.map((fed, i) => ({
            command: fed,
            label: `Federation ${i + 1}: ${federationRewards(fed).join(",")}`,
          }));
          ret.push({
            label: "Rescore federation",
            command: Command.ChooseFederationTile,
            buttons: tilesButtons,
          });
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

  back() {
    this.$store.commit("clearContext");
    this.commandChain.pop();
    this.commandTitles.pop();
    this.buttonChain.pop();

    if (this.buttonChain.length > 0) {
      const [last] = this.buttonChain.slice(-1);
      this.customButtons = last.buttons;

      for (const button of last.buttons) {
        button.hide = false;
      }
    } else {
      this.customButtons = [];
    }
  }

  private commandTitles: string[] = [];
  private customButtons: ButtonData[] = [];
  private commandChain: Array<string | number> = [];
  private buttonChain: ButtonData[] = [];
}
</script>

<style lang="scss">
@import "../stylesheets/planets.scss";

i.planet {
  &::before {
    content: "\25cf";

    .player-info &,
    .faction-desc & {
      font-size: 25px;
    }
  }

  // terra
  &.r {
    color: $terra;
  }
  // desert
  &.d {
    color: $desert;
  }
  // swamp
  &.s {
    color: $swamp;
  }
  // oxide
  &.o {
    color: $oxide;
  }
  // titanium
  &.t {
    color: $titanium;
  }
  // ice
  &.i {
    color: $ice;
  }
  // volcanic
  &.v {
    color: $volcanic;
  }
  // gaia
  &.g {
    color: $gaia;
  }
  // transdim
  &.m {
    color: $transdim;
  }
  // lost planet
  &.l {
    color: $lost;
  }

  filter: drop-shadow(0px 0px 1px black);
  .player-info & {
    filter: drop-shadow(0px 0px 1px black);

    &.r,
    &.d,
    &.i {
      filter: drop-shadow(0px 0px 1px black);
    }
  }
}
</style>
