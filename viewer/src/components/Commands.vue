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
          :controller="controller"
          :key="i"
        ></MoveButton>
      </div>
      <div v-else class="d-flex flex-wrap align-content-stretch">
        <MoveButton
          v-for="(button, i) in buttons"
          :class="{ 'd-none': button.hide, shown: !button.hide, disabled: button.disabled }"
          :ref="`button-${i}`"
          :data-ref="`button-${i}`"
          :button="button"
          :controller="controller"
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
            modal: modalDialog(factionName(faction), tooltip(faction)),
            label: `${factionName(faction)} <i class='planet ${factionPlanet(faction)}'></i>`,
            shortcuts: [factionShortcut(faction)],
          }"
          :controller="controller"
          :key="faction"
        />
        <MoveButton
          v-if="!gameData.randomFactions"
          :button="randomFactionButton"
          :controller="controller"
          @cancel="updateRandomFaction"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, {
  AdvTechTilePos,
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
  TechTilePos,
} from "@gaia-project/engine";
import MoveButton from "./MoveButton.vue";
import { ButtonData, GameContext, HexSelection, HighlightHex, ModalButtonData, WarningsPreference } from "../data";
import { factionDesc, factionName, factionShortcut } from "../data/factions";
import { FactionCustomization } from "@gaia-project/engine/src/engine";
import { factionVariantBoard } from "@gaia-project/engine/src/faction-boards";
import { moveWarnings } from "../data/warnings";
import Undo from "./Resources/Undo.vue";
import { ActionPayload, SubscribeActionOptions, SubscribeOptions } from "vuex";
import { CommandController, ExecuteBack, FastConversionTooltips } from "../logic/buttons/types";
import { callOnShow } from "../logic/buttons/utils";
import { commandButtons, replaceRepeat } from "../logic/buttons/commands";
import { CubeCoordinates } from "hexagrid";
import { autoClickStrategy } from "../logic/buttons/autoClick";
import engine from "@gaia-project/engine";

let show = false;

export type EmitCommandParams = { disappear?: boolean; times?: number; warnings?: BuildWarning[] };

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
      return factionDesc(faction, factionVariantBoard(this.factionCustomization, faction)?.board, this.engine.expansions);
    },

    modalDialog(title: string, msg: string): ModalButtonData {
      return {
        title: title,
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
        modal: this.modalDialog(factionName(faction), this.tooltip(faction)),
      };
    },
  },
  components: {
    MoveButton,
    Undo,
  },
})
export default class Commands extends Vue implements CommandController {
  @Prop()
  currentMove?: string;

  @Prop()
  currentMoveWarnings?: BuildWarning[];

  @Prop({ default: "" })
  remainingTime: string;

  get controller() {
    return this;
  }

  get gameData(): Engine {
    return this.$store.state.data;
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

  loadCommands(commands: AvailableCommand[]) {
    for (const b of this.allButtons) {
      this.unsubscribe(b);
    }

    this.commandTitles = [];
    this.customButtons = [];
    this.commandChain = [];
    this.buttonChain = [];
    this.$store.commit("setCommandChain", false);

    for (const command of commands) {
      if (command.name === Command.ChooseFaction) {
        this.title("Choose your faction");
        return;
      }
    }
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
    return this.$store.state.data.players[this.command.player].faction || `p${this.command.player + 1}`;
  }

  get init() {
    return (!this.command && this.engine.moveHistory.length === 0) || this.command?.name === Command.Init;
  }

  get isChoosingFaction() {
    return !!this.factionsToChoose;
  }

  get titles() {
    return this.commandTitles.length === 0 ? [`Your turn - Round ${this.engine.round}`] : this.commandTitles;
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

  handleCommand(command: string, source?: ButtonData, warnings?: BuildWarning[], times?: number) {
    console.log("handle command", command);
    this.unsubscribeCommands();

    if (source?.buttons?.length > 0) {
      this.commandTitles.push(replaceRepeat(source.longLabel ?? source.label, times));
      this.commandChain.push(command);
      this.buttonChain.push(source);
      this.addAutoClick(source.autoClick);
      this.customButtons = source.buttons;
      this.$store.commit("setCommandChain", true);

      for (const b of this.customButtons) {
        callOnShow(b);
      }

      return;
    }
    if (this.init) {
      this.$emit("command", command);
    } else {
      //decline ignores what's on the the stack (e.g. 'decline up' instead of 'up decline')
      const commands: string[] = command.startsWith(Command.Decline) ? [command] : [...this.commandChain.filter((c) => c), command];
      this.$emit(
        "command",
        `${this.playerSlug} ${commands.join(" ")}`,
        warnings
      );
    }
  }

  get autoClick(): boolean[][] {
    return this.$store.getters.autoClick;
  }

  setAutoClick(value: boolean[][]) {
    this.$store.commit("setAutoClick", value);
  }

  private addAutoClick(value: boolean) {
    const click = this.autoClick;
    const newMove = click.length == 0 || this.currentMove.split(".").length > click.length;
    if (newMove) {
      click.push([]);
    }
    click[click.length - 1].push(value ?? false);
    this.setAutoClick(click);
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
    const commands = this.availableCommands;
    if (!commands) {
      return [];
    }

    //todo test "always" better, then re-enable
    // const s = autoClickStrategy(this.$store.state.preferences.autoClick, this.preventFirstAutoClick);
    const s = autoClickStrategy("smart", this.preventFirstAutoClick);
    const buttons = commandButtons(commands, this.engine, this.player, this, s);
    if (this.warningPreference === "buttonText") {
      for (const button of buttons) {
        if (button.warning && !button.warningInLabel) {
          const w = button.warning.body.join(", ");
          if (button.longLabel) {
            button.longLabel = `${button.longLabel} (${w})`;
          }
          if (button.label) {
            button.label = `${button.label} (${w})`;
          }
          button.warningInLabel = true;
        }
      }
    }
    this.allButtons = buttons;
    this.preventFirstAutoClick = false;
    return buttons;
  }

  get canUndo() {
    return this.$store.getters.canUndo;
  }

  undo() {
    this.$store.dispatch("undo");
  }

  back(back: ExecuteBack) {
    this.$store.commit("clearContext");

    let redo: ButtonData = null;
    let steps = 0;
    let lastAutoClick = false;

    while (this.buttonChain.length > 0) {
      steps++;
      this.commandChain.pop();
      this.commandTitles.pop();
      const last = this.buttonChain.pop();
      this.unsubscribe(last);

      const click = this.autoClick;
      lastAutoClick = click[click.length - 1].pop();
      this.setAutoClick(click);

      console.log("back", last.command ?? last.label);

      if (!lastAutoClick && steps > 1) {
        redo = last;
        break;
      }
    }

    if (redo != null) {
      back.performed = true;
      this.customButtons = redo.buttons;

      const autoClick = redo.autoClick;
      redo.autoClick = false;
      this.handleButtonClick(redo);
      redo.autoClick = autoClick;
    } else {
      back.performed = steps > 0 && !lastAutoClick;
      this.customButtons = [];
      this.preventFirstAutoClick = true;
      this.$store.commit("setCommandChain", false);
    }
  }

  destroyed() {
    this.unsubscribeCommands();
  }

  private unsubscribeCommands() {
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

    const backListener = this.$store.subscribeAction(({ type, payload }) => {
      if (type === "back") {
        this.back(payload as ExecuteBack);
      }
    });

    this.$on("hook:beforeDestroy", () => {
      window.removeEventListener("keydown", keyListener);
      backListener();
    });
  }

  disableTooltips() {
    this.$root.$emit("bv::hide::tooltip");
  }

  setFastConversionTooltips(tooltips: FastConversionTooltips) {
    this.$store.commit("fastConversionTooltips", tooltips);
  }

  subscribeAction<P extends ActionPayload>(fn: SubscribeActionOptions<P, any>, options?: SubscribeOptions): () => void {
    return this.$store.subscribeAction(fn, options);
  }

  supportsHover(): boolean {
    return window.matchMedia("(hover: hover)").matches;
  }

  highlightResearchTiles(tiles: string[]) {
    this.$store.commit("highlightResearchTiles", tiles);
  }

  highlightTechs(techs: Array<TechTilePos | AdvTechTilePos>) {
    this.$store.commit("highlightTechs", techs);
  }

  subscribe(action: string, button: ButtonData, callback: (payload: any) => any, filter: (payload: any) => boolean = null) {
    action = "" + action;

    this.unsubscribe(button);

    button.subscription = (this.$store as any).subscribeAction(({ type, payload }) => {
      if (type !== action) {
        return;
      }
      if (filter && !filter(payload)) {
        return;
      }

      console.log(type, payload);

      callback(payload);
    });
  }

  activate(buttonData: ButtonData | null) {
    this.$store.commit("activeButton", buttonData);
  }

  subscribeHexClick(button: ButtonData, callback: (hex: GaiaHex, highlight: HighlightHex) => void, filter?: (hex: GaiaHex) => boolean) {
    this.subscribe("hexClick", button, (payload) => {
      callback(payload.hex, payload.highlight);
    }, filter ? payload => filter(payload.hex) : null);
  }

  subscribeFinal(action: string, button: ButtonData) {
    this.subscribe(action, button, (button) => {
      this.handleButtonClick(button);
    });
    this.emitButtonCommand(button, null, { disappear: false });
  }

  unsubscribe(button: ButtonData) {
    button.subscription?.();
    button.subscription = null;
    button.onShowTriggered = false;
    button.buttons?.forEach(b => this.unsubscribe(b));
  }

  async handleButtonClick(button: ButtonData) {
    if (button.handlingClick) {
      console.log("simultaneous button click, ignoring", button);
      return;
    }
    if (button.hide) {
      console.log("click on hidden button, ignoring", button);
      return;
    }
    try {
      button.handlingClick = true;
      const warning = button.warning;
      const activeButton = this.isActiveButton(button);
      if (warning && !activeButton && this.warningPreference === 'modalDialog') {
        try {
          const c = this.$createElement;
          const message = warning.body.length == 1 ? warning.body[0] : warning.body.map((w) => c("ul", [c("li", [w])]));
          const okClicked = await this.$bvModal.msgBoxConfirm(message, {
            title: warning.title,
            headerClass: "warning",
            okTitle: warning.okButton?.label,
          });

          if (okClicked) {
            const action = warning.okButton?.action;
            if (action) {
              action();
              return;
            }
          } else {
            return;
          }
        } catch (err) {
          console.error(err);
          return;
        }
      }

      // Remove highlights caused by another button
      if (!activeButton) {
        if (!button.keepContext) {
          this.clearContext();
        }

        if (button.hexes) {
          this.highlightHexes(button.hexes);
        }
      }

      if (button.specialActions) {
        this.$store.commit("highlightSpecialActions", button.specialActions);
        this.subscribeFinal("specialActionClick", button);
      } else if (button.boardActions) {
        this.$store.commit("highlightBoardActions", button.boardActions);
        this.subscribeFinal("boardActionClick", button);
      } else if (button.onClick) {
        button.onClick(button);
      } else if (button.modal) {
        button.buttonController.setModalShow(true);
        button.modal.show(true);
      } else {
        this.emitButtonCommand(button);
      }
    } finally {
      button.handlingClick = false;
    }
  }

  get warningPreference(): WarningsPreference {
    return this.$store.state.preferences.warnings;
  }

  getRotation() {
    return this.$store.state.context.rotation;
  }

  rotate(hex: GaiaHex) {
    this.$store.commit("rotate", hex);
  }

  clearContext() {
    this.$store.commit("clearContext");
  }

  isActiveButton(button: ButtonData) {
    return this.$store.state.context.activeButton && this.$store.state.context.activeButton.label === button.label;
  }

  getHighlightedHexes(): HexSelection {
    return this.$store.state.context.highlighted.hexes;
  }

  highlightHexes(selection: HexSelection | null) {
    this.$store.commit("highlightHexes", selection);
  }

  highlightSectors(sectors: CubeCoordinates[]) {
    this.$store.commit("highlightSectors", sectors);
  }

  executeCommand(button: ButtonData): void {
    this.emitButtonCommand(button);
  }

  emitButtonCommand(button: ButtonData, append?: string, params?: EmitCommandParams) {
    console.log("emit command", button.command, append, params);
    params = Object.assign({}, { disappear: true, times: 1 }, params);
    const { disappear, times, warnings } = params;

    if (disappear) {
      this.unsubscribe(button);
      this.activate(null);
    }

    let commandBody: string[] = [];

    // Parse numbers, ie the command is executed X times, multiply
    // each number by X instead of repeating the command X times.
    let command = (button.command || "") + "";

    if (times && typeof times === "number") {
      command = replaceRepeat(command, times);
    }

    command = command.replace(/\$times\b/g, "" + (times ?? 0));

    commandBody = [command, append].filter((x) => !!x);

    this.handleCommand(commandBody.join(" "), button, warnings, times);
  }

  get temporaryRange(): number {
    return this.currentMove.includes("range+3") ? 3 : 0;
  }

  private updater = 0;
  public subscriptions: { [key in Command]?: () => void } = {};
  private commandTitles: string[] = [];
  public customButtons: ButtonData[] = [];
  private commandChain: string[] = [];
  private buttonChain: ButtonData[] = [];
  private allButtons: ButtonData[] = [];
  private preventFirstAutoClick = false;
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
