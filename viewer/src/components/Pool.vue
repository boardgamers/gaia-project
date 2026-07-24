<template>
  <div :class="compact ? undefined : 'container-fluid'">
    <template v-if="$store.state.data.tiles && $store.state.data.tiles.techs['gaia']">
      <!-- Compact (sidebar) mode: boosters sit in a fixed 3-column grid, wrapping to further rows past
           3 (`.pool-boosters`, owner clarification: "fit one row" means 3 per row, not all of them).
           Federation tokens sit in a grid sized to exactly 2 rows, as big as that constraint allows -
           `federationColumns` computes just enough columns from the live count so ceil(count / columns)
           never exceeds 2 (owner request) - and are hidden entirely before round 1, when none are yet
           claimable (owner request: "for pre round 1 only show the boosters, no feds"). Both leave
           breathing room for their own drop-shadow filter's bleed (see the CSS below) so tokens never
           spill past the box's border. -->
      <!-- The tile tree stays mounted underneath the exact-size chess face, so neither the sidebar
           layout nor tile state moves. Two bottom page dots advertise the swipeable faces without
           consuming layout space; tapping a tile remains exclusively its own interaction. -->
      <div
        v-if="compact"
        class="pool compact mb-1"
        @pointerdown="onPanelPointerDown"
        @pointermove="onPanelPointerMove"
        @pointerup="onPanelPointerUp"
        @pointercancel="cancelPanelSwipe"
        @click.capture="onPanelClickCapture"
      >
        <div class="pool-panel-viewport" :class="{ dragging: panelSwipeActive, settling: panelSwipeSettling }">
          <div
            class="pool-tiles-face pool-panel-face"
            :class="{ interactive: !showChess && !panelSwipeActive }"
            :style="poolFaceStyle"
            :aria-hidden="showChess ? 'true' : undefined"
          >
            <div class="pool-boosters">
              <Booster v-for="booster in boosters" :key="booster" :booster="booster" />
            </div>
            <div
              v-if="!isPreRound1"
              class="pool-federations"
              data-bottom-clearance="single-gap"
              :style="{ gridTemplateColumns: `repeat(${federationColumns}, 1fr)` }"
            >
              <FederationTile
                v-for="([tile, numTiles], i) in federations"
                :key="`${tile}-${i}`"
                :federation="tile"
                :numTiles="numTiles"
                filter="url(#shadow-1)"
              />
            </div>
          </div>
          <ChessBoard
            v-if="chessMounted"
            class="pool-chess-overlay pool-panel-face"
            :class="{ interactive: showChess && !panelSwipeActive }"
            :style="chessFaceStyle"
            :aria-hidden="showChess ? undefined : 'true'"
          />
        </div>
        <div class="pool-mode-dots" role="group" aria-label="Sidebar view">
          <button
            v-for="mode in ['pool', 'chess']"
            :key="mode"
            type="button"
            class="pool-mode-dot"
            :class="{ active: mode === (showChess ? 'chess' : 'pool') }"
            :data-mode="mode"
            :aria-label="mode === 'pool' ? 'Show booster and federation tiles' : 'Show shared chess board'"
            :aria-pressed="mode === (showChess ? 'chess' : 'pool') ? 'true' : 'false'"
            :disabled="panelModeSaving"
            @pointerdown.stop
            @click.stop="selectPanelMode(mode)"
          />
        </div>
      </div>
      <!-- Non-compact (base game): the original single interleaved flex-wrap row, unchanged - both
           tile types share the same row, wrapping at their native fixed size. -->
      <div v-else class="pool pb-0 mb-1 row no-gutters">
        <Booster v-for="booster in boosters" :key="booster" :booster="booster" class="mb-2 mr-2" />
        <FederationTile
          v-for="([tile, numTiles], i) in federations"
          :key="`${tile}-${i}`"
          :federation="tile"
          :numTiles="numTiles"
          class="mb-2 mr-2"
          filter="url(#shadow-1)"
        />
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Booster from "./Booster.vue";
import FederationTile from "./FederationTile.vue";
import ChessBoard from "./ChessBoard.vue";
import Engine, { Booster as BoosterEnum } from "@gaia-project/engine";
import { ChessBackend, ChessPanelMode, ChessRow } from "../logic/chess-backend";
import { localChessPanelStorageKey } from "../logic/chess";
import { isBeforeRound1 } from "../logic/utils";

@Component({
  computed: {
    boosters() {
      return BoosterEnum.values(this.$store.state.data.expansions).filter(
        (key) => this.$store.state.data.tiles.boosters[key]
      );
    },
    federations() {
      return Object.entries(this.$store.state.data.tiles.federations).filter(([key, value]) => value > 0);
    },
  },
  components: {
    Booster,
    FederationTile,
    ChessBoard,
  },
})
export default class Pool extends Vue {
  // Compact (Lost Fleet sidebar) only: whether the booster/federation container is currently
  // showing the shared chess board instead of its tiles.
  showChess = false;
  chessMounted = false;
  panelModeSaving = false;
  panelSwipeActive = false;
  panelSwipeSettling = false;
  panelSwipeOffset = 0;
  private chessUnsubscribe: (() => void) | null = null;
  private panelSwipeStart: { pointerId: number; x: number; y: number; width: number; element: HTMLElement } | null =
    null;
  private panelSwipeDirection: -1 | 0 | 1 = 0;
  private panelSwipeOriginMode: ChessPanelMode = "pool";
  private panelSwipeCompletes = false;
  private panelSwipeSettleTimer: number | null = null;
  private suppressPanelClick = false;
  private suppressPanelClickTimer: number | null = null;

  // Used by LostFleetShips' sidebar placement (Game.vue): switches to the flex/grid layout below
  // (sized to the sidebar's own narrow width) instead of the base game's fixed-size flex-wrap row.
  @Prop({ default: false, type: Boolean })
  compact: boolean;

  boosters!: string[];
  federations!: [string, number][];

  mounted() {
    if (!this.compact) {
      return;
    }
    const backend = this.chessBackend;
    if (!backend) {
      this.showChess = window.localStorage.getItem(this.localPanelStorageKey) === "chess";
      this.chessMounted = this.showChess;
      return;
    }
    this.chessUnsubscribe = backend.subscribe((row) => this.applyPanelRow(row));
    backend
      .load()
      .then((row) => {
        if (row) {
          this.applyPanelRow(row);
        }
      })
      .catch(() => undefined);
  }

  beforeDestroy() {
    if (this.chessUnsubscribe) {
      this.chessUnsubscribe();
    }
    if (this.suppressPanelClickTimer !== null) {
      window.clearTimeout(this.suppressPanelClickTimer);
    }
    if (this.panelSwipeSettleTimer !== null) {
      window.clearTimeout(this.panelSwipeSettleTimer);
    }
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get chessBackend(): ChessBackend | null {
    return this.$store.state.chessBackend ?? null;
  }

  get localPanelStorageKey(): string {
    return localChessPanelStorageKey(typeof window === "undefined" ? "" : window.location.search);
  }

  get poolFaceStyle(): Record<string, string> {
    return { transform: this.panelFaceTransform("pool") };
  }

  get chessFaceStyle(): Record<string, string> {
    return { transform: this.panelFaceTransform("chess") };
  }

  // Federation tokens aren't claimable until round 1 starts, so during setup the sidebar shows only
  // the booster pool (owner request: "for pre round 1 only show the boosters, no feds").
  get isPreRound1(): boolean {
    return isBeforeRound1(this.engine);
  }

  // The smallest column count that still keeps every federation token within 2 rows - e.g. 5 tokens
  // needs 3 columns (ceil(5/3)=2 rows), not 5 (which would fit 1 row but leave them tiny) or 2 (which
  // would need 3 rows). Floored at 1 so an empty/near-empty pool doesn't divide by 0.
  get federationColumns(): number {
    return Math.max(1, Math.ceil(this.federations.length / 2));
  }

  selectPanelMode(mode: ChessPanelMode) {
    if (mode === (this.showChess ? "chess" : "pool")) {
      return;
    }
    this.setPanelMode(mode);
  }

  onPanelPointerDown(event: PointerEvent) {
    const target = event.target;
    if (
      this.panelModeSaving ||
      event.isPrimary === false ||
      event.button > 0 ||
      (target instanceof Element && target.closest("button, .lf-chess-overlay"))
    ) {
      this.panelSwipeStart = null;
      return;
    }
    this.clearPanelSettle();
    this.chessMounted = true;
    const element = event.currentTarget as HTMLElement;
    const width = element.clientWidth || element.getBoundingClientRect().width || 160;
    this.panelSwipeStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width,
      element,
    };
    this.panelSwipeOriginMode = this.showChess ? "chess" : "pool";
    this.panelSwipeDirection = 0;
    this.panelSwipeOffset = 0;
    this.panelSwipeActive = false;
    if (typeof element.setPointerCapture === "function") {
      element.setPointerCapture(event.pointerId);
    }
  }

  onPanelPointerMove(event: PointerEvent) {
    const start = this.panelSwipeStart;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (this.panelSwipeDirection === 0) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) {
        return;
      }
      if (Math.abs(dx) <= Math.abs(dy) * 1.15) {
        this.releasePanelPointer(start);
        this.panelSwipeStart = null;
        return;
      }
      this.panelSwipeDirection = dx < 0 ? -1 : 1;
      this.panelSwipeActive = true;
      this.$root.$emit("lf::chess-panel-swipe");
    }

    const directionalOffset = this.panelSwipeDirection < 0 ? Math.min(0, dx) : Math.max(0, dx);
    this.panelSwipeOffset = Math.max(-start.width, Math.min(start.width, directionalOffset));
    event.preventDefault();
  }

  onPanelPointerUp(event: PointerEvent) {
    const start = this.panelSwipeStart;
    this.panelSwipeStart = null;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }
    this.releasePanelPointer(start);
    if (!this.panelSwipeActive || this.panelSwipeDirection === 0) {
      this.resetPanelSwipe();
      return;
    }

    // The browser synthesizes a click immediately after a touch pointerup. Consume that one click
    // so a drawer gesture cannot also click a tile or chess square after release.
    this.suppressSyntheticPanelClick();
    const threshold = Math.min(64, Math.max(36, start.width * 0.22));
    this.settlePanelSwipe(Math.abs(this.panelSwipeOffset) >= threshold);
  }

  cancelPanelSwipe() {
    const start = this.panelSwipeStart;
    this.panelSwipeStart = null;
    if (start) {
      this.releasePanelPointer(start);
    }
    if (this.panelSwipeActive) {
      this.suppressSyntheticPanelClick();
      this.settlePanelSwipe(false);
    } else {
      this.resetPanelSwipe();
    }
  }

  onPanelClickCapture(event: MouseEvent) {
    if (!this.suppressPanelClick) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.suppressPanelClick = false;
    if (this.suppressPanelClickTimer !== null) {
      window.clearTimeout(this.suppressPanelClickTimer);
      this.suppressPanelClickTimer = null;
    }
  }

  private panelFaceTransform(face: ChessPanelMode): string {
    if (this.panelSwipeActive) {
      const current = this.panelSwipeOriginMode;
      const offset = this.panelSwipeOffset;
      const base = face === current ? 0 : -this.panelSwipeDirection * 100;
      return `translate3d(calc(${base}% + ${offset}px), 0, 0)`;
    }
    if (this.panelSwipeSettling && this.panelSwipeDirection !== 0) {
      const current = this.panelSwipeOriginMode;
      let target = 0;
      if (this.panelSwipeCompletes) {
        target = face === current ? this.panelSwipeDirection * 100 : 0;
      } else {
        target = face === current ? 0 : -this.panelSwipeDirection * 100;
      }
      return `translate3d(${target}%, 0, 0)`;
    }
    const visible: ChessPanelMode = this.showChess ? "chess" : "pool";
    if (face === visible) {
      return "translate3d(0, 0, 0)";
    }
    return face === "pool" ? "translate3d(-100%, 0, 0)" : "translate3d(100%, 0, 0)";
  }

  private settlePanelSwipe(completes: boolean) {
    this.panelSwipeActive = false;
    this.panelSwipeSettling = true;
    this.panelSwipeCompletes = completes;
    if (completes) {
      this.setPanelMode(this.panelSwipeOriginMode === "pool" ? "chess" : "pool");
    }
    this.panelSwipeSettleTimer = window.setTimeout(() => {
      this.panelSwipeSettleTimer = null;
      this.resetPanelSwipe();
    }, 180);
  }

  private resetPanelSwipe() {
    this.panelSwipeActive = false;
    this.panelSwipeSettling = false;
    this.panelSwipeCompletes = false;
    this.panelSwipeOffset = 0;
    this.panelSwipeDirection = 0;
  }

  private clearPanelSettle() {
    if (this.panelSwipeSettleTimer !== null) {
      window.clearTimeout(this.panelSwipeSettleTimer);
      this.panelSwipeSettleTimer = null;
    }
    this.resetPanelSwipe();
  }

  private releasePanelPointer(start: { pointerId: number; element: HTMLElement }) {
    if (
      typeof start.element.releasePointerCapture === "function" &&
      (!start.element.hasPointerCapture || start.element.hasPointerCapture(start.pointerId))
    ) {
      start.element.releasePointerCapture(start.pointerId);
    }
  }

  private suppressSyntheticPanelClick() {
    this.suppressPanelClick = true;
    if (this.suppressPanelClickTimer !== null) {
      window.clearTimeout(this.suppressPanelClickTimer);
    }
    this.suppressPanelClickTimer = window.setTimeout(() => {
      this.suppressPanelClick = false;
      this.suppressPanelClickTimer = null;
    }, 0);
  }

  private applyPanelRow(row: ChessRow) {
    this.applyPanelMode(row.panel_mode);
  }

  private applyPanelMode(mode: ChessPanelMode) {
    if (mode === "chess" && !this.showChess) {
      this.$root.$emit("bv::hide::tooltip");
    }
    if (mode === "chess") {
      this.chessMounted = true;
    }
    this.showChess = mode === "chess";
  }

  private async setPanelMode(mode: ChessPanelMode) {
    if (this.panelModeSaving) {
      return;
    }
    const previousMode: ChessPanelMode = this.showChess ? "chess" : "pool";
    this.applyPanelMode(mode);

    const backend = this.chessBackend;
    if (!backend) {
      window.localStorage.setItem(this.localPanelStorageKey, mode);
      return;
    }

    this.panelModeSaving = true;
    try {
      await backend.setPanelMode(mode);
    } catch (error) {
      try {
        const row = await backend.load();
        row ? this.applyPanelRow(row) : this.applyPanelMode(previousMode);
      } catch (loadError) {
        this.applyPanelMode(previousMode);
      }
    } finally {
      this.panelModeSaving = false;
    }
  }
}
</script>

<style lang="scss" scoped>
.pool {
  margin-bottom: 1em;
  padding-bottom: 0.5em;
  padding-left: 0.5em;
  padding-top: 0.5em;
  border-radius: 5px;

  position: relative;
  border: 2px solid var(--ui-border-strong);
  background-color: var(--ui-surface);

  flex-wrap: wrap;

  &.compact {
    // Both Booster.vue and FederationTile.vue draw their own drop-shadow via the shared `shadow-1`
    // filter, whose region extends 20% beyond the tile's own bounding box on every side (see
    // Filters.vue) - and both SVGs render with `overflow: visible`, so that bleed is NOT clipped to
    // the tile's own box. Sizing tiles to fill their row/grid with zero breathing room would let that
    // shadow spill past `.pool`'s own border (owner request: "don't let fed tokens bleed over the
    // border"). GAP reserves comfortably more than the 20% bleed needs at any tile size these grids
    // realistically produce, on every side (row/grid gap between tiles, plus the container's own
    // GAP-sized padding so the outermost tiles' bleed clears the border too).
    $gap: 6px;
    padding: $gap;
    touch-action: pan-y;
    overflow: hidden;

    .pool-panel-viewport {
      position: relative;
      width: 100%;
      overflow: hidden;

      &.settling .pool-panel-face {
        transition: transform 180ms ease-out;
      }
    }

    .pool-panel-face {
      width: 100%;
      will-change: transform;
      backface-visibility: hidden;
      pointer-events: none;

      &.interactive {
        pointer-events: auto;
      }
    }

    .pool-chess-overlay {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      border-radius: 3px;
    }

    .pool-mode-dots {
      position: absolute;
      z-index: 3;
      left: 50%;
      bottom: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
      height: 6px;
      margin: 0;
      padding: 0 4px;
      border-radius: 5px;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.58);
    }

    .pool-mode-dot {
      width: 5px;
      height: 5px;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: var(--ui-text-muted, #78818d);
      opacity: 0.48;
      cursor: pointer;
      transition: width 100ms ease, opacity 100ms ease, background-color 100ms ease;

      &.active {
        width: 11px;
        background: var(--ui-primary, #247b0a);
        opacity: 0.9;
      }

      &:focus-visible {
        outline: 2px solid var(--ui-primary);
        outline-offset: 2px;
      }

      &:disabled {
        cursor: wait;
      }
    }

    .pool-boosters {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: $gap;
      width: 100%;

      // Owner clarification: "fit one row" means 3 per row, not all of them - a fixed 3-column grid
      // wraps to further rows once there are more than 3 boosters, and (unlike flex) keeps every
      // booster the same size regardless of how many fall in the last, possibly-partial row.
      svg.booster {
        width: 100%;
        height: auto;
      }
    }

    .pool-federations[data-bottom-clearance="single-gap"] {
      display: grid;
      gap: $gap;
      margin-top: $gap;
      // The federation.svg hexagon is taller than its own square box (height 739/636 of its width) and
      // renders with overflow visible, so its bottom tip juts ~15% below the grid's last row. One
      // extra gap, combined with the container's own bottom padding, leaves the painted tip a little
      // more room than the boosters have above them without making the whole sidebar box needlessly
      // tall.
      margin-bottom: $gap;
      width: 100%;

      // Owner request: "adjust the size so it's as big as possible but only 2 rows" - each cell (a
      // 1fr grid column, height following width via the SVG's own square viewBox aspect ratio) is as
      // big as `federationColumns` (computed from the live count) allows while keeping every token
      // within 2 rows.
      > svg {
        width: 100%;
        height: auto;
      }
    }
  }
}
</style>
