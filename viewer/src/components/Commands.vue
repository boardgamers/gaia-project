<template>
  <div id="move">
    <div
      id="move-title"
      class="d-flex align-items-center"
      :class="{ 'hide-on-mobile-sticky': showStickyMobileBar, 'move-title--analysis': analysisMode }"
    >
      <!-- The sandbox's line strip (§13), on top of the header exactly as it reads: the header wraps
           while analysis mode is on and this claims the whole first row (see .analysis-tabs's
           flex-basis below), so the tabs sit above the status line and its controls rather than
           competing with them for the one row. Same component, same placement, in the mobile sticky
           band below - the two headers are the same surface on different viewports. -->
      <AnalysisLineTabs
        v-if="analysisMode"
        :lines="analysisLineSummaries"
        :active="analysisActiveLine"
        @select="$emit('analysis-select-line', $event)"
        @add="$emit('analysis-add-line')"
        @close="$emit('analysis-close-line', $event)"
      />
      <h5 class="mb-0">
        <span v-if="init">Pick the number of players</span>
        <!-- Desktop's counterpart of the sticky band below: the bar is in flow here, so this is
             where a compose takeover has to announce itself. Analysis mode wins over premove/
             cancel-trigger context since the three board-takeover modes are mutually exclusive
             (§3.6) - this is just the render-time ordering, not an extra exclusion check. -->
        <template v-if="analysisMode"
          >SANDBOX<template v-if="analysisSeedActive"> — choose a faction to play as</template></template
        >
        <template v-else-if="premoveContext">{{ premoveContext.title }}</template>
        <RichTextView v-else :content="statusLine" />
      </h5>
      <!-- The Silent Auction / ban-phase explainer buttons used to sit here. They now live in
           SetupStatus.vue's round-0 strip at the top of the page (Game.vue), which - unlike this
           panel - also renders for players who aren't on turn. Two copies would also register the
           same modal id twice. -->
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
      <!-- Analysis mode's controls take over the slot the auto-leech dropdown gives up (§2.9/§12) -
           opponent decisions are auto-resolved there regardless of that preference, and this is where
           the deleted yellow panel's counts and Commit now live (Undo/Reset moved on again, to the
           map's bottom-right corner beside the sandbox toggle - see SpaceMap.vue). -->
      <AnalysisHeaderControls
        v-else-if="analysisMode"
        :move-count="analysisMoveCount"
        :status="analysisStatus"
        :committable-moves="analysisCommittableMoves"
        @commit="requestAnalysisCommit"
      />
    </div>
    <AnalysisModeInfo v-if="analysisMode" />
    <!-- Commit's confirmation step, rendered here for the same once-per-page reason as the info modal
         above. The Commit button only opens it; nothing leaves the sandbox until this is confirmed. -->
    <AnalysisCommitConfirm
      v-if="analysisMode"
      :plan="analysisCommitPlan"
      :line-count="analysisLineSummaries.length"
      @confirm="$emit('analysis-commit')"
    />
    <div id="move-buttons" ref="moveButtons" :class="{ 'mobile-sticky-actions': showStickyMobileBar }">
      <!-- Same status line as #move-title above, shown only inside the mobile sticky bar (once it's
           actually pinned, i.e. narrow viewports - see the .sticky-bar-title/.hide-on-mobile-sticky
           CSS) - freeing up the space #move-title used to occupy alone on mobile wherever the bar is
           pinned, instead of duplicating it on screen. Placed first (above the action buttons) so
           whose-turn/what's-happening is the first thing read when the bar comes into view, not
           buried below a scrollable list of buttons. -->
      <div
        v-if="showStickyMobileBar"
        class="sticky-bar-title d-flex align-items-center"
        :class="
          analysisMode
            ? 'sticky-bar-title--analysis'
            : premoveContext
            ? `sticky-bar-title--${premoveContext.variant}`
            : null
        "
      >
        <!-- While the board is taken over to compose a premove or a cancel rule, this band carries
             what that compose is FOR. It used to be an `alert` at the top of Game.vue's commands
             column - i.e. describing this bar from the other end of the page, usually scrolled out
             of sight on a phone. Amber for a cancel rule, the ordinary banner colour for a premove,
             hazard stripes for analysis (§5.1) - the board looks identical otherwise, and this is
             the one cue telling them apart. -->
        <AnalysisLineTabs
          v-if="analysisMode"
          :lines="analysisLineSummaries"
          :active="analysisActiveLine"
          @select="$emit('analysis-select-line', $event)"
          @add="$emit('analysis-add-line')"
          @close="$emit('analysis-close-line', $event)"
        />
        <h5 class="mb-0">
          <template v-if="analysisMode"
            >SANDBOX<template v-if="analysisSeedActive"> — choose a faction to play as</template></template
          >
          <template v-else-if="premoveContext">{{ premoveContext.title }}</template>
          <RichTextView v-else :content="statusLine" />
        </h5>
        <!-- No explainer buttons here either: the bar is never pinned during the ban/pick/bid phases
             (showStickyMobileBar excludes all three), so they could never show here. See
             SetupStatus.vue. -->
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
        <AnalysisHeaderControls
          v-else-if="analysisMode"
          :move-count="analysisMoveCount"
          :status="analysisStatus"
          :committable-moves="analysisCommittableMoves"
          @commit="requestAnalysisCommit"
        />
      </div>
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
        <!-- Wrapped in a `.move-button` div, exactly like MoveButton.vue's own root, and not merely
             given the class: the sticky bar's keycap styling is `.move-button .btn`, i.e. a
             DESCENDANT rule, so a b-btn that carries the class itself matches nothing and comes out
             with Bootstrap's square-ish default corners next to properly rounded neighbours. -->
        <!-- `key` on these three, and it is load-bearing, not tidiness (owner-reported bug, 2026-08-19).
             They are unkeyed sibling `v-if`s over the same `<div class="move-button">`, so Vue's
             `sameVnode` happily patches ONE INTO ANOTHER and reuses the same DOM `<button>`, swapping
             only its click invoker. Back is showing exactly when Charge 1 is not (`canUndo` vs
             `showAnalysisChargeButtons`), so pressing Back turned that element into Charge 1 - and
             because browsers run a microtask checkpoint between event listeners, Vue re-rendered
             mid-dispatch and the still-bubbling click then ran the NEW handler. One press of Back:
             one +1 power `adjust` entry, every time, in sandbox mode. Distinct keys make `sameVnode`
             false, so the element is destroyed and rebuilt instead of re-pointed. -->
        <div v-if="canUndo" key="back-button" class="move-button">
          <b-btn :class="['mr-2', 'mb-2', 'move-button']" @click="undo">
            <template>
              <Undo transform="scale(1.2)" />
            </template>
          </b-btn>
        </div>
        <!-- Sandbox-only power cheat: a plain button, pressable as many times as you like, that gives
             the sandbox seat 1 charged power per click (Game.vue's chargeAnalysisPower, an "adjust"
             entry - see analysis.ts). Undo Charge is the same idea in reverse: it only pops the line's
             last entry when that entry is itself a charge (Game.vue's undoAnalysisCharge), so it can
             never accidentally discard a real move. Both only on the top-level round-move menu - see
             `showAnalysisChargeButtons`. -->
        <div v-if="showAnalysisChargeButtons" key="analysis-charge" class="move-button">
          <b-btn
            :class="['mr-2', 'mb-2', 'move-button']"
            title="Sandbox: give yourself 1 charged power"
            @click="$emit('analysis-charge')"
          >
            Charge 1
          </b-btn>
        </div>
        <div v-if="showAnalysisChargeButtons" key="analysis-undo-charge" class="move-button">
          <b-btn
            :class="['mr-2', 'mb-2', 'move-button']"
            title="Sandbox: undo the last power charge"
            @click="$emit('analysis-undo-charge')"
          >
            Undo Charge
          </b-btn>
        </div>
      </div>
      <!-- The compose caveats ("build the move, then end the turn", the leech/income preview
           warnings, the cascade warning). Same block as the title above: they belong next to the
           buttons they qualify, not in a banner at the top of the page. -->
      <div v-if="premoveContext && premoveContext.notes.length > 0" class="premove-context-notes">
        <div v-for="(note, i) in premoveContext.notes" :key="i">{{ note }}</div>
      </div>
      <div v-if="showPremoveConfirm || showPremoveCancel" class="d-flex flex-wrap align-content-stretch">
        <b-btn
          v-if="showPremoveConfirm"
          :class="['mr-2', 'mb-2', 'move-button', 'premove-inline-action', 'premove-inline-action--confirm']"
          @click="$emit('confirm-premove')"
        >
          {{ premoveConfirmLabel }}
        </b-btn>
        <!-- "Discard", not "Cancel premove": this abandons what you are composing, while "Cancel
             if…" in the sheet ARMS a rule and "Remove" deletes a queued entry. Three unrelated
             actions all reading "cancel" is what made the flow ambiguous. -->
        <b-btn
          v-if="showPremoveCancel"
          :class="['mr-2', 'mb-2', 'move-button', 'premove-inline-action']"
          @click="$emit('cancel-premove')"
        >
          Discard
        </b-btn>
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
          Privately enter the most VP you're willing to pay for each faction - bid highest on the one you want most, and
          0 on one you'd only take for free. Bids stay hidden until everyone has submitted, then the auction resolves
          automatically. You never pay more than you bid, and usually a lot less.
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
import FactionSheetButton from "./FactionSheetButton.vue";
import FactionInfoCard from "./FactionInfoCard.vue";
import {
  ButtonData,
  GameContext,
  HexSelection,
  HighlightHex,
  ModalButtonData,
  SpecialActionIncome,
  WarningsPreference,
} from "../data";
import { factionName, factionShortcut } from "../data/factions";
import { FactionCustomization } from "@gaia-project/engine/src/engine";
import { factionVariantBoard } from "@gaia-project/engine/src/faction-boards";
import { enabledButtonWarnings, isWarningEnabled } from "../data/warnings";
import AnalysisHeaderControls from "./AnalysisHeaderControls.vue";
import AnalysisLineTabs from "./AnalysisLineTabs.vue";
import AnalysisCommitConfirm from "./AnalysisCommitConfirm.vue";
import AnalysisModeInfo from "./AnalysisModeInfo.vue";
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
import { isLegacySequentialBidRound } from "../logic/sealed-bid";
import { chargePowerToPay } from "../logic/utils";
import { attachZoomCompensation, ZoomCompensationHandle } from "../logic/zoom-compensation";
import { factionColor } from "../graphics/utils";
import { supportsHoverTooltips } from "../logic/tooltip";
import { isTypingTarget } from "../logic/typing-target";
import { AnalysisCommitPlan, AnalysisLineSummary, AnalysisStatus } from "../logic/analysis";

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
    RichTextView,
    StickyResourceBar,
    MoveButton,
    FactionSheetButton,
    Undo,
    AnalysisHeaderControls,
    AnalysisLineTabs,
    AnalysisCommitConfirm,
    AnalysisModeInfo,
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

  /** What this bar is being borrowed for, while the board is taken over to compose a premove or a
   * cancel rule (Game.vue's `premoveContext`). Null during ordinary play, when the bar shows the
   * game's own status line instead. Carrying it here rather than in a separate banner is what keeps
   * the whole premove flow on one surface. */
  @Prop({ default: null })
  premoveContext: { title: string; notes: string[]; variant: "premove" | "trigger" } | null;

  /** Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §5) - true for the whole time the board is
   * taken over, not just while a turn is mid-compose (unlike premoveContext above), since the
   * striped header must read "not live" from the moment of entry through every turn played inside
   * it. Drives the header stripes (§5.1), replaces the auto-leech slot with the counter headline
   * (§2.9/§5.3), and makes tapping the header exit (§5.4). */
  @Prop({ default: false })
  analysisMode: boolean;

  /** §12's compact status - the overdraft summary and assumed power, the two things the player board
   * cannot show for itself. Only ever set while analysisMode is also true. */
  @Prop({ default: null })
  analysisStatus: AnalysisStatus | null;

  /** How many entries the analysis line holds, for the header's move count and its Undo/Reset gating. */
  @Prop({ default: 0 })
  analysisMoveCount: number;

  /** One summary per line for the tab strip (§13) - see Game.vue's `analysisLineSummaries`. Empty
   * whenever analysis mode is off, since the strip is only rendered inside it. */
  @Prop({ default: () => [] })
  analysisLineSummaries: AnalysisLineSummary[];

  /** Index into `analysisLineSummaries` of the line currently on the board. */
  @Prop({ default: 0 })
  analysisActiveLine: number;

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

  /** Commit asks first (ANALYSIS_MODE_PLAN.md §6) - it is the only sandbox control whose effect
   * reaches the real game, where the sandbox's own Undo does not follow, and it clears the line on
   * the way out. The modal is what emits `analysis-commit`; this only opens it. */
  requestAnalysisCommit() {
    this.$bvModal.show("analysis-commit-confirm");
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

  /** Auto-leech is a per-round-action preference - hide it during player-count/faction-picking/
   * banning/silent-auction-bidding/initial-building setup, same "round 1+" boundary as
   * showStickyMobileBar, so it doesn't show before there's anything to leech from. Also meaningless
   * during analysis mode (§2.9) - opponent decisions are auto-resolved there regardless of this
   * preference - which is what frees up that slot for the counter headline instead (§5.3). */
  get showAutoLeechSelect(): boolean {
    return (
      !this.init &&
      !this.isChoosingFaction &&
      !this.isBanningFaction &&
      !this.isSilentBidding &&
      this.engine.round >= 1 &&
      !this.analysisMode
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
    return String(this.$store.state.preferences.autoChargePower ?? "ask");
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
      if (isTypingTarget(e.target)) {
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
    //
    // ALL of it - the arithmetic, the listeners, the self-healing that stops a stale transform from
    // floating this bar mid-screen - lives in logic/zoom-compensation.ts, shared byte-for-byte with
    // PremoveBar.vue's off-turn bar. Keeping a second copy of the wiring here is what let the two
    // bars drift apart last time; the only thing this component owns is when to re-measure.
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
// Sandbox mode's hazard stripes (ANALYSIS_MODE_PLAN.md §5.1), shared by the desktop #move-title and
// the mobile sticky band - two separate rules with two different box models, but there is no reason
// for them to drift apart on the one thing that has to look identical.
//
// Deliberately dimmer and lower-contrast than the original full-strength #1c1c1c/#f5c518 (owner
// instruction): at the size this banner actually renders, jet black against saturated warning yellow
// read as glare rather than as information, and the banner sits directly under the board for the
// whole time sandbox mode is on. A muted amber on a soft charcoal still says "hazard, not the live
// game" at a glance while being much easier to sit next to. Legibility of what is ON the stripes
// does not depend on them: every text run carries its own scrim.
$analysis-stripe-dark: #2e2e32;
$analysis-stripe-light: #c2a233;
$analysis-stripes: repeating-linear-gradient(
  45deg,
  $analysis-stripe-dark 0px,
  $analysis-stripe-dark 12px,
  $analysis-stripe-light 12px,
  $analysis-stripe-light 24px
);
// OPAQUE, not a translucent scrim (owner report, 2026-08-20). Every version of this was an alpha
// over the stripes - 0.82, then 0.72 - and at every one of them the diagonals still showed through
// the text backing, so the label read as a smear rather than as a chip: the complaint was not that
// the contrast ratio was low (white on the 0.72 blend measures ~9:1) but that the text sits on a
// moving pattern. A solid fill removes the pattern from behind the glyphs entirely; the stripes are
// still the whole rest of the bar, so nothing about the hazard treatment is lost.
$analysis-scrim: #1b1b20;

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
  border-color: var(--ui-border-strong);
  box-shadow: 0 1px 2px var(--ui-shadow-soft);

  &--confirm {
    background: linear-gradient(180deg, var(--ui-primary-hover) 0%, var(--ui-primary) 100%);
    border-color: var(--ui-primary);
  }
}

// The compose caveats. Unlike the title band above these are NOT sticky-bar-only: on desktop the
// bar is in flow and there is no band to carry them, so they are the only place the caveats appear.
.premove-context-notes {
  font-size: 0.72rem;
  line-height: 1.35;
  color: var(--ui-text-muted);
  margin-bottom: 0.4rem;

  > div + div {
    margin-top: 0.15rem;
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

// Analysis mode on desktop (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §5.1): the standalone #move-title
// never becomes the mobile sticky bar's #move-buttons band above, so without its own striping,
// desktop would be the one place analysis mode looked like live play. Same stripes/scrim/click-to-
// exit as the mobile band's &--analysis variant - kept as a standalone rule (not shared via a mixin)
// since #move-title's own box model (in-flow, no grab handle, no border-radius) differs enough that
// a shared mixin would need as many overrides as it saved.
#move-title.move-title--analysis {
  background: $analysis-stripes;
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  // Lets §13's line strip take a row of its own above the status line without either header having
  // to change flex-direction - the strip's own `flex: 0 0 100%` below is what claims that row, and
  // an `align-items: center` row simply centres each wrapped line within its own line box. Doing it
  // this way keeps every existing rule on these two headers (both of which are `d-flex
  // align-items-center` in the markup) working exactly as before whenever analysis mode is off.
  flex-wrap: wrap;

  h5 {
    display: inline-block;
    background: $analysis-scrim;
    color: #fff;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    margin: 0;
  }
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
  background: linear-gradient(135deg, var(--ui-banner-start) 0%, var(--ui-banner-end) 100%);
  color: var(--ui-banner-text);

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

  // Amber while composing a cancel rule, so the takeover is distinguishable from composing an
  // ordinary premove - the board itself looks identical in both. Matches PremoveBar's own
  // `__band--amber`, since the two bands are halves of the same flow.
  &--trigger {
    background: linear-gradient(135deg, #a97514 0%, #8a6410 100%);
  }

  // Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §5.1) - hazard stripes, since this is the
  // ONE header state where the board underneath is genuinely not the live game. Stripes live in
  // `background` (not `::before`, which is the grab handle above - §2.9) so the two never fight for
  // the same layer. Clickable to exit (§5.4) - the map-anchored control can scroll off-screen on
  // mobile, so the header is the reliable way out.
  &--analysis {
    background: $analysis-stripes;
    cursor: pointer;
    flex-wrap: wrap;
    // Clears the grab handle this band draws at its own top edge (the ::before above) - the line
    // strip is now the first thing in the band, and without this the tabs' rounded tops run into it.
    padding-top: 0.9rem;
  }

  // Small enough that the status text stays on one (or two, at most) lines instead of the default
  // h5 size wrapping across several - that wrapping used to be what made this banner so tall.
  h5 {
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.2;
    color: inherit;
  }

  // Raw text directly on the diagonal stripes above is unreadable either color it uses - a solid
  // scrim behind just the text (not the whole bar, which would hide the stripes entirely) keeps
  // both legible at once.
  &--analysis h5 {
    display: inline-block;
    background: $analysis-scrim;
    color: #fff;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  // Sandbox mode's own controls opt OUT of the translucent treatment below and keep the solid keycap
  // surface AnalysisHeaderControls.vue gives them. Without this exclusion that rule wins outright -
  // it is `#move-buttons .sticky-bar-title .btn-outline-secondary` (1,3,0) against a scoped
  // component rule's (0,3,0) - which is why Undo/Reset kept rendering as transparent outlines on the
  // stripes no matter how solid the component's own CSS made them.
  .btn-outline-secondary:not(.analysis-controls__btn) {
    color: var(--ui-banner-text);
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.08);

    &:hover,
    &:focus {
      color: #fff;
      background: rgba(255, 255, 255, 0.18);
      border-color: rgba(255, 255, 255, 0.42);
    }
  }

  // The auto-leech dropdown defaults to Bootstrap's grey outline styling, which reads as a muddy
  // near-invisible smudge against a dark background - recolored to sit clearly on the dark header
  // instead, same sizing/behavior otherwise.
  .auto-leech-select .btn {
    padding: 0.15rem 0.4rem;
    font-size: 0.75rem;
    color: var(--ui-banner-text);
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.3);

    &:hover,
    &:focus {
      color: #fff;
      background: rgba(255, 255, 255, 0.2);
    }
  }

  // Bootstrap's default dropdown-menu z-index (1000) sits below both this sticky bar (1030) and
  // ChatNotesPanel.vue's floating chat toggle (1040) - belt-and-suspenders alongside the
  // padding-right reservation above, in case the opened menu's own width still reaches the chat
  // toggle's corner on a narrow viewport, it should render on top of it, not tangled underneath.
  .auto-leech-select ::v-deep(.dropdown-menu) {
    z-index: 1050;
  }
}

// The counter headline (§2.9/§5.3) - compact net deltas plus the feasibility verdict, in the slot
// the auto-leech dropdown gives up during analysis mode. Same scrim reasoning as the h5 title text
// above: it sits on the same striped background, in both #move-title (desktop) and .sticky-bar-title
// (mobile), so it gets the identical treatment rather than a third one-off style.
// §13's line strip claims the full first row of whichever header it is in (see the flex-wrap notes
// on the two rules above). The margin lifts the strip's rail flush against the row below it, so the
// open tab reads as joined to the header rather than as a floating pill on the stripes.
#move-title.move-title--analysis > .analysis-tabs,
#move-buttons .sticky-bar-title--analysis > .analysis-tabs {
  flex: 0 0 100%;
  margin-bottom: 0.3rem;
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
    box-shadow: 0 -12px 28px var(--ui-shadow), 0 -1px 0 var(--ui-divider-highlight);

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
      transition: transform 0.08s ease-out, box-shadow 0.08s ease-out;

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
      // ChatNotesPanel.vue's floating chat toggle sits fixed at `right: 1rem`, ~3rem wide, so its
      // footprint covers roughly the rightmost 4rem of the viewport. The auto-leech dropdown here
      // is `ml-auto` (pushed as far right as this row allows) and its popup menu opens `dropup` -
      // without this, both the button and its opened menu land in that same corner, overlapping the
      // chat toggle. Reserving that space up front (padding, not the toggle's own z-index/position)
      // keeps the two apart regardless of the dropdown's open/closed state.
      padding-right: calc(4rem + env(safe-area-inset-right));
    }

    // ...except in sandbox mode, where that reservation is bought with nothing: the auto-leech
    // dropdown it exists for is not rendered at all then (showAutoLeechSelect excludes analysis
    // mode), and the sandbox controls that take its slot are plain buttons with no popup to collide
    // with anything. The chat toggle floats ABOVE this bar rather than on it, so the only thing the
    // 4rem did here was strand the controls short of the right edge - reading as neither centred nor
    // aligned, which is exactly what the owner saw. Back to the row's ordinary padding so
    // `margin-left: auto` lands them flush against it.
    .sticky-bar-title--analysis {
      padding-right: calc(0.7rem + env(safe-area-inset-right));
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
