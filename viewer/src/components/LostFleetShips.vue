<template>
  <div
    v-if="isLostFleet"
    class="lost-fleet-ships"
    @pointerdown="onPanelPointerDown"
    @pointermove="onPanelPointerMove"
    @pointerup="onPanelPointerUp"
    @pointercancel="cancelPanelSwipe"
    @click.capture="onPanelClickCapture"
  >
    <div class="lost-fleet-ships__viewport" :class="{ dragging: panelSwipeActive, settling: panelSwipeSettling }">
      <div
        class="lost-fleet-ships__face lost-fleet-ships__boards"
        :class="{ interactive: !showUltimate && !panelSwipeActive }"
        :style="shipsFaceStyle"
        :aria-hidden="showUltimate ? 'true' : undefined"
      >
        <svg
          v-for="ship in ships"
          :key="ship"
          class="lost-fleet-ship"
          :data-ship="ship"
          :viewBox="`0 -22 ${viewBoxWidth} 80`"
          style="overflow: visible"
        >
      <!-- The board is a rounded card outlined in the ship's color. Its name and the player
           (exploration) slots live in two tabs that sit on top of this card's top edge (drawn last,
           below), which frees the card interior for just the action row + Federation/Tech tiles and
           lets the whole board be shorter than when those lived inside it. -->
      <rect
        x="1.25"
        y="0"
        :width="cardWidth"
        height="56"
        rx="7"
        ry="7"
        class="lost-fleet-ship__card"
        :style="{ fill: shipColor(ship), stroke: shipColor(ship) }"
      />

      <!-- the ship's 3 board actions, rendered exactly like the base game's BoardAction row - tighter
           spacing than the base game's own action row (owner request: "less space between each ship
           action"), see ACTION_SPACING's own comment. -->
      <g
        v-for="(action, i) in shipActions(ship)"
        :key="action.type"
        :class="['lost-fleet-ship__action', action.type, { used: actionUser(ship, action.type) != null }]"
        :data-action="action.type"
        :transform="`translate(${actionXBase + i * actionSpacing}, 28)`"
        v-b-tooltip.nofade="tooltipTriggerConfig()"
        :title="actionTooltip(ship, action)"
      >
        <SpecialAction
          :class="{ faded: actionUser(ship, action.type) != null }"
          :action="actionIncome(ship, action.type)"
          :planet="actionPlanet(ship, action.type)"
          :board="true"
          x="-20"
          y="-25"
          width="40"
        />
        <g v-if="actionOverlay(ship, action.type)" class="lost-fleet-ship__action-overlay" transform="translate(0, -5)">
          <template v-if="isMineBubble(actionOverlay(ship, action.type))">
            <!-- same bubble language as Condition.vue's "mg" (mine on Gaia) VP icon, just bigger and asteroid-colored;
                 nudged down from the octagon's visual center so it doesn't crowd the cost badge above it -->
            <g transform="translate(0, 5) scale(1.2)">
              <circle r="10" :class="['planet-fill', actionOverlay(ship, action.type).planet]" />
              <Building
                :building="actionOverlay(ship, action.type).building"
                faction="gen"
                :flat="flat"
                outline-white
                transform="scale(1.9)"
              />
            </g>
          </template>
          <!-- resource-only overlays (no building) never get the building branch's compounded scale(2.2),
               so they read much smaller than their siblings - boost and re-center them here. -->
          <g
            v-else-if="actionOverlay(ship, action.type).resource && !actionOverlay(ship, action.type).building"
            transform="translate(0, 6) scale(1.3)"
          >
            <Resource :kind="actionOverlay(ship, action.type).resource" />
          </g>
          <g
            v-else-if="actionOverlay(ship, action.type).condition"
            class="lost-fleet-ship__condition-overlay"
            transform="translate(3, 6) scale(0.85)"
          >
            <Condition :condition="actionOverlay(ship, action.type).condition" />
          </g>
          <g v-else transform="scale(0.82)">
            <circle
              v-if="actionOverlay(ship, action.type).planet"
              r="9"
              :class="['planet-fill', actionOverlay(ship, action.type).planet]"
            />
            <Building
              v-if="actionOverlay(ship, action.type).building"
              :building="actionOverlay(ship, action.type).building"
              faction="gen"
              :flat="flat"
              outline-white
              :transform="`translate(${actionOverlay(ship, action.type).resource ? -6 : 0}, 0) scale(2.2)`"
            />
            <Resource
              v-if="actionOverlay(ship, action.type).resource"
              :kind="actionOverlay(ship, action.type).resource"
              :transform="`translate(${actionOverlay(ship, action.type).building ? 8 : 0}, 0)`"
            />
          </g>
        </g>
        <g class="lost-fleet-ship__cost-badge" :transform="costBadgeTransform(ship, action.type)">
          <image v-if="costKind(action.cost) === 'pw'" xlink:href="../assets/resources/power-charge.svg" width="20"
          :height=133/345*20 transform="scale(-1,1) translate(-9, -12)" />
          <rect
            x="-8"
            y="-8"
            width="16"
            height="16"
            :rx="costKind(action.cost) === 'pw' ? 8 : 0"
            :ry="costKind(action.cost) === 'pw' ? 8 : 0"
            stroke="black"
            stroke-width="1"
            :fill="costFill(action.cost)"
            transform="scale(0.8)"
          />
          <text x="-3" y="3.5" class="lost-fleet-ship__cost">{{ costNumber(action.cost) }}</text>
          <Resource
            v-for="(extra, j) in extraCosts(action.cost)"
            :key="j"
            :kind="extra.type"
            :count="extra.count"
            :transform="`translate(0, ${13 + j * 12}) scale(0.75)`"
          />
        </g>
        <UsedActionMark v-if="actionUser(ship, action.type) != null" transform="translate(0, -5)" />
      </g>

      <!-- the Federation token still up for grabs on this ship (base-game token art). The action
           octagons, this Federation tile and the Tech tile are all vertically centered on the card's
           middle. FederationTile is a 50-unit box centered at its own (0,0); its drop-shadow extends
           downward, so it is nudged ~3 units above the geometric center (translate y=5) so the token
           itself reads as centered rather than sitting low. -->
      <g data-section="federation" :transform="`translate(${federationX}, 5) scale(0.8)`">
        <FederationTile
          v-if="shipFederation(ship)"
          :rewardsOverride="federationDisplayRewards(shipFederation(ship))"
          :spaceship-federation="shipFederation(ship)"
          x="0"
          y="0"
          filter="url(#shadow-1)"
        />
        <g v-else v-b-tooltip.nofade="tooltipTriggerConfig()" :title="federationTooltip(ship)">
          <FederationTile :used="true" x="0" y="0" />
        </g>
      </g>

      <!-- the Standard Tech tile seeded on this ship (Twilight has artifacts instead). TechTile draws
           a 60-unit box whose visual center sits at its own local (30, 30); scaled 0.95 so it matches
           the research board's own tech tiles (which render at that same 0.95), and translated so its
           middle stays on the action octagons' y=28 center line (ty + 30*0.95 = 28). At 0.95 the tile
           spans y ~1.3..54.7, just inside the 56-unit card. -->
      <g v-if="hasTechSlot(ship)" data-section="tech" :transform="`translate(${techX}, -0.5) scale(0.95)`">
        <TechTile :pos="ship" x="0" y="0" />
      </g>
      <!-- Twilight has no Standard Tech slot (see `hasTechSlot` above) - this artifact grid fills the
           same right-hand slot instead, a 2-column grid centered vertically on the same y=27 line as
           the tiles (up to 4 artifacts = player count at 4p, so 2 rows). The tokens are ovals (wider
           than tall) at size=24, i.e. 32 wide x 24 tall. The left column starts at artifactX0 so it
           clears the Federation tile, and the columns sit 37 apart so the right column stays inside the
           card's right border; rows are 27 apart and stay above the bottom border. -->
      <g v-else data-section="artifacts">
        <g
          v-for="(artifact, i) in remainingArtifacts"
          :key="artifact"
          :data-artifact="artifact"
          :transform="`translate(${artifactX0 + (i % 2) * 37}, ${3 + Math.floor(i / 2) * 27})`"
        >
          <ArtifactIcon :artifact="artifact" :size="24" />
        </g>
      </g>

      <!-- Left tab: the ship name, sitting like a folder tab on the card's top-left border, filled in
           the ship color. The first letter sits in a white hexagon badge (echoing the map hex) so it
           reads as the ship's identity even on the colored tab; the rest of the name follows in dark
           text (dark reads better than white on the lighter ship colors). -->
      <g class="lost-fleet-ship__tab" v-b-tooltip.nofade="tooltipTriggerConfig()" :title="shipLabel(ship)">
        <path :d="nameTabPath(ship)" :style="{ fill: shipColor(ship) }" class="lost-fleet-ship__tab-shape" />
        <polygon :points="nameHexPoints" class="lost-fleet-ship__name-hex" />
        <text x="15" y="-10" dy="3.8" class="lost-fleet-ship__name-letter">{{ shipFirstLetter(ship) }}</text>
        <text x="25" y="-10" dy="3.8" class="lost-fleet-ship__name-rest">{{ shipNameRest(ship) }}</text>
      </g>

      <!-- Right tab: the 4 exploration/player slots, its negative space filled in the ship color and
           the slot circles (charge-power icons, or a claiming player's token) sitting on top. -->
      <g class="lost-fleet-ship__tab">
        <path :d="slotsTabPath" :style="{ fill: shipColor(ship) }" class="lost-fleet-ship__tab-shape" />
        <g
          v-for="slot in explorationSlots(ship)"
          :key="slot.index"
          class="lost-fleet-ship__slot"
          :data-slot="slot.index"
          :transform="`translate(${slotTabX(slot.index)}, ${slotY})`"
          v-b-tooltip.nofade="tooltipTriggerConfig()"
          :title="slotTitle(slot)"
        >
          <circle :r="slotRadius" class="lost-fleet-ship__slot-bg" />
          <template v-if="!slot.player">
            <!-- the free (0-power) slot shows no number at all - a bare circle reads as "free". -->
            <Resource v-if="slot.cost > 0" kind="pw" :count="slot.cost" transform="translate(0, 2) scale(0.62)" />
          </template>
          <Token v-else :faction="slot.player.faction" transform="translate(0, 0.95) scale(0.35)" />
        </g>
      </g>
        </svg>
      </div>
      <UltimateTicTacToeBoard
        v-if="ultimateMounted"
        class="lost-fleet-ships__face lost-fleet-ships__ultimate"
        :class="{ interactive: showUltimate && !panelSwipeActive }"
        :style="ultimateFaceStyle"
        :aria-hidden="showUltimate ? undefined : 'true'"
      />
    </div>
    <div class="lost-fleet-ships__mode-dots" role="group" aria-label="Ship panel view">
      <button
        v-for="mode in modes"
        :key="mode"
        type="button"
        class="lost-fleet-ships__mode-dot"
        :class="{ active: mode === panelVisibleFace }"
        :data-mode="mode"
        :aria-label="mode === 'ships' ? 'Show spaceship boards' : 'Show Ultimate tic-tac-toe'"
        :aria-pressed="mode === panelVisibleFace ? 'true' : 'false'"
        @pointerdown.stop
        @click.stop="selectPanelMode(mode)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from "vue-property-decorator";
import Engine, {
  ArtifactToken,
  Condition as ConditionEnum,
  Expansion,
  hasExpansion,
  Planet,
  Player,
  Reward,
  Spaceship,
  SpaceshipFederation,
} from "@gaia-project/engine";
import { Player as PlayerEnum } from "@gaia-project/engine/src/enums";
import {
  EXPLORATION_CHARGE_TRACK,
  spaceshipActionEffects,
  spaceshipBoards,
  SpaceshipActionType,
  shipsInPlay,
} from "@gaia-project/engine/src/spaceships";
import { spaceshipFederationSpec } from "@gaia-project/engine/src/tiles/spaceship-federations";
import { spaceshipFederationDisplayRewards } from "../data/federations";
import {
  actionOverlay as actionOverlaySpec,
  ActionOverlay,
  costBadgeTransform as costBadgeTransformFn,
  costFill as costFillFn,
  costNumber as costNumberFn,
  costKind as costKindFn,
  extraCosts as extraCostsFn,
  isMineBubble as isMineBubbleFn,
  spaceshipColors,
  spaceshipDisplayNames,
  spaceshipLabels,
} from "../data/spaceships";
import { factionPiecePlanet } from "../graphics/utils";
import { corners } from "../graphics/hex";
import ArtifactIcon from "./ArtifactIcon.vue";
import Building from "./Building.vue";
import Condition from "./Condition.vue";
import FederationTile from "./FederationTile.vue";
import Resource from "./Resource.vue";
import SpecialAction from "./SpecialAction.vue";
import TechTile from "./TechTile.vue";
import Token from "./Token.vue";
import UsedActionMark from "./UsedActionMark.vue";
import UltimateTicTacToeBoard from "./UltimateTicTacToeBoard.vue";
import { tooltipTriggerConfig } from "../logic/tooltip";
import PanelSwipe from "../logic/panel-swipe";
import { UltimatePanelMode, UltimateTicTacToeBackend } from "../logic/ultimate-tic-tac-toe-backend";
import { localUltimatePanelStorageKey } from "../logic/ultimate-tic-tac-toe";

// The 3 action octagons' row. ACTION_SPACING=45 exactly matches the base game's own power/QIC action
// row (BOARD_ACTION_SPACING=45 in Game.vue, `translate(45 * i ...)`) - owner request: "same space
// between each ship action as the base game power actions". The octagons are already the same size
// (SpecialAction's own width=40 prop, the SAME prop value the base game's BoardAction.vue uses, and
// the ship SVG renders at the research board's exact px-per-unit - see ACTION_COMPRESSION and
// Game.vue's lostFleetShipsStyle), so matching the spacing too makes the whole row pixel-identical to
// the base-game action row.
const ACTION_X_BASE = 29;
const ACTION_SPACING = 45;

// Everything from the Federation tile rightward (federation, tech tile, artifact grid, slots tab,
// card width) shifts left by this same total to follow the 3rd octagon's position - 2 gaps compressed
// from the original 54-unit spacing down to ACTION_SPACING, i.e. 2 * (54 - ACTION_SPACING). Applying
// ONE uniform shift to all of them keeps every relative gap between those elements identical to the
// previous (already visually verified) layout - only the octagon-to-octagon gaps actually change.
const ACTION_COMPRESSION = 2 * (54 - ACTION_SPACING);

// The Federation token nudged left of its old 173 base (owner request: "decrease distance from fed
// tile to right-most ship action, currently too big space") - this shifts ONLY the Federation token
// closer to the 3rd octagon; the tech tile / artifact grid stay put.
const FEDERATION_X = 165 - ACTION_COMPRESSION;
const TECH_X = 221.1 - ACTION_COMPRESSION;
const ARTIFACT_X0 = 217 - ACTION_COMPRESSION;
const CARD_WIDTH = 288.5 - ACTION_COMPRESSION;

// Exploration ("player") slot geometry - owner request: bigger slots than the original r=6 design.
// SLOT_RADIUS=8 needs SLOT_SPACING>=17 to keep a real (1-unit) gap between adjacent circles instead
// of touching. X positions shift left by ACTION_COMPRESSION along with everything else right of the
// action row (see above). The name tab (see `nameTabPath`) uses this same SLOT_TAB_TOP so both tabs
// stand exactly the same height (owner request: "name of ship should be bigger so the height of that
// tab becomes the same height as the player slots tab").
const SLOT_RADIUS = 8;
const SLOT_SPACING = 17;
const SLOT_X_BASE = 223 - ACTION_COMPRESSION;
const SLOT_TAB_TOP = -21;
const SLOT_TAB_X0 = 210 - ACTION_COMPRESSION;
const SLOT_TAB_X1 = 286 - ACTION_COMPRESSION;
// Vertical center of the slot circles within the tab (SLOT_TAB_TOP=-21 to bot=1). Raised to -11 (from
// -9) so the SLOT_RADIUS=8 circles' bottom edge sits at y=-3 rather than -1 - that extra breathing
// room keeps the slot row from sitting straight on top of the Standard Tech tile below it (whose top
// edge is ~y=1.3), owner request. It still clears the tab's top border (circle top -19 vs tab -21).
const SLOT_Y = -11;

// Name tab horizontal padding. The white first-letter hex badge's left edge sits at x=7.5 (center 15,
// radius 7.5). NAME_TAB_PAD is the ship-color gap left BETWEEN the tab border and the name content on
// BOTH sides (owner request: "ship name space on both sides should be equal") - so the tab starts
// NAME_TAB_PAD left of the hex (NAME_TAB_X0) and ends NAME_TAB_PAD right of the name's real rendered
// right edge (measured at runtime, see `measureNameTabs` - a fixed per-char estimate can't be equal on
// both sides because glyph widths differ wildly, e.g. I vs W). X0 stays right of the card's rounded
// top-left corner (its fill starts at ~x=4.6 on the tab's bottom edge) so the tab never juts past it.
const NAME_HEX_LEFT = 7.5;
const NAME_TAB_PAD = 2.5;
const NAME_TAB_X0 = NAME_HEX_LEFT - NAME_TAB_PAD;

// The ship SVG's own viewBox width - the original 291 minus the same ACTION_COMPRESSION every other
// rightward element gives up. Exported for Game.vue, which needs it to compute the ship board's exact
// px-per-unit-matching CSS width (see that file's `lostFleetShipsStyle`).
export const SHIP_BOARD_VIEWBOX_WIDTH = 291 - ACTION_COMPRESSION;

@Component({
  components: {
    ArtifactIcon,
    Building,
    Condition,
    FederationTile,
    Resource,
    SpecialAction,
    TechTile,
    Token,
    UltimateTicTacToeBoard,
    UsedActionMark,
  },
})
export default class LostFleetShips extends Mixins(PanelSwipe) {
  slotRadius = SLOT_RADIUS;
  slotY = SLOT_Y;
  actionXBase = ACTION_X_BASE;
  actionSpacing = ACTION_SPACING;
  federationX = FEDERATION_X;
  techX = TECH_X;
  artifactX0 = ARTIFACT_X0;
  cardWidth = CARD_WIDTH;
  viewBoxWidth = SHIP_BOARD_VIEWBOX_WIDTH;

  // ship -> the name text's real rendered right edge (x), measured off the live DOM so the name tab
  // can leave an EQUAL margin on both sides regardless of the actual glyph widths (see `nameTabPath`).
  nameTabRights: Record<string, number> = {};
  showUltimate = false;
  ultimateMounted = false;

  mounted() {
    this.showUltimate = window.localStorage.getItem(this.localPanelStorageKey) === "ultimate";
    this.ultimateMounted = this.showUltimate;
    this.$nextTick(() => this.measureNameTabs());
    // Web fonts can land after the first paint and change the text's width - re-measure once they do.
    const fonts = typeof document !== "undefined" ? (document as any).fonts : undefined;
    if (fonts?.ready?.then) {
      fonts.ready.then(() => this.measureNameTabs());
    }
  }

  updated() {
    // Player count (and so the set of ships) can change without a remount; re-measure any name we
    // haven't sized yet. Guarded so a no-op update never re-assigns and re-triggers render.
    if (this.ships.some((ship) => this.nameTabRights[ship] === undefined)) {
      this.$nextTick(() => this.measureNameTabs());
    }
  }

  // ---- two-face ship drawer ----------------------------------------------

  get panelFaces(): [string, string] {
    return ["ships", "ultimate"];
  }

  get panelVisibleFace(): string {
    return this.showUltimate ? "ultimate" : "ships";
  }

  get panelSwipeIgnoreSelector(): string {
    return ".lf-ultimate-overlay";
  }

  panelSwipePrepare() {
    this.ultimateMounted = true;
  }

  panelSwipeCommit(face: string) {
    this.setPanelMode(face as UltimatePanelMode);
  }

  get modes(): UltimatePanelMode[] {
    return ["ships", "ultimate"];
  }

  get ultimateBackend(): UltimateTicTacToeBackend | null {
    return this.$store.state.ultimateTicTacToeBackend ?? null;
  }

  get localPanelStorageKey(): string {
    const search = typeof window === "undefined" ? "" : window.location.search;
    return localUltimatePanelStorageKey(search, this.ultimateBackend?.userId ?? null);
  }

  get shipsFaceStyle(): Record<string, string> {
    return { transform: this.panelFaceTransform("ships") };
  }

  get ultimateFaceStyle(): Record<string, string> {
    return { transform: this.panelFaceTransform("ultimate") };
  }

  selectPanelMode(mode: UltimatePanelMode) {
    if (mode !== this.panelVisibleFace) {
      this.setPanelMode(mode);
    }
  }

  private setPanelMode(mode: UltimatePanelMode) {
    if (mode === "ultimate" && !this.showUltimate) {
      this.$root.$emit("bv::hide::tooltip");
    }
    if (mode === "ultimate") {
      this.ultimateMounted = true;
    }
    this.showUltimate = mode === "ultimate";
    window.localStorage.setItem(this.localPanelStorageKey, mode);
  }

  /** Measure each ship name's rendered right edge so `nameTabPath` can pad it symmetrically. getBBox
   * isn't implemented in jsdom (unit tests) and throws before layout, so this is best-effort - the
   * fallback estimate in `nameTabPath` covers every case where it can't run. */
  private measureNameTabs() {
    const root = this.$el as Element | undefined;
    if (!root || typeof (root as Element).querySelectorAll !== "function") {
      return;
    }
    const next: Record<string, number> = {};
    let changed = false;
    root.querySelectorAll("svg.lost-fleet-ship").forEach((svg) => {
      const ship = svg.getAttribute("data-ship");
      const rest = svg.querySelector(".lost-fleet-ship__name-rest") as SVGGraphicsElement | null;
      if (!ship || !rest || typeof rest.getBBox !== "function") {
        return;
      }
      try {
        const box = rest.getBBox();
        if (box.width > 0) {
          next[ship] = box.x + box.width;
          if (this.nameTabRights[ship] !== next[ship]) {
            changed = true;
          }
        }
      } catch {
        // getBBox throws in jsdom / before layout - fall back to the estimate in nameTabPath.
      }
    });
    if (changed) {
      this.nameTabRights = { ...this.nameTabRights, ...next };
    }
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get isLostFleet(): boolean {
    return hasExpansion(this.engine.expansions, Expansion.LostFleet);
  }

  get ships(): Spaceship[] {
    return shipsInPlay(this.engine.expansions, this.engine.players.length);
  }

  get flat(): boolean {
    return this.$store.state.preferences.flatBuildings;
  }

  get remainingArtifacts(): ArtifactToken[] {
    return this.engine.tiles.artifacts ?? [];
  }

  shipLabel(ship: Spaceship): string {
    return spaceshipLabels[ship];
  }

  shipColor(ship: Spaceship): string {
    return spaceshipColors[ship];
  }

  /** Full uppercase ship name, e.g. "REBELLION" ("T F Mars" -> "MARS"). */
  shipFullName(ship: Spaceship): string {
    return spaceshipDisplayNames[ship].toUpperCase();
  }

  /** First letter of the name (drawn inside the white hex badge in the left tab). */
  shipFirstLetter(ship: Spaceship): string {
    return this.shipFullName(ship).charAt(0);
  }

  /** The rest of the name after the first letter (drawn as text beside the hex badge). */
  shipNameRest(ship: Spaceship): string {
    return this.shipFullName(ship).slice(1);
  }

  /** The white first-letter hex badge, centered at (15, -10) in the taller left tab (7.5-unit radius,
   * up from 5.8 so the bigger name reads at the tab's new player-slots-matching height). */
  get nameHexPoints(): string {
    return corners(7.5)
      .map((p) => `${p.x + 15},${p.y - 10}`)
      .join(" ");
  }

  /** Rounded-top "folder tab" outline: flat bottom on the card's top border, rounded top corners.
   * `top` defaults to the shared SLOT_TAB_TOP so the name and slots tabs stand the same height. */
  private tabPath(x0: number, x1: number, top = SLOT_TAB_TOP): string {
    const r = 6;
    const bot = 1;
    return `M${x0},${bot} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} L${x1 - r},${top} Q${x1},${top} ${x1},${
      top + r
    } L${x1},${bot} Z`;
  }

  /** Left tab: equal NAME_TAB_PAD margin on both sides. It starts NAME_TAB_PAD left of the hex badge
   * (NAME_TAB_X0) and ends NAME_TAB_PAD right of the name's real rendered right edge - measured at
   * runtime per ship (`nameTabRights`, filled by `measureNameTabs`). Before that measurement lands (or
   * in jsdom, where getBBox is unavailable) it falls back to a deliberate OVER-estimate so the tab is
   * never born too narrow and clipping the name. Same height as the slots tab (tabPath default top). */
  nameTabPath(ship: Spaceship): string {
    const measuredRight = this.nameTabRights[ship];
    const textRight = measuredRight ?? 25 + this.shipNameRest(ship).length * 7.6;
    return this.tabPath(NAME_TAB_X0, textRight + NAME_TAB_PAD);
  }

  /** Right (slots) tab: wider than the name tab but the same height (both use SLOT_TAB_TOP) - its
   * bigger, more widely spaced circles keep a comfortable margin on every side, see the
   * exploration-slot constants below for the exact numbers. */
  get slotsTabPath(): string {
    return this.tabPath(SLOT_TAB_X0, SLOT_TAB_X1, SLOT_TAB_TOP);
  }

  /** X of the given exploration slot's center within the right tab (index 1-4). */
  slotTabX(index: number): number {
    return SLOT_X_BASE + (index - 1) * SLOT_SPACING;
  }

  shipActions(ship: Spaceship) {
    return spaceshipBoards[ship].actions;
  }

  actionIncome(ship: Spaceship, type: SpaceshipActionType): string[] {
    return spaceshipActionEffects[ship]?.[type] ?? [];
  }

  actionOverlay(ship: Spaceship, type: SpaceshipActionType): ActionOverlay | null {
    return actionOverlaySpec(ship, type);
  }

  actionUser(ship: Spaceship, type: SpaceshipActionType): Player | null {
    const player = this.engine.spaceshipActions[ship]?.[type];
    return player === undefined ? null : this.engine.player(player as PlayerEnum);
  }

  /** Colors a taken ship action's octagon by the taking player's faction, like base-game BoardAction. */
  actionPlanet(ship: Spaceship, type: SpaceshipActionType): Planet | null {
    const user = this.actionUser(ship, type);
    return user ? factionPiecePlanet(user.faction) : null;
  }

  isMineBubble(overlay: ActionOverlay): boolean {
    return isMineBubbleFn(overlay);
  }

  actionTooltip(ship: Spaceship, action: { type: SpaceshipActionType; cost: string; effect: string }): string {
    const user = this.actionUser(ship, action.type);
    const state = user ? ` - used by ${user.name || `P${user.player + 1}`} this round` : "";
    return `(${action.cost}): ${action.effect}${state}`;
  }

  costKind(cost: string): string {
    return costKindFn(cost);
  }

  costNumber(cost: string): number {
    return costNumberFn(cost);
  }

  extraCosts(cost: string): Reward[] {
    return extraCostsFn(cost);
  }

  costFill(cost: string): string {
    return costFillFn(cost);
  }

  costBadgeTransform(ship: Spaceship, type: SpaceshipActionType): string {
    return costBadgeTransformFn(ship, type);
  }

  hasTechSlot(ship: Spaceship): boolean {
    return spaceshipBoards[ship].hasStandardTechSlot;
  }

  shipFederation(ship: Spaceship): SpaceshipFederation | undefined {
    return this.engine.tiles.spaceshipFederations[ship];
  }

  federationDisplayRewards(federation: SpaceshipFederation): Reward[] {
    return spaceshipFederationDisplayRewards(federation);
  }

  federationTooltip(ship: Spaceship): string {
    const federation = this.shipFederation(ship);
    return federation ? spaceshipFederationSpec[federation] : "Federation token already claimed";
  }

  explorationSlots(ship: Spaceship): Array<{ index: number; cost: number; player: Player | null }> {
    return EXPLORATION_CHARGE_TRACK.map((cost, index) => ({
      index: index + 1,
      cost,
      player: this.engine.players.find((player) => player.data.explorationShips[ship] === index + 1) ?? null,
    }));
  }

  slotTitle(slot: { index: number; cost: number; player: Player | null }): string {
    if (slot.player) {
      return `Slot ${slot.index}: explored by ${slot.player.name || `P${slot.player.player + 1}`} (${slot.cost} power)`;
    }
    return `Slot ${slot.index}: open (charge ${slot.cost} power)`;
  }

  tooltipTriggerConfig = tooltipTriggerConfig;
}
</script>

<style lang="scss">
.lost-fleet-ships {
  position: relative;
  min-width: 0;
  touch-action: pan-y pinch-zoom;
}

.lost-fleet-ships__viewport {
  position: relative;
  width: 100%;
  overflow: hidden;

  &.settling .lost-fleet-ships__face {
    transition: transform 180ms ease-out;
  }
}

.lost-fleet-ships__face {
  width: 100%;
  will-change: transform;
  backface-visibility: hidden;
  pointer-events: none;

  &.interactive {
    pointer-events: auto;
  }
}

.lost-fleet-ships__boards {
  // Each ship board stays in the existing single-column stack. Keeping this face in normal flow
  // means it remains the sole height authority for the drawer and the Pool/notes column beside it.
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.lost-fleet-ships__ultimate {
  position: absolute;
  z-index: 1;
  inset: 0;
  overflow: hidden;
  border: 2px solid var(--ui-border-strong);
  border-radius: 5px;
}

.lost-fleet-ships__mode-dots {
  position: absolute;
  z-index: 3;
  right: 5px;
  bottom: 3px;
  display: flex;
  height: 7px;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 0;
}

.lost-fleet-ships__mode-dot {
  width: 5px;
  height: 5px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--ui-text-muted, #78818d);
  opacity: 0.48;
  cursor: pointer;
  transition: opacity 100ms ease, background-color 100ms ease;

  &.active {
    background: var(--ui-primary, #247b0a);
    opacity: 0.95;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
}

svg.lost-fleet-ship {
  // Fills 100% of `.lost-fleet-ships`, whose own width is the exact-px-per-unit-matching flex-basis
  // (`--lf-ship-width`, see Game.vue's `lostFleetShipsStyle`) - so this SVG renders at exactly the
  // research board's own px-per-unit, making the action octagons match the base-game power/QIC
  // octagons pixel for pixel (owner request). Scaling via width (not a transform) carries the SVG's
  // height along in proportion, so no dead gap opens below each board.
  width: 100%;
  height: auto;
  display: block;

  // The whole board card, filled in the ship's color (fill + stroke set per-ship inline).
  .lost-fleet-ship__card {
    stroke-width: 2.5;
  }

  // The two tabs (name + slots) that sit on the card's top border; fill is set per-ship inline,
  // no outline so they merge seamlessly into the same-colored card.
  .lost-fleet-ship__tab-shape {
    stroke: none;
  }

  // The white first-letter hex badge in the left tab, with a thin dark outline so it stays crisp on
  // the lighter ship colors (grey / gold).
  .lost-fleet-ship__name-hex {
    fill: #fff;
    stroke: #172e62;
    stroke-width: 0.6;
  }

  // The first letter (inside the white hex) and the rest of the name (on the colored tab). Both dark
  // - dark reads better than white on the lighter ship colors.
  .lost-fleet-ship__name-letter {
    font-size: 11px;
    font-weight: 800;
    fill: #17161a;
    text-anchor: middle;
    pointer-events: none;
  }

  .lost-fleet-ship__name-rest {
    font-size: 11px;
    font-weight: 700;
    fill: #17161a;
    text-anchor: start;
    letter-spacing: 0.4px;
    pointer-events: none;
  }

  .lost-fleet-ship__slot-bg {
    fill: #eef2f8;
    stroke: #b8c2d4;
    stroke-width: 1;
  }

  .lost-fleet-ship__cost {
    fill: white !important;
    font-size: 12px;
  }

  .lost-fleet-ship__action-overlay {
    pointer-events: none;

    circle.planet-fill {
      stroke: black;
      stroke-width: 0.5;
    }
  }
}
</style>
