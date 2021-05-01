<template>
  <div id="move">
    <b-alert v-for="(w, i) in warnings" :key="i" show variant="warning">
      <a href="#" class="alert-link">{{ w }}</a>
    </b-alert>
    <div id="move-title">
      <h5>
        <span v-if="init">Pick the number of players</span>
        <span v-else>
          {{ [playerName, ...titles].join(" - ") }}
          <a href="#" v-if="commandChain.length > 0" class="smaller small" @click.prevent="back()">(back)</a>
          <a href="#" v-else-if="canUndo" class="smaller small" @click.prevent="undo()">(undo)</a>
          <span class="smaller small">{{ this.currentTurnLog() }}</span>
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
      <div v-else class="d-flex flex-wrap align-content-stretch">
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
      <div v-if="isChoosingFaction">
        <MoveButton
          v-for="faction in factionsToChoose.data"
          :button="{
            command: `${factionsToChoose.name} ${faction}`,
            modal: modalDialog(tooltip(faction)),
            title: factions[faction].name,
            label: `${factions[faction].name} <i class='planet ${factions[faction].planet}'></i>`,
            shortcuts: [factionShortcut(faction)],
          }"
          @trigger="handleCommand"
          :key="faction"
        />
        <MoveButton
          v-if="!gameData.randomFactions"
          :button="randomFactionButton"
          @cancel="updateRandomFaction"
          @trigger="handleCommand"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, {
  AvailableCommand,
  BrainstoneArea,
  BuildWarning,
  Command,
  Faction,
  factions,
  GaiaHex,
  Resource,
  Reward,
  SpaceMap,
  SubPhase,
  tiles,
} from "@gaia-project/engine";
import MoveButton from "./MoveButton.vue";
import { ButtonData, GameContext, ModalButtonData } from "../data";
import { factionDesc, factionShortcut } from "../data/factions";
import { FactionCustomization } from "@gaia-project/engine/src/engine";
import { factionVariantBoard } from "@gaia-project/engine/src/faction-boards";
import { buildWarnings } from "../data/warnings";
import {
  advanceResearchWarning,
  buildButtons,
  buttonWarning,
  chargeWarning,
  endTurnWarning,
  finalizeShortcuts,
  freeActionButton,
  freeAndBurnButton,
  hexMap,
  passButtons,
  specialActionWarning
} from "../logic/commands";
import { researchNames } from "../data/research";
import { max, range } from "lodash";

let show = false;

@Component<Commands>({
  watch: {
    availableCommands(this: Commands, val) {
      this.loadCommands(val);
    },
  },
  methods: {
    tooltip(faction: Faction) {
      return factionDesc(faction, factionVariantBoard(this.factionCustomization, faction));
    },

    modalDialog(msg: string): ModalButtonData {
      return {
        content: msg,
        show(s: boolean) {
          show = s;
        },
        canActivate() {
          return !show;
        }
      };
    }
  },
  computed: {
    canUndo() {
      return !this.$store.state.gaiaViewer.data.newTurn;
    },
    randomFactionButton() {
      this.updater = this.updater + 1;
      const command = this.factionsToChoose;
      const faction = command.data[Math.floor(Math.random() * command.data.length)];

      return {
        command: `${command.name} ${faction}`,
        label: "Random",
        shortcuts: ["r"],
        modal: this.modalDialog(this.tooltip(faction)),
        title: factions[faction].name,
      };
    },
  },
  components: {
    MoveButton,
  },
})
export default class Commands extends Vue {
  @Prop()
  currentMove?: string;

  @Prop()
  currentMoveWarnings?: BuildWarning[];

  @Prop({ default: "" })
  remainingTime: string;

  updater = 0;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get factionCustomization(): FactionCustomization {
    return this.gameData.factionCustomization;
  }

  currentTurnLog(): string {
    if (this.currentMove == null) {
      return "";
    }
    return this.currentMove.substring(this.currentMove.indexOf(" ")) + this.currentTurnChanges();
  }

  private currentTurnChanges(): string {
    const logEntries = this.gameData.advancedLog;
    const entry = logEntries[logEntries.length - 1];
    if (entry != null && entry.changes != null && entry.move != null) {
      if (this.gameData.moveHistory[entry.move] == null) {
        const values = Object.values(entry.changes).flatMap((e) =>
          Object.keys(e).map((k) => new Reward(e[k], k as Resource))
        );
        return ` (${Reward.merge(values).toString()})`;
      }
    }
    return "";
  }

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

  get factionsToChoose(): AvailableCommand {
    return this.availableCommands.find((c) => c.name === Command.ChooseFaction) ?? null;
  }

  get playerName(): string {
    if (this.player.faction) {
      return factions[this.player.faction].name;
    }
    if (this.player.name) {
      return this.player.name;
    }
    return "Player " + (this.command.player + 1);
  }

  get player() {
    return this.engine.players[this.command.player];
  }

  get playerSlug(): string {
    return this.$store.state.gaiaViewer.data.players[this.command.player].faction || `p${this.command.player + 1}`;
  }

  get init() {
    return (!this.command && this.engine.moveHistory.length === 0) || this.command?.name === Command.Init;
  }

  get commandName() {
    return this.command?.name;
  }

  get isChoosingFaction() {
    return !!this.factionsToChoose;
  }

  get titles() {
    return this.commandTitles.length === 0 ? ["Your turn"] : this.commandTitles;
  }

  get warnings(): string[] {
    return this.currentMoveWarnings?.map(w => buildWarnings[w].text) ?? [];
  }

  get factions() {
    return factions;
  }

  factionShortcut(faction: Faction) {
    return factionShortcut(faction);
  }

  updateRandomFaction() {
    this.updater += 1;
  }

  handleCommand(command: string, source: MoveButton, final: boolean, warnings?: BuildWarning[]) {
    const button = source.button;
    this.handleButton(command, button, final, warnings);
  }

  private handleButton(command: string, button: ButtonData, final: boolean, warnings: BuildWarning[]) {
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

    if (button.buttons?.length > 0 && !final) {
      this.commandTitles.push(button.label);
      this.commandChain.push(button.command);
      this.buttonChain.push(button);
      this.customButtons = button.buttons;
      if (button.sticky) {
        console.log("set sticky to " + button.sticky.open);
        this.stickyButton = button.sticky.open ? button.label : null;
      }

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
      this.$emit("command", `${this.playerSlug} ${[...this.commandChain, command].join(" ")}`, warnings);
    }
  }

  undo() {
    this.$emit("undo");
  }

  title(title: string) {
    this.commandTitles.push(title);
  }

  get context(): GameContext {
    return this.$store.state.gaiaViewer.context;
  }

  get engine(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get map(): SpaceMap {
    return this.engine.map;
  }

  get buttons(): ButtonData[] {
    const freeAndBurn: ButtonData[] = [];
    const ret: ButtonData[] = [];
    for (const command of this.availableCommands.filter((c) => c.name != Command.ChooseFaction)) {
      switch (command.name) {
        case Command.RotateSectors: {
          ret.push({
            label: "Rotate sectors",
            command: Command.RotateSectors,
            shortcuts: ["r"],
            hexes: new Map<GaiaHex, {}>(
              this.map.configuration().centers.map((center) => [this.engine.map.grid.get(center), {}] as [GaiaHex, {}])
            ),
            rotation: true,
          });

          break;
        }
        case Command.Build: {
          ret.push(...buildButtons(this.engine, command));
          break;
        }

        case Command.PISwap: {
          ret.push({
            label: "Swap Planetary Institute",
            shortcuts: ["w"],
            command: command.name,
            hexes: hexMap(this.engine, command.data.buildings),
          });
          break;
        }

        case Command.PlaceLostPlanet: {
          ret.push({
            label: "Place Lost Planet",
            command: command.name,
            hexes: hexMap(this.engine, command.data.spaces),
          });
          break;
        }

        case Command.Pass:
        case Command.ChooseRoundBooster: {
          ret.push(...passButtons(this.engine, this.player, command));
          break;
        }

        case Command.UpgradeResearch: {
          if (command.data.tracks.length === 1) {
            ret.push({
              label: "Research " + researchNames[command.data.tracks[0].field],
              shortcuts: ["r"],
              command: `${Command.UpgradeResearch} ${command.data.tracks[0].field}`,
              warning: advanceResearchWarning(this.player, command.data.tracks[0].field)
            });
          } else {
            ret.push({
              label: "Research",
              shortcuts: ["r"],
              command: command.name,
              // track.to contains actual level, to use when implementing research viewer
              buttons: command.data.tracks.map((track) => ({
                command: track.field,
                label: researchNames[track.field],
                shortcuts: [track.field.substring(0, 1)],
                warning: advanceResearchWarning(this.player, track.field)
              })),
              researchTiles: command.data.tracks.map((track) => track.field + "-" + track.to),
            });
          }
          break;
        }

        case Command.ChooseTechTile:
        case Command.ChooseCoverTechTile: {
          ret.push({
            label: command.name === Command.ChooseCoverTechTile ? "Pick tech tile to cover" : "Pick tech tile",
            shortcuts: ["p"],
            command: command.name,
            techs: command.data.tiles.map((tile) => tile.pos),
            buttons: command.data.tiles.map((tile) => ({ command: tile.pos, tech: tile.pos })),
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
              warning: chargeWarning(this.engine, this.player, leech)
            });
          }

          break;
        }

        case Command.Decline: {
          if (command.data.offers) {
            ret.push({
              label: `Decline ${command.data.offers[0].offer}`,
              shortcuts: ["d"],
              command: `${Command.Decline} ${command.data.offers[0].offer}`,
              warning: buttonWarning(command.data.offers[0].offer === "tech" ?
                "Are you sure you want to decline a tech tile?" : undefined),
            });
          } else {
            // LEGACY CODE
            // TODO: Remove when games are updated
            ret.push({
              label: `Decline ${command.data.offer}`,
              command: `${Command.Decline} ${command.data.offer}`,
            });
          }
          break;
        }

        case Command.BrainStone: {
          ret.push(
            ...command.data.sort().map((area) => ({
              label: `Brainstone ${area}`,
              command: `${command.name} ${area}`,
              shortcuts: [area == BrainstoneArea.Gaia ? "g" : area.substring("area".length, area.length)]
            }))
          );
          break;
        }

        case Command.Spend: {
          freeAndBurn.push(...freeActionButton(command.data));
          break;
        }
        case Command.BurnPower: {
          freeAndBurn.push({
            label: "Burn Power",
            shortcuts: ["b"],
            command: `${Command.BurnPower} 1`,
            conversion: {
              from: [new Reward(2, Resource.BowlToken)],
              to: [
                new Reward(1, Resource.BurnToken),
                new Reward(1, Resource.ChargePower)
              ]
            },
            times: range(1, max(command.data as number[]) + 1),
          });
          break;
        }

        case Command.Action: {
          ret.push({
            label: "Power/Q.I.C Action",
            shortcuts: ["q"],
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
            shortcuts: ["s"],
            command: Command.Special,
            actions: command.data.specialacts.map((act) => act.income),
            buttons: command.data.specialacts.map((act) => ({
              command: act.income,
              warning: specialActionWarning(this.player, act.income)
            })),
          });
          break;
        }

        case Command.EndTurn: {
          ret.push({
            label: "End Turn",
            shortcuts: ["e"],
            command: Command.EndTurn,
            needConfirm: true,
            buttons: [
              {
                command: Command.EndTurn,
                label: `Confirm End Turn`,
              },
            ],
            warning: endTurnWarning(this.engine, command)
          });
          break;
        }

        case Command.DeadEnd:
          let reason = "";
          switch (command.data as SubPhase) {
            case SubPhase.ChooseTechTile:
              reason = "No tech tile left";
              break;
            case SubPhase.BuildMineOrGaiaFormer:
              reason = "Cannot build mine or gaia former";
              break;
            case SubPhase.BuildMine:
              reason = "Cannot build mine";
              break;
            case SubPhase.PISwap:
              reason = "Cannot swap planetary institute";
              break;
            case SubPhase.DowngradeLab:
              reason = "Cannot downgrade lab";
              break;
            case SubPhase.UpgradeResearch:
              reason = "Cannot upgrade research";
              break;
          }
          ret.push({
            command: Command.DeadEnd,
            label: reason,
            warning: {
              title: "Dead end reached",
              body: [
                "You've reached a required move that is not possible to execute."
              ],
              okButton: {
                label: "Undo",
                action: () => {
                  this.undo();
                }
              }
            }
          });
          break;

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

        case Command.PickReward: {
          ret.push(
            ...command.data.rewards.map((reward) => ({
              label: `Gain ${reward}`,
              command: `${Command.PickReward} ${reward}`,
            }))
          );
          break;
        }

        case Command.FormFederation: {
          const tilesButtons: ButtonData[] = command.data.tiles.map((fed, i) => ({
            command: fed,
            label: `Federation ${i + 1}: ${tiles.federations[fed]}`,
          } as ButtonData));

          const locationButtons: ButtonData[] = command.data.federations.map((fed, i) => ({
            command: fed.hexes,
            label: `Location ${i + 1}`,
            hexes: new Map(fed.hexes.split(",").map((coord) => [this.engine.map.getS(coord), { coordinates: coord }])),
            hover: true,
            buttons: tilesButtons,
            warning: buttonWarning(fed.warning != null ? buildWarnings[fed.warning].text : null)
          } as ButtonData));

          locationButtons.push({
            label: "Custom location",
            selectHexes: true,
            buttons: tilesButtons,
          });

          ret.push({
            label: "Form federation",
            shortcuts: ["f"],
            command: Command.FormFederation,
            buttons: locationButtons,
          });
          break;
        }

        case Command.ChooseFederationTile: {
          const tilesButtons = command.data.tiles.map((fed, i) => ({
            command: fed,
            label: `Federation ${i + 1}: ${tiles.federations[fed]}`,
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

    if (freeAndBurn.length > 0) {
      const pass = ret.pop();
      ret.push(freeAndBurnButton(freeAndBurn));
      ret.push(pass);
    }

    if (this.customButtons.length > 0) {
      for (const button of ret) {
        button.hide = true;
      }

      ret.push(...this.customButtons);
    }
    finalizeShortcuts(ret);

    if (this.stickyButton) {
      console.log("sticky found: " + this.stickyButton);
      const sticky = ret.find(b => b.label == this.stickyButton);
      this.handleButton(null, sticky, false, null);
    }

    return ret;
  }

  back() {
    this.$store.commit("gaiaViewer/clearContext");
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

  destroyed() {
    window.removeEventListener("keydown", this.keyListener);
  }

  mounted() {
    this.keyListener = (e) => {
      // console.log(e.key);
      if (e.key == "Escape") {
        if (this.commandChain.length > 0) {
          this.back();
        } else if (!this.$store.state.gaiaViewer.data.newTurn) {
          this.undo();
        }
      }
    };
    window.addEventListener("keydown", this.keyListener);
  }

  private keyListener = null;

  private commandTitles: string[] = [];
  private customButtons: ButtonData[] = [];
  private commandChain: string[] = [];
  private buttonChain: ButtonData[] = [];
  private stickyButton: string | null;
}
</script>

<style lang="scss">
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
    color: var(--terra);
  }

  // desert
  &.d {
    color: var(--desert);
  }

  // swamp
  &.s {
    color: var(--swamp);
  }

  // oxide
  &.o {
    color: var(--oxide);
  }

  // titanium
  &.t {
    color: var(--titanium);
  }

  // ice
  &.i {
    color: var(--ice);
  }

  // volcanic
  &.v {
    color: var(--volcanic);
  }

  // gaia
  &.g {
    color: var(--gaia);
  }

  // transdim
  &.m {
    color: var(--transdim);
  }

  // lost planet
  &.l {
    color: var(--lost);
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
