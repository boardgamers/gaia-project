<template>
  <div id="move">
    <!-- The sandbox's line strip (§13) sits ON TOP of the striped banner, not inside it: a sibling
         just before the header, with its bottom edge tucked under the banner's top so the tabs read
         as resting on it - browser tabs on a toolbar. It WAS the header's own first row, which put a
         band of stripes above the tabs and made them look like they were floating in the middle of
         the banner (owner report). Being outside the header also means a press on a tab cannot reach
         it at all, rather than relying on the strip's own @click.stop to stop it.
         Rendered here AND in the mobile sticky band below, hidden by CSS on whichever of the two
         headers is not in use - the same twice-mounted arrangement as AnalysisHeaderControls. -->
    <AnalysisLineTabs
      v-if="analysisMode"
      :class="{ 'hide-on-mobile-sticky': showStickyMobileBar }"
      :lines="analysisLineSummaries"
      :active="analysisActiveLine"
      @select="$emit('analysis-select-line', $event)"
      @add="$emit('analysis-add-line')"
      @close="$emit('analysis-close-line', $event)"
    />
    <div
      v-if="!analysisEditActive"
      id="move-title"
      class="d-flex align-items-center"
      :class="{ 'hide-on-mobile-sticky': showStickyMobileBar, 'move-title--analysis': analysisMode }"
    >
      <h5 class="mb-0">
        <span v-if="init">Pick the number of players</span>

        <template v-if="analysisMode">
          Planning<template v-if="analysisSeedActive"> — choose a faction to play as</template></template
        >
        <RichTextView v-else :content="statusLine" />
      </h5>
      <div v-if="!analysisMode && (analysisOffered || showAutoLeechSelect)" class="turn-tools">
        <AutoChargeControl v-if="showAutoLeechSelect" />
        <button
          v-if="analysisOffered"
          class="btn btn-sm btn-outline-primary planning-entry"
          title="Try moves without playing them"
          @click="$emit('analysis-start')"
        >
          {{ actionsEnabled ? "Simulate moves" : "Plan a move" }}
        </button>
      </div>
      <!-- The Silent Auction / ban-phase explainer buttons used to sit here. They now live in
           SetupStatus.vue's round-0 strip at the top of the page (Game.vue), which - unlike this
           panel - also renders for players who aren't on turn. Two copies would also register the
           same modal id twice. -->
      <AnalysisHeaderControls
        v-if="analysisMode && !analysisEditActive"
        :move-count="analysisMoveCount"
        :can-edit="analysisCanEdit"
        @undo="$emit('analysis-undo')"
        @reset="$emit('analysis-reset')"
        :status="analysisStatus"
        :committable-moves="analysisCommittableMoves"
        :plays-now="!!(analysisCommitPlan && analysisCommitPlan.live)"
        @commit="requestAnalysisCommit"
      />
    </div>
    <AnalysisMoves
      v-if="analysisMode && analysisEntries.length && !analysisEditActive"
      :entries="analysisEntries"
      :applied-count="analysisAppliedCount"
      :can-append="!engine.ended"
      :disabled="analysisEditingIndex < 0 && !!currentMove"
      @edit="$emit('analysis-edit-move', $event)"
      @insert="$emit('analysis-insert-move', $event)"
      @remove="$emit('analysis-remove-entry', $event)"
    />
    <AnalysisModeInfo v-if="analysisMode" />
    <!-- Commit's confirmation step, rendered here for the same once-per-page reason as the info modal
         above. The Commit button only opens it; nothing leaves the sandbox until this is confirmed. -->
    <AnalysisCommitConfirm v-if="analysisMode" :plan="analysisCommitPlan" @confirm="$emit('analysis-commit')" />
    <div
      id="move-buttons"
      data-tutorial="game-controls"
      ref="moveButtons"
      :class="{
        'mobile-sticky-actions': showStickyMobileBar,
        'mobile-sticky-actions--sandbox': showStickyMobileBar && analysisMode,
      }"
    >
      <!-- Same status line as #move-title above, shown only inside the mobile sticky bar (once it's
           actually pinned, i.e. narrow viewports - see the .sticky-bar-title/.hide-on-mobile-sticky
           CSS) - freeing up the space #move-title used to occupy alone on mobile wherever the bar is
           pinned, instead of duplicating it on screen. Placed first (above the action buttons) so
           whose-turn/what's-happening is the first thing read when the bar comes into view, not
           buried below a scrollable list of buttons. -->
      <AnalysisLineTabs
        v-if="showStickyMobileBar && analysisMode"
        class="analysis-tabs--sticky"
        :lines="analysisLineSummaries"
        :active="analysisActiveLine"
        @select="$emit('analysis-select-line', $event)"
        @add="$emit('analysis-add-line')"
        @close="$emit('analysis-close-line', $event)"
      />
      <div
        v-if="showStickyMobileBar && !analysisEditActive"
        class="sticky-bar-title d-flex align-items-center"
        :class="{ 'sticky-bar-title--analysis': analysisMode }"
      >
        <h5 class="mb-0">
          <template v-if="analysisMode">
            Planning<template v-if="analysisSeedActive"> — choose a faction to play as</template></template
          >
          <RichTextView v-else :content="statusLine" />
        </h5>
        <span class="chat-shortcut-host"></span>
        <div v-if="!analysisMode && (analysisOffered || showAutoLeechSelect)" class="turn-tools">
          <AutoChargeControl v-if="showAutoLeechSelect" dropup />
          <button
            v-if="analysisOffered"
            class="btn btn-sm btn-outline-primary planning-entry"
            title="Try moves without playing them"
            @click="$emit('analysis-start')"
          >
            {{ actionsEnabled ? "Simulate moves" : "Plan a move" }}
          </button>
        </div>
        <!-- No explainer buttons here either: the bar is never pinned during the ban/pick/bid phases
             (showStickyMobileBar excludes all three), so they could never show here. See
             SetupStatus.vue. -->
        <AnalysisHeaderControls
          v-if="analysisMode && !analysisEditActive"
          :move-count="analysisMoveCount"
          :can-edit="analysisCanEdit"
          @undo="$emit('analysis-undo')"
          @reset="$emit('analysis-reset')"
          :status="analysisStatus"
          :committable-moves="analysisCommittableMoves"
          :plays-now="!!(analysisCommitPlan && analysisCommitPlan.live)"
          @commit="requestAnalysisCommit"
        />
      </div>
      <div v-if="analysisEditActive" class="analysis-replace" role="status">
        <div class="analysis-replace__original">
          <strong class="analysis-replace__title"
            >{{ analysisInsertingMove ? "Adding" : "Editing" }} move {{ analysisEditingMoveNumber }}</strong
          >
          <span v-if="analysisEditingMove"
            ><span class="analysis-replace__label">{{ analysisInsertingMove ? "Before:" : "Original:" }}</span>
            {{ analysisEditingMove }}</span
          >
          <span v-else class="analysis-replace__label">At the end of the plan</span>
        </div>
        <div class="analysis-replace__actions">
          <button
            v-if="currentMove"
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="$emit('analysis-restart-edit')"
          >
            Restart
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="$emit('analysis-cancel-edit')">
            Cancel
          </button>
        </div>
      </div>
      <template v-if="actionsEnabled">
        <div v-if="init" class="d-flex flex-wrap align-content-stretch">
          <MoveButton
            v-for="i in [2, 3, 4]"
            :button="{ command: `init ${i} randomSeed`, label: `${i} players` }"
            :controller="controller"
            :key="i"
          ></MoveButton>
        </div>
        <!-- Sandbox mode's round-0 faction seed (ANALYSIS_MODE_PLAN.md §11). It used to be a labelled
           select plus a "Try this faction" button in AnalysisPanel.vue, i.e. a second container above
           the map, which on a phone is nowhere near where every other sandbox press happens. Owner
           instruction: every sandbox interaction belongs in this one action area, so it is a plain
           row of faction buttons here, announced by the striped header above ("SANDBOX — choose a
           faction to play as"). Deliberately NOT MoveButton-driven: a seed is not an engine command
           (see analysis.ts's `applyFactionSeed`), so it emits rather than dispatching - the markup
           mirrors MoveButton's own so `.faction-picker-buttons` styles it identically to the real
           pick/ban rows below.
           While it is up it REPLACES the ordinary round-0 buttons rather than sitting beside them:
           picking a faction here jumps straight past the pick/ban/bid the engine is offering, so
           showing both would be offering two different answers to the same question. -->
        <div v-if="analysisSeedActive" class="d-flex flex-wrap align-content-stretch faction-picker-buttons">
          <div v-for="choice in analysisFactionChoices" :key="choice.faction" class="move-button">
            <b-btn
              :class="['mr-2', 'mb-2', 'move-button']"
              :title="`Play the rest of round 0 and round 1 as ${choice.name}`"
              @click="$emit('analysis-seed-faction', choice.faction)"
            >
              <RichTextView :content="factionPickerLabel(choice.faction)" />
            </b-btn>
          </div>
        </div>
        <div v-else-if="!init" class="d-flex flex-wrap align-content-stretch">
          <MoveButton
            v-for="(button, i) in buttons"
            :class="{ 'd-none': button.hide, shown: !button.hide, disabled: button.disabled }"
            :ref="`button-${i}`"
            :data-ref="`button-${i}`"
            :button="button"
            :controller="controller"
            :key="(button.label || button.command) + '-' + i"
          />
          <div v-if="canUndo" key="back-button" class="move-button">
            <b-btn :class="['mr-2', 'mb-2', 'move-button']" @click="undo">
              <template>
                <Undo transform="scale(1.2)" />
              </template>
            </b-btn>
          </div>
        </div>
        <div v-if="showAnalysisChargeButtons" class="analysis-simulation">
          <span class="analysis-simulation__label">Simulation</span>
          <button
            type="button"
            class="analysis-simulation__button"
            title="Preview receiving 1 power charge. This is not a move or a premove condition."
            @click="$emit('analysis-charge')"
          >
            Simulate charge +1
          </button>
          <span v-if="analysisStatus && analysisStatus.chargedPower" class="analysis-simulation__total"
            >+{{ analysisStatus.chargedPower }} simulated</span
          >
          <button
            v-if="analysisCanUndoCharge"
            type="button"
            class="analysis-simulation__button"
            @click="$emit('analysis-undo-charge')"
          >
            Undo charge
          </button>
          <span class="analysis-simulation__hint">Preview only. Premoves use your actual resources.</span>
        </div>
        <div
          v-if="isChoosingFaction && !analysisSeedActive"
          class="d-flex flex-wrap align-content-stretch faction-picker-buttons"
        >
          <MoveButton
            v-for="faction in factionsToChoose.data"
            :button="{
              command: `${factionsToChoose.name} ${faction}`,
              modal: factionInfoModal(faction),
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
        <div
          v-if="isBanningFaction && !analysisSeedActive"
          class="d-flex flex-wrap align-content-stretch faction-picker-buttons"
        >
          <MoveButton
            v-for="faction in factionToBan.data"
            :button="{
              command: `${factionToBan.name} ${faction}`,
              modal: factionInfoModal(faction, 'OK, I ban this one!'),
              richText: factionPickerLabel(faction),
              shortcuts: [factionShortcut(faction)],
            }"
            :controller="controller"
            :key="faction"
          />
        </div>
        <!-- Legacy only. The Silent Auction's bid round is simultaneous as of 2026-08-12 and its form
           is SilentAuctionBid.vue, up in Game.vue's round-0 strip - see `isSilentBidding`, which is
           true only for a hosted game that had already started recording its bids one seat at a
           time when that changed, and which therefore has to finish that way. -->
        <div v-if="isSilentBidding && !analysisSeedActive" class="silent-bid-form">
          <p class="text-muted small">
            Privately enter the most VP you're willing to pay for each faction - bid highest on the one you want most,
            and 0 on one you'd only take for free. Bids stay hidden until everyone has submitted, then the auction
            resolves automatically. You never pay more than you bid, and usually a lot less.
          </p>
          <!-- The faction is a real button (FactionSheetButton) rather than a label, so the three
             factions being bid on can actually be read before committing VP to them - the picker
             that normally offers that is long gone by this phase. The name column is a fixed width
             so every bid input lines up, whatever the names are. -->
          <div v-for="pos in silentBidCommand.data.bids" :key="pos.faction" class="d-flex align-items-center mb-2">
            <FactionSheetButton :faction="pos.faction" class="silent-bid-faction mr-2" />
            <b-form-input
              type="number"
              min="0"
              :max="pos.bid[pos.bid.length - 1]"
              v-model.number="silentBidValues[pos.faction]"
              :aria-label="`Your bid for ${factionName(pos.faction)}`"
              class="silent-bid-input"
            />
          </div>
          <b-btn variant="primary" class="silent-bid-submit" @click="submitSilentBid">Submit bids</b-btn>
        </div>
        <!-- Placed last (below the action buttons, at the very bottom of the sticky bar) - see the
           .sticky-resource-bar-row CSS for the divider separating it from the buttons above and the
           extra bottom clearance keeping it clear of the screen's rounded bottom corners. -->
        <StickyResourceBar v-if="showResourceBar" :player="myPlayer" class="sticky-resource-bar-row" />
      </template>
      <p v-else-if="analysisMode" class="small text-muted mt-2 mb-0" role="status">
        This preview has no action available. You can switch plans, undo a move, clear the plan or return to the live
        game.
      </p>
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
import Engine, {
  AdvTechTilePos,
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
  SpaceMap,
  Spaceship,
  TechTilePos,
} from "@gaia-project/engine";
import type { FactionCustomization } from "@gaia-project/engine/src/engine";
import { factionVariantBoard } from "@gaia-project/engine/src/faction-boards";
import { CubeCoordinates } from "hexagrid";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ActionPayload, SubscribeActionOptions, SubscribeOptions } from "vuex";
import type {
  ButtonData,
  GameContext,
  HexSelection,
  HighlightHex,
  ModalButtonData,
  SpecialActionIncome,
} from "../data";
import { WarningsPreference } from "../data";
import { factionPortraitHtml } from "../data/faction-art";
import { factionName, factionShortcut } from "../data/factions";
import { enabledButtonWarnings, isWarningEnabled } from "../data/warnings";
import type { RichText } from "../graphics/rich-text";
import { richText } from "../graphics/rich-text";
import { factionColor } from "../graphics/utils";
import type { AnalysisCommitPlan, AnalysisEntry, AnalysisLineSummary, AnalysisStatus } from "../logic/analysis";
import { encodeAutoChargePreference } from "../logic/auto-decide";
import { autoClickStrategy } from "../logic/buttons/autoClick";
import { commandButtons, replaceRepeat } from "../logic/buttons/commands";
import { selectCustomFederation } from "../logic/buttons/federation";
import type { CommandController, FastConversionTooltips } from "../logic/buttons/types";
import { ExecuteBack } from "../logic/buttons/types";
import { buttonStringLabel, callOnShow } from "../logic/buttons/utils";
import { isLegacySequentialBidRound } from "../logic/sealed-bid";
import { supportsHoverTooltips } from "../logic/tooltip";
import { isTypingTarget } from "../logic/typing-target";
import { chargePowerToPay } from "../logic/utils";
import type { ZoomCompensationHandle } from "../logic/zoom-compensation";
import { attachZoomCompensation } from "../logic/zoom-compensation";
import AnalysisCommitConfirm from "./AnalysisCommitConfirm.vue";
import AnalysisHeaderControls from "./AnalysisHeaderControls.vue";
import AnalysisLineTabs from "./AnalysisLineTabs.vue";
import AnalysisModeInfo from "./AnalysisModeInfo.vue";
import AnalysisMoves from "./AnalysisMoves.vue";
import AutoChargeControl from "./AutoChargeControl.vue";
import FactionInfoCard from "./FactionInfoCard.vue";
import FactionSheetButton from "./FactionSheetButton.vue";
import MoveButton from "./MoveButton.vue";
import RichTextView from "./Resources/RichTextView.vue";
import Undo from "./Resources/Undo.vue";
import StickyResourceBar from "./StickyResourceBar.vue";

let show = false;

const statusLineSeparator = " - ";

/** The round-0 phases whose action area belongs in the frozen bottom bar on mobile - see
 * `showStickyMobileBar` for why faction ban/pick/bid are not among them. */
const STICKY_SETUP_PHASES: Phase[] = [Phase.SetupBoard, Phase.SetupBuilding, Phase.SetupBooster];

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
    factionInfoModal(faction: Faction, okTitle?: string): ModalButtonData {
      return {
        title: factionName(faction),
        component: FactionInfoCard,
        props: {
          faction,
          variant: factionVariantBoard(this.factionCustomization, faction)?.board,
          expansion: this.engine.expansions,
        },
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
        modal: this.factionInfoModal(faction),
      };
    },
  },
  components: {
    AutoChargeControl,
    RichTextView,
    StickyResourceBar,
    MoveButton,
    FactionSheetButton,
    Undo,
    AnalysisHeaderControls,
    AnalysisLineTabs,
    AnalysisCommitConfirm,
    AnalysisModeInfo,
    AnalysisMoves,
  },
})
export default class Commands extends Vue implements CommandController {
  @Prop({ default: true })
  autoChargeEnabled: boolean;

  @Prop({ default: true })
  actionsEnabled: boolean;

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

  /** Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §5) - true for the whole time the board is
   * taken over, since the
   * striped header must read "not live" from the moment of entry through every turn played inside
   * it. Drives the header stripes (§5.1), replaces the auto-leech slot with the counter headline
   * (§2.9/§5.3), and makes tapping the header exit (§5.4). */
  @Prop({ default: false })
  analysisMode: boolean;

  @Prop({ default: false })
  analysisOffered: boolean;

  /** §12's compact status - the overdraft summary and assumed power, the two things the player board
   * cannot show for itself. Only ever set while analysisMode is also true. */
  @Prop({ default: null })
  analysisStatus: AnalysisStatus | null;

  /** How many entries the analysis line holds, for the header's move count and its Undo/Reset gating. */
  @Prop({ default: 0 })
  analysisMoveCount: number;

  @Prop({ default: false })
  analysisCanEdit: boolean;

  @Prop({ default: false })
  analysisCanUndoCharge: boolean;

  /** One summary per line for the tab strip (§13) - see Game.vue's `analysisLineSummaries`. Empty
   * whenever analysis mode is off, since the strip is only rendered inside it. */
  @Prop({ default: () => [] })
  analysisLineSummaries: AnalysisLineSummary[];

  /** Index into `analysisLineSummaries` of the line currently on the board. */
  @Prop({ default: 0 })
  analysisActiveLine: number;

  @Prop({ default: () => [] })
  analysisEntries: AnalysisEntry[];

  @Prop({ default: 0 })
  analysisAppliedCount: number;

  @Prop({ default: -1 })
  analysisEditingIndex: number;

  @Prop({ default: false })
  analysisInsertingMove: boolean;

  get analysisEditActive(): boolean {
    return this.analysisEditingIndex >= 0;
  }

  get analysisEditingMove(): string {
    const entry = this.analysisEntries[this.analysisEditingIndex];
    return entry?.kind === "move" ? entry.move : entry?.kind === "adjust" ? `Assume ${entry.charge} power charged` : "";
  }

  get analysisEditingMoveNumber(): number {
    return this.analysisEntries.slice(0, this.analysisEditingIndex).filter((entry) => entry.kind === "move").length + 1;
  }

  /** How many of those moves could actually be played for real (§6), gating the Commit button. */
  @Prop({ default: 0 })
  analysisCommittableMoves: number;

  /** What Commit is about to do, for the confirmation modal - see Game.vue's `analysisCommitPlan`.
   * Only that modal reads it; the button itself is gated on the count above. */
  @Prop({ default: null })
  analysisCommitPlan: AnalysisCommitPlan | null;

  /** §11's round-0 faction seed options (Game.vue's `analysisFactionChoices`) - empty every time the
   * sandbox clone is past faction selection, which is every case except a round-0 entry that has not
   * seeded yet. Non-empty is what puts this action area into "choose a faction" mode. */
  @Prop({ default: () => [] })
  analysisFactionChoices: { faction: Faction; name: string }[];

  /** Whether the round-0 faction seed is the one thing this action area is for right now. The
   * `analysisMode` half is not redundant: `analysisFactionChoices` is only ever populated during
   * sandbox mode, but reading both keeps the takeover explicit at every use site. */
  get analysisSeedActive(): boolean {
    return this.analysisMode && this.analysisFactionChoices.length > 0;
  }

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
        // The form is SilentAuctionBid.vue, up in Game.vue's round-0 strip - every seat bids at
        // once, so it cannot live in this on-turn-only panel. Just say where it is (unless this is
        // one of the legacy sequential games that still bids from right here).
        this.title(
          this.isSilentBidding ? "Submit your Silent Auction bids" : "Submit your secret bids in the panel above"
        );
        this.silentBidValues = Object.fromEntries(command.data.bids.map((pos) => [pos.faction, 0]));
        return;
      }
      if (command.name === Command.PreferenceBid) {
        // The form itself is PreferenceSplitBid.vue, up in Game.vue's round-0 strip - every seat
        // bids at once, so it cannot live in this on-turn-only panel. Just say where it is.
        this.title("Split your bid points in the panel above");
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

  /**
   * Only the legacy turn-by-turn Silent Auction still bids from this panel. Every other case -
   * a hosted game that started bidding after migration 20260812130000, and all offline/hot-seat
   * play - goes through SilentAuctionBid.vue instead, which renders for every seat at once rather
   * than just the one the engine's turn pointer names.
   */
  get isSilentBidding() {
    return !!this.silentBidCommand && !!this.$store.state.sealedBidBackend && isLegacySequentialBidRound(this.engine);
  }

  /** Commit asks first (ANALYSIS_MODE_PLAN.md §6) - it is the only sandbox control whose effect
   * reaches the real game, where the sandbox's own Undo does not follow, and it clears the line on
   * the way out. The modal is what emits `analysis-commit`; this only opens it. */
  requestAnalysisCommit() {
    this.$bvModal.show("analysis-commit-confirm");
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

  /**
   * Frozen bottom action bar on mobile. Round 1+ unconditionally, plus - since the owner asked for
   * it - the round-0 phases whose buttons you press to put something on the board or take a tile:
   * board rotation, the starting mines, and the round booster. Those are exactly the presses that
   * pair with looking at the map, and having them scroll away below it was the same problem the bar
   * exists to solve in the first place.
   *
   * Faction ban, faction pick, the auction bids and sandbox mode's own faction seed are deliberately
   * excluded (owner instruction). They are wide, richly-labelled rows with their own info modals and
   * shortcut keys, read once and answered once - pinning them into a short scrolling strip at the
   * bottom of the screen makes them harder to read rather than easier, and none of them needs the
   * map on screen at the same time.
   *
   * The `buttons.length` check is what "when there are any buttons to be pressed" means literally:
   * a phase in the list with nothing to press must not pin an empty bar to the bottom of the screen.
   * Reading the `buttons` getter here is safe despite its own writes to `allButtons` /
   * `preventFirstAutoClick` - it is a cached computed the template already evaluates every render,
   * and neither field feeds anything reactive.
   */
  get showStickyMobileBar(): boolean {
    if (
      this.init ||
      this.isChoosingFaction ||
      this.isBanningFaction ||
      this.isSilentBidding ||
      this.analysisSeedActive
    ) {
      return false;
    }
    if (this.engine.round >= 1) {
      return true;
    }
    return STICKY_SETUP_PHASES.includes(this.engine.phase) && this.buttons.length > 0;
  }

  /** Auto-charge is a per-round-action preference - hide it during player-count/faction-picking/
   * banning/silent-auction-bidding/initial-building setup, same "round 1+" boundary as
   * showStickyMobileBar, so it doesn't show before there's anything to leech from. Also meaningless
   * during analysis mode (§2.9) - opponent decisions are auto-resolved there regardless of this
   * preference - which is what frees up that slot for the counter headline instead (§5.3). */
  get showAutoLeechSelect(): boolean {
    return (
      !this.analysisMode &&
      this.autoChargeEnabled &&
      this.engine.round >= 1 &&
      !this.engine.ended &&
      (!this.$store.state.hosted ||
        (!!this.$store.state.playerSettings && this.$store.state.player?.index !== undefined))
    );
  }

  /** The viewing user's own player (not necessarily whoever's turn it is), same "viewing seat"
   * lookup used elsewhere (e.g. FactionWheel.vue, BoardAction.vue) - falls back to the active
   * player in self-contained/hot-seat mode, where there's no separate logged-in seat. */
  get myPlayer(): Player | null {
    const index = this.$store.state.player?.index ?? this.engine.currentPlayer;
    return index == null ? null : this.engine.players[index];
  }

  /** Same "has the game actually started" gating as the auto-leech select, but not its
   * `!analysisMode` exclusion - the resource bar is a plain readout of the player board (credits/
   * power bowls/etc), not a per-round preference, so sandbox mode should keep showing it exactly
   * like normal play instead of losing it to the counter headline the way auto-leech does. */
  get showResourceBar(): boolean {
    return (
      !this.init &&
      !this.isChoosingFaction &&
      !this.isBanningFaction &&
      !this.isSilentBidding &&
      this.engine.round >= 1 &&
      !!this.myPlayer?.faction
    );
  }

  /** Live-tracked rendered height of #move-buttons (already capped by its own CSS max-height +
   * overflow-y:auto), so the layout spacer below it reserves exactly that much space - not a
   * blanket max-height's worth of blank page whenever the button list is short. */
  private stickyBarHeight = 0;
  private stickyBarObserver: ResizeObserver | null = null;

  private zoomCompensation: ZoomCompensationHandle | null = null;

  get titles() {
    if (!this.actionsEnabled && !this.analysisMode) return [`Playing - Round ${this.engine.round}`];
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
    return [richText(factionPortraitHtml(faction, 28) + this.factionName(faction))];
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
      const commands: string[] = command.startsWith(Command.Decline)
        ? [command]
        : [...this.commandChain.filter((c) => c), command];
      this.$emit("command", `${this.playerSlug} ${commands.join(" ")}`, warnings);
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

  autoChargePreference(): string {
    return encodeAutoChargePreference(
      String(
        this.$store.state.hosted
          ? (this.$store.state.playerSettings?.autoCharge ?? "ask")
          : (this.$store.state.preferences.autoChargePower ?? "ask")
      ),
      String(
        this.$store.state.hosted
          ? (this.$store.state.playerSettings?.autoChargeMaxPassedRoundLeech ?? "0")
          : (this.$store.state.preferences.autoChargeMaxPassedRoundLeech ?? "0")
      )
    );
  }

  enabledButtonWarnings(button: ButtonData): string[] {
    return enabledButtonWarnings(button, this.$store.state.preferences);
  }

  get buttons(): ButtonData[] {
    if (!this.actionsEnabled) return [];
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
    // The mandatory setup building is opened automatically. Returning from its destination list
    // would only show that same building button; keep Back once a destination has been selected.
    if (this.engine.phase === Phase.SetupBuilding && this.buttonChain.length === 1 && this.buttonChain[0].hexes) {
      return false;
    }
    return this.$store.getters.canUndo;
  }

  /**
   * Sandbox mode's Charge 1 / Undo Charge belong on the action area's TOP-LEVEL round-move menu -
   * the one carrying Build, Explore, Research, Special action - and nowhere else (owner
   * instruction). They used to render beside whatever this container happened to be showing, which
   * put "give yourself 1 charged power" on screen while the player was picking a round booster.
   *
   * Two conditions, because "the main menu" is two separate facts:
   *
   * - `buttonChain.length === 0` is what top level means literally - the chain is the drill-down
   *   stack (`handleButtonClick` pushes, `back` pops), so anything above 0 is a sub-menu: the hexes
   *   under Build, the tiles under a tech action, the booster list under Pass.
   * - `Phase.RoundMove` keeps them off every other prompt that renders through this same container
   *   at chain depth 0 - the round-0 booster pick, income and leech decisions, the faction/ban/bid
   *   rounds. None of those is a menu where topping your power up first means anything.
   */
  get showAnalysisChargeButtons(): boolean {
    return this.analysisMode && this.engine.phase === Phase.RoundMove && this.buttonChain.length === 0;
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
      // Escape dismisses whatever text field has focus (or its autocomplete) before it means
      // "undo my move" - see logic/typing-target.ts.
      if (!this.actionsEnabled || isTypingTarget(e.target)) {
        return;
      }
      if (e.key == "Escape" && this.canUndo) {
        this.undo();
      }
    };
    window.addEventListener("keydown", keyListener);

    const backListener = this.$store.subscribeAction(({ type, payload }) => {
      if (type === "back") {
        this.back(payload as ExecuteBack);
      } else if (type === "selectFederation") {
        this.clearContext();
        this.loadCommands(this.availableCommands);
        selectCustomFederation(this.engine, this, payload);
      }
    });

    const moveButtons = this.$refs.moveButtons as HTMLElement;

    // Pinch-zooming the game board (allowed on purpose - see logic/viewport.ts) also scales any
    // `position: fixed` element, since native pinch-zoom enlarges the whole layout viewport
    // including fixed content - a fixed bottom bar visibly balloons in size along with the map
    // instead of staying put. The VisualViewport API reports the zoomed-in "visual" viewport
    // separately from the unchanged "layout" viewport `position: fixed` actually anchors to, so a
    // counter-transform (shrink back by 1/scale, then re-anchor to the visual viewport's own
    // bottom-left corner) keeps the bar's on-screen size and position constant regardless of zoom.
    //
    // ALL of it - the arithmetic, the listeners, the self-healing that stops a stale transform from
    // floating this bar mid-screen - lives in logic/zoom-compensation.ts.
    // This component only owns when to re-measure.
    if (moveButtons) {
      this.zoomCompensation = attachZoomCompensation({
        element: moveButtons,
        isStickyMobile: () => this.showStickyMobileBar,
      });
    }

    if (moveButtons && typeof ResizeObserver !== "undefined") {
      this.stickyBarObserver = new ResizeObserver(() => {
        // read the full border-box (incl. padding) so the spacer reserves the bar's real footprint
        this.stickyBarHeight = moveButtons.getBoundingClientRect().height;
        this.$emit("sticky-bar-height", this.showStickyMobileBar ? this.stickyBarHeight : 0);
        // Covers #move-buttons first becoming the fixed sticky bar (e.g. once round 1 starts),
        // which isn't itself a visualViewport event.
        this.zoomCompensation?.update();
      });
      this.stickyBarObserver.observe(moveButtons);
    }

    this.$on("hook:beforeDestroy", () => {
      window.removeEventListener("keydown", keyListener);
      backListener();
      this.stickyBarObserver?.disconnect();
      this.zoomCompensation?.destroy();
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
    return supportsHoverTooltips();
  }

  highlightResearchTiles(tiles: string[]) {
    this.$store.commit("highlightResearchTiles", tiles);
  }

  highlightTechs(techs: Array<TechTilePos | AdvTechTilePos | Spaceship>) {
    this.$store.commit("highlightTechs", techs);
  }

  subscribe(
    action: string,
    button: ButtonData,
    callback: (payload: any) => any,
    filter: (payload: any) => boolean = null
  ) {
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

  subscribeHexClick(
    button: ButtonData,
    callback: (hex: GaiaHex, highlight: HighlightHex) => void,
    filter?: (hex: GaiaHex) => boolean
  ) {
    const heightFilter = () => {
      return this.buttonChain.length == button.parents;
    };
    this.subscribe(
      "hexClick",
      button,
      (payload) => {
        callback(payload.hex, payload.highlight);
      },
      (payload) => (filter ? filter(payload.hex) : true) && heightFilter()
    );
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
    button.buttons?.forEach((b) => this.unsubscribe(b));
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
    return (
      this.enabledButtonWarnings(button).length > 0 &&
      !this.isActiveButton(button) &&
      this.warningPreference === WarningsPreference.ModalDialog
    );
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
// The planning header stays distinct from a live turn without covering it in hazard stripes.
$planning-background: var(--ui-surface-muted);
$planning-accent: var(--ui-warning-border);

#move-title:not(.move-title--analysis) {
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  padding: 0.5rem 0 0.75rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--ui-border);

  h5 {
    font-size: 1.1rem;
    line-height: 1.4;
  }
}

.turn-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-left: auto;

  .planning-entry,
  .auto-leech-select > .btn {
    min-height: 2.25rem;
    padding: 0.35rem 0.65rem;
    font-size: 0.875rem;
    line-height: 1.4;
    white-space: nowrap;
    border-radius: 6px;
    color: var(--ui-text);
    border-color: var(--ui-border-strong);
    background: linear-gradient(180deg, var(--ui-keycap-gradient-start), var(--ui-keycap-gradient-end));
    box-shadow: 0 1px 2px var(--ui-shadow-soft);

    &:hover,
    &:focus {
      color: var(--ui-text);
      background: var(--ui-surface-hover);
      border-color: var(--ui-border-strong);
    }
  }
}

// One fixed-width column for the faction buttons and one for the number boxes, so the bid inputs
// line up instead of stepping in and out with each faction name's length.
.silent-bid-faction {
  flex: 0 0 11rem;
  max-width: 11rem;
}

.silent-bid-input {
  width: 6rem;
  flex: 0 0 6rem;
}

.faction-picker-buttons {
  .move-button .btn {
    border-radius: 12px;
    border-color: var(--ui-border-strong);
    background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
    color: var(--ui-secondary-text);
    box-shadow: 0 1px 2px var(--ui-shadow-soft);
    font-weight: 600;
  }

  .move-button i.planet::before {
    font-size: 18px;
  }
}

i.planet {
  &::before {
    content: "\25cf";

    .player-info & {
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

// Frozen bottom action bar on mobile (round 1+, plus round 0's board-rotation/starting-mine/booster
// phases - see Commands.vue's showStickyMobileBar) - keeps the buttons reachable without scrolling
// back up to the top of the page.
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
  border-top: 1px solid var(--ui-border);
}

// Keep the planning heading separate from the game controls below it.
#move-title.move-title--analysis {
  background: $planning-background;
  color: var(--ui-text);
  border: 1px solid var(--ui-border);
  border-left: 3px solid $planning-accent;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.7rem 0.85rem;
  margin-bottom: 0.65rem;
  border-radius: 8px;

  h5 {
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.4;
    margin: 0;
  }
}

// Full-width status header for the mobile action tray.
#move-buttons .sticky-bar-title {
  display: none !important;
  position: relative;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: calc(-0.7rem) calc(-0.5rem - env(safe-area-inset-right)) 0.65rem calc(-0.5rem - env(safe-area-inset-left));
  padding: 0.6rem calc(0.7rem + env(safe-area-inset-right)) 0.6rem calc(0.7rem + env(safe-area-inset-left));
  border-radius: 16px 16px 0 0;
  background: linear-gradient(135deg, var(--ui-banner-start) 0%, var(--ui-banner-end) 100%);
  color: var(--ui-banner-text);

  // Match the desktop planning heading in the mobile action tray.
  &--analysis {
    background: $planning-background;
    border-left: 3px solid $planning-accent;
    color: var(--ui-text);
    gap: 0.6rem;
    flex-wrap: wrap;
    padding-top: 0.65rem;
    padding-bottom: 0.65rem;
    margin-bottom: 0.65rem;
  }

  // Small enough that the status text stays on one (or two, at most) lines instead of the default
  // h5 size wrapping across several - that wrapping used to be what made this banner so tall.
  h5 {
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.2;
    color: inherit;
  }

  &--analysis h5 {
    display: inline-block;
    background: transparent;
    color: var(--ui-text);
    padding: 0;
    border-radius: 4px;
  }

  .turn-tools {
    flex-basis: 100%;
    margin-left: 0;

    .planning-entry,
    .auto-leech-select > .btn {
      min-height: 2.5rem;
    }
  }

  // Keep the open menu above the sticky tray's other controls.
  .auto-leech-select .dropdown-menu {
    z-index: 1050;
  }
}

// Separate the plan tabs from the heading and game controls.
#move .analysis-tabs {
  position: relative;
  z-index: 1;
  margin: 0.45rem 0 0.55rem;
}

#move-buttons .analysis-tabs--sticky {
  // Hidden by default and shown only inside the mobile media query, exactly as `.sticky-bar-title`
  // itself is. This is NOT inherited any more: the strip used to be a child of that band and went
  // wherever it went, and is a sibling now - without this rule a desktop viewport would render the
  // sticky copy (its `v-if` is `showStickyMobileBar`, which is phase-gated in JS, not viewport-gated)
  // on top of the desktop copy, i.e. two line strips at once.
  display: none !important;
  margin: 0 0 0.55rem;
}

#move-buttons .sticky-bar-title--analysis {
  margin-top: 0;
}

.analysis-counter-headline {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.82);
  color: #fff;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: default;

  &__negative {
    color: #ff8a80;
  }

  &__infeasible {
    color: #ff8a80;
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
    background: linear-gradient(180deg, var(--ui-panel-gradient-start) 0%, var(--ui-panel-gradient-end) 100%);
    box-shadow:
      0 -12px 28px var(--ui-shadow),
      0 -1px 0 var(--ui-divider-highlight);

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
      border-color: var(--ui-border-strong);
      box-shadow: 0 1px 2px var(--ui-shadow-soft);
      padding-top: 0.3rem;
      padding-bottom: 0.3rem;
      transition:
        transform 0.08s ease-out,
        box-shadow 0.08s ease-out;

      &:active {
        transform: scale(0.97);
        box-shadow: inset 0 1px 2px var(--ui-shadow);
      }
    }

    .btn-secondary:not(.active):not(.warning) {
      background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
      color: var(--ui-secondary-text);
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

  // ...and §13's strip goes with it. It is a SIBLING of #move-title now rather than a child, so the
  // rule above no longer reaches it - without this, the desktop copy of the tabs would be left
  // stranded above the hidden header while the sticky sheet renders its own copy at the bottom.
  .analysis-tabs.hide-on-mobile-sticky {
    display: none !important;
  }

  // The other half of that swap: the sticky copy is display:none everywhere else (see its rule
  // above), and this is the one place it is shown.
  #move-buttons .analysis-tabs--sticky {
    display: flex !important;
  }

  #move-buttons.mobile-sticky-actions--sandbox {
    background: linear-gradient(180deg, var(--ui-panel-gradient-start) 0%, var(--ui-panel-gradient-end) 100%);
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

<style scoped lang="scss">
.analysis-replace {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  margin-bottom: 0.65rem;
  border-left: 3px solid var(--ui-info-text);
  border-radius: 4px;
  background: var(--ui-surface-muted);
  font-size: 0.85rem;
}
.analysis-replace__original {
  flex: 1 1 12rem;
  min-width: 0;
  overflow-wrap: anywhere;
}
.analysis-replace__label {
  color: var(--ui-text-muted);
}
.analysis-replace__title {
  display: block;
  margin-bottom: 0.25rem;
}
.analysis-replace__actions {
  display: flex;
  gap: 0.4rem;
  margin-left: auto;
}

.analysis-simulation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  border-top: 1px solid var(--ui-border);
  margin-top: 0.3rem;
  padding: 0.65rem 0;
  color: var(--ui-text-muted);
  font-size: 0.8rem;
}
.analysis-simulation__label {
  font-weight: 600;
}
.analysis-simulation__button {
  border: 0;
  background: transparent;
  color: var(--ui-info-text);
  padding: 0.15rem 0;
  font: inherit;
  &:hover {
    text-decoration: underline;
  }
}
.analysis-simulation__hint {
  flex-basis: 100%;
  font-size: 0.75rem;
}
.analysis-simulation__total {
  color: var(--ui-info-text);
}
</style>
