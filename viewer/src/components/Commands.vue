<template>
  <div id="move">
    <b-alert v-for="(w, i) in warnings" :key="i" show variant="warning">
      <a href="#" class="alert-link">{{ w }}</a>
    </b-alert>
    <div id="move-title">
      <h5>
        <span v-if="init">Pick the number of players</span>
        <span v-else>
          <span v-html="[playerName, ...titles].join(' - ')" />
          <span class="smaller small">{{ currentTurnLog }}</span>
          <Undo v-if="canUndo" />
        </span>
      </h5>
    </div>
    <div id="move-buttons">
      <div v-if="init" class="d-flex flex-wrap align-content-stretch">
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
      <div v-if="isChoosingFaction" class="d-flex flex-wrap align-content-stretch">
        <MoveButton
          v-for="faction in factionsToChoose.data"
          :button="{
            command: `${factionsToChoose.name} ${faction}`,
            modal: modalDialog(tooltip(faction)),
            title: factionName(faction),
            label: `${factionName(faction)} <i class='planet ${factionPlanet(faction)}'></i>`,
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
  BuildWarning,
  Command,
  Faction,
  factionPlanet,
  GaiaHex,
  Player,
  Resource,
  Reward,
  SpaceMap,
} from "@gaia-project/engine";
import MoveButton from "./MoveButton.vue";
import { ButtonData, GameContext, ModalButtonData } from "../data";
import { factionDesc, factionName, factionShortcut } from "../data/factions";
import { FactionCustomization } from "@gaia-project/engine/src/engine";
import { factionVariantBoard } from "@gaia-project/engine/src/faction-boards";
import { moveWarnings } from "../data/warnings";
import {
  AvailableConversions,
  boardActionsButton,
  brainstoneButtons,
  buildButtons,
  chargePowerButtons,
  deadEndButton,
  declineButton,
  endTurnButton,
  fastConversionClick,
  federationButton,
  federationTypeButtons,
  finalizeShortcuts,
  freeAndBurnButton,
  hexMap,
  passButtons,
  researchButtons,
  specialActionsButton,
  UndoPropagation,
} from "../logic/commands";
import Undo from "./Resources/Undo.vue";

let show = false;

@Component<Commands>({
  watch: {
    availableCommands(this: Commands, val) {
      if (val) {
        this.loadCommands(val);
      }
    },
  },
  methods: {
    tooltip(faction: Faction) {
      return factionDesc(faction, factionVariantBoard(this.factionCustomization, faction)?.board);
    },

    modalDialog(msg: string): ModalButtonData {
      return {
        content: msg,
        show(s: boolean) {
          show = s;
        },
        canActivate() {
          return !show;
        },
      };
    },
  },
  computed: {
    randomFactionButton() {
      this.updater = this.updater + 1;
      const command = this.factionsToChoose;
      const faction = command.data[Math.floor(Math.random() * command.data.length)];

      return {
        command: `${command.name} ${faction}`,
        label: "Random",
        shortcuts: ["r"],
        modal: this.modalDialog(this.tooltip(faction)),
        title: factionName(faction),
      };
    },
  },
  components: {
    MoveButton,
    Undo,
  },
})
export default class Commands extends Vue {
  @Prop()
  currentMove?: string;

  @Prop()
  currentMoveWarnings?: BuildWarning[];

  @Prop({ default: "" })
  remainingTime: string;

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get factionCustomization(): FactionCustomization {
    return this.gameData.factionCustomization;
  }

  get currentTurnLog(): string {
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
    this.$store.commit("gaiaViewer/setCommandChain", false);

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
    return this.availableCommands?.find((c) => c.name === Command.ChooseFaction) ?? null;
  }

  get playerName(): string {
    const pl = this.player;
    if (!pl) {
      return "?";
    }
    if (pl.faction) {
      return factionName(pl.faction);
    }
    if (pl.name) {
      return pl.name;
    }
    return "Player " + (this.command.player + 1);
  }

  get player(): Player {
    return this.engine.players[this.command?.player];
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
    return this.currentMoveWarnings?.map((w) => moveWarnings[w].text) ?? [];
  }

  factionName(faction: Faction) {
    return factionName(faction);
  }

  factionPlanet(faction: Faction) {
    return factionPlanet(faction);
  }

  factionShortcut(faction: Faction) {
    return factionShortcut(faction);
  }

  updateRandomFaction() {
    this.updater += 1;
  }

  handleCommand(command: string, source?: ButtonData, warnings?: BuildWarning[]) {
    console.log("handle command", command);
    this.unsubscribe();

    // Some users seem to have a bug with repeating commands on mobile, like clicking the income button twice
    if (
      this.commandChain.length > 0 &&
      this.commandChain.slice(-1).pop() === command &&
      (command === "income" || command === "booster")
    ) {
      console.log("repeating command, ignoring");
      return;
    }

    if (source?.buttons?.length > 0) {
      this.commandTitles.push(source.label);
      this.commandChain.push(source.command);
      this.buttonChain.push(source);
      this.customButtons = source.buttons;
      this.$store.commit("gaiaViewer/setCommandChain", true);

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
    const commands = this.availableCommands;
    if (!commands) {
      return [];
    }

    const conversions: AvailableConversions = {};
    const ret: ButtonData[] = [];

    for (const command of commands.filter((c) => c.name != Command.ChooseFaction)) {
      switch (command.name) {
        case Command.RotateSectors: {
          ret.push({
            label: "Rotate sectors",
            command: Command.RotateSectors,
            shortcuts: ["r"],
            hexes: {
              light: true,
              selectAnyHex: true,
              hexes: new Map<GaiaHex, {}>(
                this.map.configuration().centers.map((center) => [this.engine.map.grid.get(center), {}] as [GaiaHex, {}])),
            },
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
            hexes: hexMap(this.engine, command.data.buildings, false),
          });
          break;
        }

        case Command.PlaceLostPlanet: {
          ret.push({
            label: "Place Lost Planet",
            command: command.name,
            hexes: hexMap(this.engine, command.data.spaces, true),
          });
          break;
        }

        case Command.Pass:
        case Command.ChooseRoundBooster: {
          ret.push(...passButtons(this.engine, this.player, command));
          break;
        }

        case Command.UpgradeResearch: {
          ret.push(...researchButtons(command, this.player));
          break;
        }

        case Command.ChooseTechTile: {
          ret.push({
            label: "Pick tech tile",
            shortcuts: ["p"],
            command: command.name,
            techs: command.data.tiles.map((tile) => tile.pos),
            buttons: command.data.tiles.map((tile) => ({ command: tile.pos, tech: tile.pos })),
          });
          break;
        }
        case Command.ChooseCoverTechTile: {
          ret.push({
            label: "Pick tech tile to cover",
            shortcuts: ["p"],
            command: command.name,
            techs: command.data.tiles.map((tile) => tile.pos),
            buttons: command.data.tiles.map((tile) => ({ command: tile.pos, tech: tile.pos })),
          });
          break;
        }

        case Command.ChargePower: {
          ret.push(...chargePowerButtons(command, this.engine, this.player));
          break;
        }

        case Command.Decline: {
          ret.push(declineButton(command));
          break;
        }

        case Command.BrainStone: {
          ret.push(...brainstoneButtons(command.data));
          break;
        }
        case Command.Spend: {
          conversions.free = command.data;
          break;
        }
        case Command.BurnPower: {
          conversions.burn = command.data;
          break;
        }
        case Command.Action: {
          ret.push(boardActionsButton(command.data, this.player));
          break;
        }

        case Command.Special: {
          ret.push(specialActionsButton(command, this.player));
          break;
        }

        case Command.EndTurn: {
          ret.push(endTurnButton(command, this.engine));
          break;
        }

        case Command.DeadEnd:
          ret.push(deadEndButton(command, this.undo));
          break;

        case Command.ChooseIncome: {
          ret.push(
            ...command.data.map((income) => ({
              label: `Income ${income}`,
              command: `${Command.ChooseIncome} ${income}`,
            })),
          );
          break;
        }

        case Command.Bid: {
          ret.push(
            ...command.data.bids.map((pos) => ({
              label: `Bid ${pos.bid[0]} for ${pos.faction}`,
              command: `${Command.Bid} ${pos.faction} $times`,
              times: pos.bid,
            })),
          );
          break;
        }

        case Command.FormFederation: {
          ret.push(federationButton(command, this.engine, this.$store, this.handleCommand, this.player));
          break;
        }

        case Command.ChooseFederationTile: {
          ret.push({
            label: "Rescore federation",
            command: Command.ChooseFederationTile,
            buttons: federationTypeButtons(command.data.tiles, this.player),
          });
          break;
        }
      }
    }

    if (conversions.free || conversions.burn) {
      this.subscriptions[Command.Spend]?.();
      this.subscriptions[Command.Spend] = this.$store.subscribeAction(({ type, payload }) => {
        if (type === "gaiaViewer/fastConversionClick") {
          const command = fastConversionClick(payload, conversions, this.player);
          if (command) {
            this.handleCommand(command);
          }
        }
      });

      const pass = ret.pop();
      const d = freeAndBurnButton(conversions, this.player);
      ret.push(d.button);
      if (pass) {
        ret.push(pass);
      }

      this.$store.commit("gaiaViewer/fastConversionTooltips", d.tooltips);
      // tooltips may have become unavailable - and they should be hidden
      this.$root.$emit("bv::hide::tooltip");
    }

    if (this.customButtons.length > 0) {
      for (const button of ret) {
        button.hide = true;
      }

      ret.push(...this.customButtons);
    }

    finalizeShortcuts(ret);
    return ret;
  }

  get canUndo() {
    return this.$store.getters["gaiaViewer/canUndo"];
  }

  undo() {
    this.$store.dispatch("gaiaViewer/undo", { undoPerformed: false } as UndoPropagation);
  }

  back(p: UndoPropagation) {
    if (this.commandChain.length == 0) {
      // was a command undo
      return;
    }
    p.undoPerformed = true;

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
      this.$store.commit("gaiaViewer/setCommandChain", false);
    }
  }

  destroyed() {
    this.unsubscribe();
  }

  private unsubscribe() {
    for (const s of Object.values(this.subscriptions)) {
      s();
    }
    this.subscriptions = {};
  }

  mounted() {
    const keyListener = (e) => {
      if (e.key == "Escape" && this.canUndo) {
        this.undo();
      }
    };
    window.addEventListener("keydown", keyListener);

    const undoListener = this.$store.subscribeAction(({ type, payload }) => {
      if (type === "gaiaViewer/undo") {
        this.back(payload as UndoPropagation);
      }
    });

    this.$on("hook:beforeDestroy", () => {
      window.removeEventListener("keydown", keyListener);
      undoListener();
    });
  }

  private updater = 0;
  private subscriptions: { [key in Command]?: () => void } = {};
  private commandTitles: string[] = [];
  private customButtons: ButtonData[] = [];
  private commandChain: string[] = [];
  private buttonChain: ButtonData[] = [];
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
