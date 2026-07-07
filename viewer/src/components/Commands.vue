<template>
  <div id="move">
    <div id="move-title" class="d-flex align-items-center" :class="{ 'hide-on-mobile-sticky': showStickyMobileBar }">
      <h5 class="mb-0">
        <span v-if="init">Pick the number of players</span>
        <RichTextView :content="statusLine" />
      </h5>
      <b-btn v-if="showSilentAuctionInfo" v-b-modal.silent-auction-info variant="link" size="sm" class="ml-2 silent-auction-info-button">
        How does the auction work? <b-badge variant="info" pill>i</b-badge>
      </b-btn>
      <SilentAuctionInfo v-if="showSilentAuctionInfo" />
      <!-- "Auto leech": lets the engine's own already-implemented decision logic
           (engine/src/auto-charge.ts) auto-resolve power-charge/decline offers instead of asking
           every time - a per-browser preference (never synced/persisted as part of game state).
           Hidden before round 1 (see showAutoLeechSelect) - faction pick/ban/silent-auction-bid/
           initial-building setup have nothing to leech from yet. A dropdown (not a <select>) so the
           button itself can show a short label instead of the full option text, which used to force
           the status line to wrap onto several lines on narrow screens. -->
      <b-dropdown
        v-if="showAutoLeechSelect"
        size="sm"
        variant="outline-secondary"
        right
        class="ml-auto auto-leech-select"
        v-b-tooltip.hover
        title="Auto leech: automatically accept or decline power-charge offers up to this amount, instead of asking every time"
      >
        <template #button-content>
          <span class="auto-leech-dot" :class="autoChargePowerActive ? 'active' : 'inactive'"></span>
          {{ autoChargePowerShortLabel }}
        </template>
        <b-dropdown-item
          v-for="opt in autoChargePowerOptions"
          :key="opt.value"
          :active="opt.value === autoChargePower"
          @click="setAutoChargePower(opt.value)"
        >
          {{ opt.text }}
        </b-dropdown-item>
      </b-dropdown>
    </div>
    <div id="move-buttons" ref="moveButtons" :class="{ 'mobile-sticky-actions': showStickyMobileBar }">
      <!-- Same status line as #move-title above, shown only inside the mobile sticky bar (once it's
           actually pinned, i.e. narrow viewports - see the .sticky-bar-title/.hide-on-mobile-sticky
           CSS) - freeing up the space #move-title used to occupy alone on mobile once round 1+
           starts, instead of duplicating it on screen. Placed first (above the action buttons) so
           whose-turn/what's-happening is the first thing read when the bar comes into view, not
           buried below a scrollable list of buttons. -->
      <div v-if="showStickyMobileBar" class="sticky-bar-title d-flex align-items-center">
        <h5 class="mb-0">
          <RichTextView :content="statusLine" />
        </h5>
        <b-btn v-if="showSilentAuctionInfo" v-b-modal.silent-auction-info variant="link" size="sm" class="ml-2 silent-auction-info-button">
          How does the auction work? <b-badge variant="info" pill>i</b-badge>
        </b-btn>
        <b-dropdown
          v-if="showAutoLeechSelect"
          size="sm"
          variant="outline-secondary"
          right
          dropup
          boundary="window"
          :popper-opts="{ positionFixed: true }"
          class="ml-auto auto-leech-select"
          v-b-tooltip.hover
          title="Auto leech: automatically accept or decline power-charge offers up to this amount, instead of asking every time"
        >
          <template #button-content>
          <span class="auto-leech-dot" :class="autoChargePowerActive ? 'active' : 'inactive'"></span>
          {{ autoChargePowerShortLabel }}
        </template>
          <b-dropdown-item
            v-for="opt in autoChargePowerOptions"
            :key="opt.value"
            :active="opt.value === autoChargePower"
            @click="setAutoChargePower(opt.value)"
          >
            {{ opt.text }}
          </b-dropdown-item>
        </b-dropdown>
      </div>
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
        />
        <b-btn v-if="canUndo" :class="['mr-2', 'mb-2', 'move-button']" @click="undo">
          <template>
            <Undo v-if="canUndo" transform="scale(1.2)" />
          </template>
        </b-btn>
      </div>
      <div v-if="showPremoveConfirm || showPremoveCancel" class="d-flex flex-wrap align-content-stretch">
        <b-btn
          v-if="showPremoveConfirm"
          :class="['mr-2', 'mb-2', 'move-button', 'premove-inline-action', 'premove-inline-action--confirm']"
          @click="$emit('confirm-premove')"
        >
          {{ premoveConfirmLabel }}
        </b-btn>
        <b-btn
          v-if="showPremoveCancel"
          :class="['mr-2', 'mb-2', 'move-button', 'premove-inline-action']"
          @click="$emit('cancel-premove')"
        >
          Cancel premove
        </b-btn>
      </div>
      <div v-if="isChoosingFaction" class="d-flex flex-wrap align-content-stretch faction-picker-buttons">
        <MoveButton
          v-for="faction in factionsToChoose.data"
          :button="{
            command: `${factionsToChoose.name} ${faction}`,
            modal: modalDialog(factionName(faction), tooltip(faction)),
            richText: factionPickerLabel(faction),
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
      <div v-if="isBanningFaction" class="d-flex flex-wrap align-content-stretch faction-picker-buttons">
        <MoveButton
          v-for="faction in factionToBan.data"
          :button="{
            command: `${factionToBan.name} ${faction}`,
            modal: modalDialog(factionName(faction), tooltip(faction), 'OK, I ban this one!'),
            richText: factionPickerLabel(faction),
            shortcuts: [factionShortcut(faction)],
          }"
          :controller="controller"
          :key="faction"
        />
      </div>
      <div v-if="isSilentBidding" class="silent-bid-form">
        <p class="text-muted small">
          Privately enter the most VP you're willing to lose to win each faction. Submit once and everyone's bids
          will be resolved automatically once all players have submitted.
        </p>
        <div v-for="pos in silentBidCommand.data.bids" :key="pos.faction" class="d-flex align-items-center mb-2">
          <span class="silent-bid-faction mr-2">
            <i :class="`planet ${factionPlanet(pos.faction)}`" :style="{ color: factionPickerColor(pos.faction) }"></i>
            {{ factionName(pos.faction) }}
          </span>
          <b-form-input
            type="number"
            min="0"
            :max="pos.bid[pos.bid.length - 1]"
            v-model.number="silentBidValues[pos.faction]"
            style="width: 6rem"
          />
        </div>
        <b-btn variant="primary" @click="submitSilentBid">Submit bids</b-btn>
      </div>
      <!-- Placed last (below the action buttons, at the very bottom of the sticky bar) - see the
           .sticky-resource-bar-row CSS for the divider separating it from the buttons above and the
           extra bottom clearance keeping it clear of the screen's rounded bottom corners. -->
      <StickyResourceBar v-if="showResourceBar" :player="myPlayer" class="sticky-resource-bar-row" />
    </div>
    <!-- reserves the sticky bar's actual rendered height (tracked live via ResizeObserver, capped
         by the bar's own max-height/overflow) so it never permanently covers page content it has
         scrolled past, without reserving more blank space than the bar actually uses. Only takes
         up real height inside the narrow-viewport media query below, where #move-buttons is
         actually `position: fixed` and needs compensating for - on wider screens the bar renders
         normally in-flow (no fixed overlay to cover anything), so this must collapse to 0 there
         instead of doubling the button list's own height with an identical blank gap underneath
         it. A CSS custom property (rather than the `height` style itself) lets the default/media
         query rules fully control whether that measured height actually applies. -->
    <div
      v-if="showStickyMobileBar && !hideSpacer"
      class="mobile-sticky-actions-spacer"
      :style="{ '--sticky-bar-height': stickyBarHeight + 'px' }"
      aria-hidden="true"
    ></div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, {
  AdvTechTilePos,
  AuctionVariant,
  AvailableCommand,
  BoardAction,
  BuildWarning,
  Command,
  Faction,
  factionPlanet,
  GaiaHex,
  Phase,
  Player,
  Resource,
  Reward,
  Spaceship,
  SpaceMap,
  TechTilePos,
} from "@gaia-project/engine";
import MoveButton from "./MoveButton.vue";
import SilentAuctionInfo from "./SilentAuctionInfo.vue";
import {
  ButtonData,
  GameContext,
  HexSelection,
  HighlightHex,
  ModalButtonData,
  SpecialActionIncome,
  WarningsPreference
} from "../data";
import { factionDesc, factionName, factionShortcut } from "../data/factions";
import { FactionCustomization } from "@gaia-project/engine/src/engine";
import { factionVariantBoard } from "@gaia-project/engine/src/faction-boards";
import { enabledButtonWarnings, isWarningEnabled } from "../data/warnings";
import Undo from "./Resources/Undo.vue";
import { ActionPayload, SubscribeActionOptions, SubscribeOptions } from "vuex";
import { CommandController, ExecuteBack, FastConversionTooltips } from "../logic/buttons/types";
import { buttonStringLabel, callOnShow } from "../logic/buttons/utils";
import { commandButtons, replaceRepeat } from "../logic/buttons/commands";
import { CubeCoordinates } from "hexagrid";
import { autoClickStrategy } from "../logic/buttons/autoClick";
import RichTextView from "./Resources/RichTextView.vue";
import StickyResourceBar from "./StickyResourceBar.vue";
import { richText, RichText, richTextPlanet } from "../graphics/rich-text";
import { chargePowerToPay } from "../logic/utils";
import { factionColor } from "../graphics/utils";

let show = false;

const statusLineSeparator = " - ";

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

    modalDialog(title: string, msg: string, okTitle?: string): ModalButtonData {
      return {
        title: title,
        content: msg,
        okTitle,
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
    RichTextView,
    StickyResourceBar,
    MoveButton,
    Undo,
    SilentAuctionInfo,
  },
})
export default class Commands extends Vue implements CommandController {
  @Prop()
  currentMove?: string;

  @Prop({ default: "" })
  remainingTime: string;

  /** Suppresses the in-place mobile sticky-bar spacer below (see the template) and instead emits
   * `sticky-bar-height` so a caller can render that reserved space wherever it actually wants it -
   * Game.vue's graphical layout uses this to move the reserved gap from right after Turn Order
   * (where it used to sit, as a large dead gap before the first faction board) down to the very
   * end of the page instead. The plain list-mode layout (Table.vue) doesn't set this, so it keeps
   * the original in-place spacer unchanged. */
  @Prop({ default: false })
  hideSpacer: boolean;

  @Prop({ default: false })
  showPremoveCancel: boolean;

  @Prop({ default: false })
  showPremoveConfirm: boolean;

  @Prop({ default: "Queue now" })
  premoveConfirmLabel: string;

  get controller() {
    return this;
  }

  get gameData(): Engine {
    return this.$store.state.data;
  }

  get factionCustomization(): FactionCustomization {
    return this.gameData.factionCustomization;
  }

  get statusLine(): RichText {
    const t: RichText = [richText([this.playerName, ...this.titles].join(statusLineSeparator))];

    if (this.currentMove?.length > 0) {
      t.push(richText(statusLineSeparator));
      t.push(richText(this.currentMove.substring(this.currentMove.indexOf(" "))));
      t.push(...this.currentTurnChanges);
    }

    return t;
  }

  get currentTurnChanges(): RichText {
    const logEntries = this.gameData.advancedLog;
    const entry = logEntries[logEntries.length - 1];
    if (entry != null && entry.changes != null && entry.move != null) {
      if (this.gameData.moveHistory[entry.move] == null) {
        const values = Object.values(entry.changes).flatMap((e) =>
          Object.keys(e).map((k) => new Reward(e[k], k as Resource))
        );
        return [{ rewards: Reward.merge(chargePowerToPay(values)) }];
      }
    }
    return [];
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
      if (command.name === Command.BanFaction) {
        this.title("Ban a faction");
        return;
      }
      if (command.name === Command.SilentBid) {
        this.title("Submit your Silent Auction bids");
        this.silentBidValues = Object.fromEntries(command.data.bids.map((pos) => [pos.faction, 0]));
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

  get factionToBan(): AvailableCommand {
    return this.availableCommands?.find((c) => c.name === Command.BanFaction) ?? null;
  }

  get isBanningFaction() {
    return !!this.factionToBan;
  }

  get silentBidCommand(): AvailableCommand {
    return this.availableCommands?.find((c) => c.name === Command.SilentBid) ?? null;
  }

  get isSilentBidding() {
    return !!this.silentBidCommand;
  }

  get autoChargePower(): string {
    return String(this.$store.state.preferences.autoChargePower ?? "ask");
  }

  get autoChargePowerOptions() {
    return [
      { value: "ask", text: "Auto leech: off (ask every time)" },
      { value: "decline-cost", text: "Auto leech: free only (decline anything with a cost)" },
      { value: "1", text: "Auto leech: up to 1 power" },
      { value: "2", text: "Auto leech: up to 2 power" },
      { value: "3", text: "Auto leech: up to 3 power" },
      { value: "4", text: "Auto leech: up to 4 power" },
      { value: "5", text: "Auto leech: up to 5 power" },
    ];
  }

  setAutoChargePower(value: string) {
    this.$store.commit("preferences", { autoChargePower: value });
  }

  /** Whether auto-leech will currently act on its own instead of asking every time - drives the
   * dot indicator on the dropdown button (pulsing green when active, static red when off), since
   * the short label alone ("Leech: off" vs "Leech: 3") is easy to miss at a glance. */
  get autoChargePowerActive(): boolean {
    return this.autoChargePower !== "ask";
  }

  /** Short label for the auto-leech dropdown button itself - the full sentence lives in the menu
   * options (autoChargePowerOptions), not on the button, so the button doesn't force the status
   * line next to it to wrap. */
  get autoChargePowerShortLabel(): string {
    switch (this.autoChargePower) {
      case "ask":
        return "Leech: off";
      case "decline-cost":
        return "Leech: free";
      default:
        return `Leech: ${this.autoChargePower}`;
    }
  }

  get showSilentAuctionInfo(): boolean {
    return (
      this.gameData.options.auction === AuctionVariant.Silent &&
      (this.engine.phase === Phase.SetupFactionBan ||
        this.engine.phase === Phase.SetupFaction ||
        this.engine.phase === Phase.SetupSilentBid)
    );
  }

  submitSilentBid() {
    const command = this.silentBidCommand;
    const pairs = command.data.bids.map((pos) => `${pos.faction} ${this.silentBidValues[pos.faction] || 0}`);
    this.handleCommand(`${command.name} ${pairs.join(" ")}`);
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

  /** Frozen bottom action bar on mobile - only once real gameplay has started (round 1+), never
   * during player-count/faction-picking/initial-building setup. */
  get showStickyMobileBar(): boolean {
    return !this.init && !this.isChoosingFaction && this.engine.round >= 1;
  }

  /** Auto-leech is a per-round-action preference - hide it during player-count/faction-picking/
   * banning/silent-auction-bidding/initial-building setup, same "round 1+" boundary as
   * showStickyMobileBar, so it doesn't show before there's anything to leech from. */
  get showAutoLeechSelect(): boolean {
    return (
      !this.init &&
      !this.isChoosingFaction &&
      !this.isBanningFaction &&
      !this.isSilentBidding &&
      this.engine.round >= 1
    );
  }

  /** The viewing user's own player (not necessarily whoever's turn it is), same "viewing seat"
   * lookup used elsewhere (e.g. FactionWheel.vue, BoardAction.vue) - falls back to the active
   * player in self-contained/hot-seat mode, where there's no separate logged-in seat. */
  get myPlayer(): Player | null {
    const index = this.$store.state.player?.index ?? this.engine.currentPlayer;
    return index == null ? null : this.engine.players[index];
  }

  /** Same visibility rule as the auto-leech select - nothing to show before a player has a faction
   * and the game has actually started. */
  get showResourceBar(): boolean {
    return this.showAutoLeechSelect && !!this.myPlayer?.faction;
  }

  /** Live-tracked rendered height of #move-buttons (already capped by its own CSS max-height +
   * overflow-y:auto), so the layout spacer below it reserves exactly that much space - not a
   * blanket max-height's worth of blank page whenever the button list is short. */
  private stickyBarHeight = 0;
  private stickyBarObserver: ResizeObserver | null = null;
  private visualViewportListener: (() => void) | null = null;

  get titles() {
    return this.commandTitles.length === 0 ? [`Your turn - Round ${this.engine.round}`] : this.commandTitles;
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

  factionPickerColor(faction: Faction) {
    return factionColor(faction);
  }

  factionPickerLabel(faction: Faction): RichText {
    return [richText(this.factionName(faction)), richTextPlanet(this.factionPlanet(faction))];
  }

  updateRandomFaction() {
    this.updater += 1;
  }

  handleCommand(command: string, source?: ButtonData, warnings?: BuildWarning[], times?: number) {
    this.unsubscribeCommands();

    if (source?.buttons?.length > 0) {
      this.commandTitles.push(replaceRepeat(source.longLabel ?? buttonStringLabel(source), times));
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

  isWarningEnabled(disableKey: string): boolean {
    return isWarningEnabled(disableKey, this.$store.state.preferences);
  }

  enabledButtonWarnings(button: ButtonData): string[] {
    return enabledButtonWarnings(button, this.$store.state.preferences);
  }

  get buttons(): ButtonData[] {
    const commands = this.availableCommands;
    if (!commands) {
      return [];
    }

    //todo test "always" better, then re-enable
    // const s = autoClickStrategy(this.$store.state.preferences.autoClick, this.preventFirstAutoClick);
    const s = autoClickStrategy("smart", this.preventFirstAutoClick);
    const buttons = commandButtons(commands, this.engine, this.player, this, s, this.buttonChain.length);
    if (this.warningPreference === WarningsPreference.ButtonText) {
      for (const button of buttons) {
        const w = this.enabledButtonWarnings(button).join(", ");
        if (w.length > 0 && !button.warningInLabel) {
          if (button.longLabel) {
            button.longLabel = `${button.longLabel} (${w})`;
          }
          if (button.label) {
            button.label = `${button.label} (${w})`;
          }
          if (button.richText) {
            button.richText.push(richText(`(${w})`));
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

      console.log("back", buttonStringLabel(last));

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

    const moveButtons = this.$refs.moveButtons as HTMLElement;

    // Pinch-zooming the game board (allowed on purpose - see hosted/viewport.ts) also scales any
    // `position: fixed` element, since native pinch-zoom enlarges the whole layout viewport
    // including fixed content - a fixed bottom bar visibly balloons in size along with the map
    // instead of staying put. The VisualViewport API reports the zoomed-in "visual" viewport
    // separately from the unchanged "layout" viewport `position: fixed` actually anchors to, so a
    // counter-transform (shrink back by 1/scale, then re-anchor to the visual viewport's own
    // bottom-left corner) keeps the bar's on-screen size and position constant regardless of zoom.
    // Recalculated both on visualViewport resize/scroll (actual zoom/pan) AND inside the
    // ResizeObserver below (covers #move-buttons first becoming the fixed sticky bar, e.g. once
    // round 1 starts, which isn't itself a visualViewport event).
    const vv = window.visualViewport;
    const updateZoomTransform = () => {
      if (!moveButtons || !vv) {
        return;
      }
      // Only the narrow/mobile sticky layout is ever `position: fixed` - on wider viewports
      // #move-buttons renders normally in-flow, where this counter-transform doesn't apply.
      if (!this.showStickyMobileBar) {
        moveButtons.style.transform = "";
        return;
      }
      const scale = vv.scale || 1;
      // Only ever compensate for genuine pinch-zoom (scale !== 1). `vv.offsetTop`/`vv.height` also
      // shift transiently at scale === 1 - iOS's address bar hiding/showing during an ordinary
      // scroll, and elastic overscroll bounce at the very top/bottom of the page - both fire
      // `visualViewport` resize/scroll events with a nonzero offset despite no real zoom. Applying
      // `translate(x, y) scale(1)` in that case is exactly the bug: the fixed bar visibly detaches
      // and floats mid-screen on scroll, or "elastic jumps" at the scroll extremes. Gating on scale
      // alone (not also x/y) keeps the bar genuinely fixed whenever the user isn't actually zoomed.
      if (scale === 1) {
        moveButtons.style.transform = "";
        return;
      }
      const x = vv.offsetLeft;
      const y = vv.offsetTop + vv.height - window.innerHeight;
      // Any non-"none" transform on this element - even a no-op identity one - makes it a new
      // CSS containing block for `position: fixed` descendants (spec behavior, not a bug), which
      // broke the auto-leech dropdown's `positionFixed: true` Popper menu: Popper computed its
      // position assuming true viewport-relative fixed positioning, but the browser then rendered
      // it relative to *this* (transformed) ancestor instead, landing the menu mid-page and
      // clipped down to a sliver. Only set a real transform while actually zoomed/panned (the
      // no-op identity case is by far the common one, so skip it entirely rather than applying
      // "translate(0px, 0px) scale(1)").
      if (x === 0 && y === 0) {
        moveButtons.style.transform = "";
        return;
      }
      moveButtons.style.transform = `translate(${x}px, ${y}px) scale(${1 / scale})`;
    };

    if (moveButtons && typeof ResizeObserver !== "undefined") {
      this.stickyBarObserver = new ResizeObserver(() => {
        // read the full border-box (incl. padding) so the spacer reserves the bar's real footprint
        this.stickyBarHeight = moveButtons.getBoundingClientRect().height;
        this.$emit("sticky-bar-height", this.showStickyMobileBar ? this.stickyBarHeight : 0);
        updateZoomTransform();
      });
      this.stickyBarObserver.observe(moveButtons);
    }

    if (moveButtons && vv) {
      updateZoomTransform();
      vv.addEventListener("resize", updateZoomTransform);
      vv.addEventListener("scroll", updateZoomTransform);
      this.visualViewportListener = () => {
        vv.removeEventListener("resize", updateZoomTransform);
        vv.removeEventListener("scroll", updateZoomTransform);
        moveButtons.style.transform = "";
      };
    }

    this.$on("hook:beforeDestroy", () => {
      window.removeEventListener("keydown", keyListener);
      backListener();
      this.stickyBarObserver?.disconnect();
      this.visualViewportListener?.();
      this.$emit("sticky-bar-height", 0);
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

  highlightTechs(techs: Array<TechTilePos | AdvTechTilePos | Spaceship>) {
    this.$store.commit("highlightTechs", techs);
  }

  subscribe(action: string, button: ButtonData, callback: (payload: any) => any, filter: (payload: any) => boolean = null) {
    action = "" + action;

    this.unsubscribe(button);

    button.subscription = (this.$store as any).subscribeAction(({ type, payload }) => {
      if (type === action && (!filter || filter(payload))) {
        callback(payload);
      }
    });
  }

  activate(buttonData: ButtonData | null) {
    this.$store.commit("activeButton", buttonData);
  }

  subscribeHexClick(button: ButtonData, callback: (hex: GaiaHex, highlight: HighlightHex) => void, filter?: (hex: GaiaHex) => boolean) {
    const heightFilter = () => {
      return this.buttonChain.length == button.parents;
    };
    this.subscribe("hexClick", button, (payload) => {
      callback(payload.hex, payload.highlight);
    }, payload => (filter ? filter(payload.hex) : true) && heightFilter());
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
      if (this.shouldShowModal(button)) {
        try {
          const warning = button.warning;
          const c = this.$createElement;
          const w = this.enabledButtonWarnings(button);
          const message = w.length == 1 ? w[0] : w.map((w) => c("ul", [c("li", [w])]));
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
      if (!this.isActiveButton(button)) {
        if (!button.keepContext) {
          this.clearContext();
        }

        if (button.hexes) {
          this.highlightHexes(button.hexes);
        }
      }

      if (button.onClick) {
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

  private shouldShowModal(button: ButtonData) {
    return this.enabledButtonWarnings(button).length > 0
      && !this.isActiveButton(button)
      && this.warningPreference === WarningsPreference.ModalDialog;
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

  highlightBoardActions(boardActions: BoardAction[]) {
    this.$store.commit("highlightBoardActions", boardActions);
  }

  highlightSpecialActions(specialActions: SpecialActionIncome[]) {
    this.$store.commit("highlightSpecialActions", specialActions);
  }

  executeCommand(button: ButtonData): void {
    this.emitButtonCommand(button);
  }

  emitButtonCommand(button: ButtonData, append?: string, params?: EmitCommandParams) {
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
    return Math.max(this.player?.data.temporaryRange ?? 0, this.currentMove.includes("range+3") ? 3 : 0);
  }

  private updater = 0;
  public subscriptions: { [key in Command]?: () => void } = {};
  private commandTitles: string[] = [];
  public customButtons: ButtonData[] = [];
  private commandChain: string[] = [];
  private buttonChain: ButtonData[] = [];
  private allButtons: ButtonData[] = [];
  private preventFirstAutoClick = false;
  private silentBidValues: Record<string, number> = {};
}
</script>

<style lang="scss">
.silent-auction-info-button {
  text-decoration: none;
  white-space: nowrap;

  .badge {
    margin-left: 0.25rem;
  }
}

// Status dot on the auto-leech dropdown button - green/pulsing while it's set to actually act on
// its own, static red while off ("ask every time"), so the button's current state reads at a
// glance without parsing its ("Leech: off"/"Leech: 3") text.
.auto-leech-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 0.3rem;
  border-radius: 50%;

  &.inactive {
    background: var(--oxide, #ff160a);
  }

  &.active {
    background: var(--highlighted, #2c4);
    animation: auto-leech-pulse 1.6s infinite;
  }
}

@keyframes auto-leech-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--highlighted-rgb, 32, 204, 68), 0.7);
  }
  70% {
    box-shadow: 0 0 0 5px rgba(var(--highlighted-rgb, 32, 204, 68), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--highlighted-rgb, 32, 204, 68), 0);
  }
}

.premove-inline-action {
  border-radius: 10px;
  border-color: rgba(31, 45, 82, 0.14);
  box-shadow: 0 1px 2px rgba(31, 45, 82, 0.08);

  &--confirm {
    background: linear-gradient(180deg, #2f72d8 0%, #2258ad 100%);
    border-color: rgba(34, 88, 173, 0.4);
  }
}

.faction-preview {
  padding: 1rem;
  color: #f8fafc;
}

.faction-preview__header,
.faction-preview__board,
.faction-preview__lost-fleet {
  background: rgba(10, 16, 28, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  padding: 0.8rem 0.85rem;
}

.faction-preview__board,
.faction-preview__lost-fleet {
  margin-top: 0.7rem;
}

.faction-preview__title {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.faction-preview__subtitle,
.faction-preview__board-title {
  margin-top: 0.55rem;
  margin-bottom: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(248, 250, 252, 0.82);
}

.faction-preview__resources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.38rem;
}

.faction-preview__resource {
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
  min-height: 1.9rem;
  padding: 0.2rem 0.5rem 0.2rem 0.24rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.faction-preview__resource-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.38rem;
  height: 1.38rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #0f172a;
  background: #ffffff;
}

.faction-preview__resource-count {
  font-size: 0.8rem;
  font-weight: 700;
  color: #fff;
}

.faction-preview__resource--credit .faction-preview__resource-glyph {
  background: #ffd166;
}

.faction-preview__resource--ore .faction-preview__resource-glyph {
  background: #f4976c;
}

.faction-preview__resource--knowledge .faction-preview__resource-glyph {
  background: #b8e1ff;
}

.faction-preview__resource--qic .faction-preview__resource-glyph {
  background: #b388ff;
  color: #fff;
}

.faction-preview__resource--power .faction-preview__resource-glyph,
.faction-preview__resource--token .faction-preview__resource-glyph,
.faction-preview__resource--brainstone .faction-preview__resource-glyph {
  background: #dda0ff;
}

.faction-preview__resource--research .faction-preview__resource-glyph {
  background: #8be9fd;
  min-width: auto;
  padding: 0 0.4rem;
}

.faction-preview__resource--generic .faction-preview__resource-glyph {
  min-width: auto;
  padding: 0 0.4rem;
}

.faction-preview__building-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.faction-preview__building {
  padding: 0.55rem 0.65rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.faction-preview__building-top,
.faction-preview__building-line {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
}

.faction-preview__building-name,
.faction-preview__building-stock,
.faction-preview__building-line strong {
  font-size: 0.78rem;
  font-weight: 700;
}

.faction-preview__building-line {
  margin-top: 0.22rem;
  font-size: 0.72rem;
  color: rgba(248, 250, 252, 0.84);
}

.faction-preview__lost-fleet ul {
  margin: 0;
  padding-left: 1.1rem;
}

.faction-preview__accordion {
  margin-top: 0.7rem;
  border-radius: 12px;
  background: rgba(10, 16, 28, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.16);

  summary {
    cursor: pointer;
    padding: 0.7rem 0.85rem;
    font-weight: 700;
    outline: none;
  }
}

.faction-preview__accordion-body {
  padding: 0 0.85rem 0.8rem;
  color: rgba(248, 250, 252, 0.92);
  line-height: 1.45;
}

.faction-picker-buttons {
  .move-button .btn {
    border-radius: 12px;
    border-color: rgba(31, 45, 82, 0.14);
    background: linear-gradient(180deg, #ffffff 0%, #e7ebf3 100%);
    color: #24324b;
    box-shadow: 0 1px 2px rgba(31, 45, 82, 0.08);
    font-weight: 600;
  }

  .move-button i.planet::before {
    font-size: 18px;
  }
}

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

  // asteroid
  &.a {
    color: var(--asteroid);
  }

  // protoplanet
  &.p {
    color: var(--protoplanet);
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

// Frozen bottom action bar on mobile (round 1+ only, see Commands.vue's showStickyMobileBar) -
// keeps refill/round-action buttons reachable without scrolling back up to the top of the page.
// The max-height + overflow-y:auto keeps a long options list (e.g. many valid mine-building
// spots) scrollable in place instead of growing to fill/exceed the screen.
$mobile-sticky-actions-max-height: 40vh;

// The in-bar status line (.sticky-bar-title) and the resource bar below it are only meant for the
// narrow/mobile sticky layout - on wider viewports #move-buttons isn't pinned/fixed, so keep using
// the standalone #move-title/full player board there instead of showing this twice. Scoped under
// #move-buttons (not a bare .sticky-bar-title) so this selector's specificity beats Bootstrap's
// .d-flex utility outright - .d-flex is "display: flex !important" too, so relying on !important
// alone to win a tie would depend on unpredictable stylesheet source order (verified empirically:
// a bare !important here did NOT reliably win). See the matching note on
// #move-title.hide-on-mobile-sticky below for the same footgun on the other side of this toggle.
// The resource bar (last row) no longer sits in its own card - just a plain hairline divider from
// the buttons above and a little breathing room, kept minimal to stay compact.
#move-buttons .sticky-resource-bar-row {
  display: none !important;
  margin-top: 0.35rem;
  padding-top: 0.3rem;
  border-top: 1px solid rgba(28, 43, 74, 0.14);
}

// The status strip is the sheet's own dark "header" band - deliberately contrasting with the light
// button/resource area below it, both to visually anchor "this is the important line" and to
// guarantee text contrast outright rather than relying on a thin accent line against a
// same-lightness background. Full-bleed to the sheet's outer edges (matching its rounded top
// corners) and pulled up over the container's own top padding, which is sized to leave room for
// the small "grab handle" bar this element draws at its own top edge - a common bottom-sheet
// affordance, purely decorative. Kept compact - just enough padding for the handle and a
// comfortable tap target, not a deep banner.
#move-buttons .sticky-bar-title {
  display: none !important;
  position: relative;
  margin: calc(-0.7rem) calc(-0.5rem - env(safe-area-inset-right)) 0.4rem calc(-0.5rem - env(safe-area-inset-left));
  padding: 0.65rem calc(0.7rem + env(safe-area-inset-right)) 0.35rem calc(0.7rem + env(safe-area-inset-left));
  border-radius: 16px 16px 0 0;
  background: linear-gradient(135deg, #1c2b4a 0%, #2f4a7a 100%);
  color: #f3f5fa;

  &::before {
    content: "";
    position: absolute;
    top: 0.35rem;
    left: 50%;
    transform: translateX(-50%);
    width: 32px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.28);
  }

  // Small enough that the status text stays on one (or two, at most) lines instead of the default
  // h5 size wrapping across several - that wrapping used to be what made this banner so tall.
  h5 {
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.2;
    color: inherit;
  }

  // Both the auction-info link and the auto-leech dropdown default to Bootstrap's grey
  // outline/link styling, which reads as a muddy near-invisible smudge against a dark background -
  // recolored to sit clearly on the dark header instead, same sizing/behavior otherwise.
  .silent-auction-info-button {
    color: #d7e2ff;
  }

  .auto-leech-select .btn {
    padding: 0.15rem 0.4rem;
    font-size: 0.75rem;
    color: #f3f5fa;
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.3);

    &:hover,
    &:focus {
      color: #fff;
      background: rgba(255, 255, 255, 0.2);
    }
  }

  .btn-outline-secondary {
    color: #f3f5fa;
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.08);

    &:hover,
    &:focus {
      color: #fff;
      background: rgba(255, 255, 255, 0.18);
      border-color: rgba(255, 255, 255, 0.42);
    }
  }
}

// Default/wide-viewport state: no fixed bar overlay exists to compensate for, so the spacer must
// not reserve any space (see the template comment above) - only the narrow-viewport media query
// below opts it back in, sized from the `--sticky-bar-height` custom property.
.mobile-sticky-actions-spacer {
  height: 0;
}

@media (max-width: 767px) {
  #move-buttons.mobile-sticky-actions {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1030;
    max-height: $mobile-sticky-actions-max-height;
    overflow-y: auto;
    margin: 0;
    // Anchors the JS-driven counter-transform (Commands.vue's visualViewport listener, keeping
    // this bar's on-screen size/position constant while the user pinch-zooms the map) at this
    // element's own bottom-left corner, matching how it's actually positioned (bottom:0; left:0).
    transform-origin: left bottom;
    // Extra +8px buffer on top of the safe-area-inset-bottom value itself: the last row in the bar
    // (the resource bar) is wide/edge-to-edge, and sitting exactly at the computed inset boundary
    // still visually clipped its sides against the bottom rounded corners on the iPhone 16 - a
    // small fixed margin beyond the inset gives it real clearance from where the curve starts.
    padding: 0.7rem calc(0.5rem + env(safe-area-inset-right)) calc(0.45rem + env(safe-area-inset-bottom) + 8px)
      calc(0.5rem + env(safe-area-inset-left));
    border-radius: 16px 16px 0 0;
    background: linear-gradient(180deg, #ffffff 0%, #eef1f6 100%);
    box-shadow: 0 -12px 28px rgba(20, 26, 50, 0.18), 0 -1px 0 rgba(255, 255, 255, 0.6);

    // Every move-button gets a refreshed "keycap" look here (rounded corners, soft gradient/
    // shadow, a satisfying press state) instead of Bootstrap's flat default - scoped to this
    // sticky-bar context only, so the same buttons elsewhere (desktop layout, faction picker,
    // etc.) are untouched. Margins tightened from Bootstrap's default .mr-2/.mb-2 (0.5rem, both
    // !important utility classes - hence needing !important here too) down to 0.35rem, so more
    // buttons fit per row without wasted gutters, per owner feedback that the bar had too much
    // room around its content.
    .mr-2.move-button {
      margin-right: 0.35rem !important;
    }

    .mb-2.move-button {
      margin-bottom: 0.35rem !important;
    }

    .move-button .btn {
      border-radius: 10px;
      border-color: rgba(31, 45, 82, 0.14);
      box-shadow: 0 1px 2px rgba(31, 45, 82, 0.08);
      padding-top: 0.3rem;
      padding-bottom: 0.3rem;
      transition: transform 0.08s ease-out, box-shadow 0.08s ease-out;

      &:active {
        transform: scale(0.97);
        box-shadow: inset 0 1px 2px rgba(31, 45, 82, 0.15);
      }
    }

    .btn-secondary:not(.active):not(.warning) {
      background: linear-gradient(180deg, #ffffff 0%, #e7ebf3 100%);
      color: #33415c;
    }

    .sticky-resource-bar-row {
      display: flex !important;
    }

    .sticky-bar-title {
      display: flex !important;
    }
  }

  // Hide the standalone status line above the bar once it's showing inside the sticky bar itself
  // - avoids a duplicate and frees up the space it used to occupy alone. Needs !important: the
  // element also carries Bootstrap's .d-flex utility, which sets "display: flex !important" and
  // would otherwise always win over this rule regardless of selector specificity.
  #move-title.hide-on-mobile-sticky {
    display: none !important;
  }

  // JS (Commands.vue's ResizeObserver) sets --sticky-bar-height to match the bar's actual
  // rendered size so the spacer doesn't over-reserve blank space for a short button list; the
  // max-height caps it the same way the bar itself is capped.
  .mobile-sticky-actions-spacer {
    height: var(--sticky-bar-height, 0px);
    max-height: $mobile-sticky-actions-max-height;
  }
}
</style>
