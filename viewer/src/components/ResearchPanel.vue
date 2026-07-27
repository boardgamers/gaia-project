<template>
  <!-- The research board and the shared renju board are two faces of one horizontal drawer, exactly
       like the compact pool's tiles/chess drawer (Pool.vue). The research art keeps its place in
       normal flow so it goes on defining the panel's own height at every viewport width; the renju
       face is overlaid at the same size and only mounted once someone reaches for it. Two small
       bottom-right page dots advertise the second face without consuming any layout space.

       The hidden face gets `pointer-events: none` and a swipe swallows the browser's synthetic
       release click - which matters far more here than it did for the pool, because this panel's
       tech tiles, research tiles and power/QIC octagons are live Gaia move buttons. -->
  <div
    class="research-panel"
    @pointerdown="onPanelPointerDown"
    @pointermove="onPanelPointerMove"
    @pointerup="onPanelPointerUp"
    @pointercancel="cancelPanelSwipe"
    @click.capture="onPanelClickCapture"
  >
    <div class="research-panel-viewport" :class="{ dragging: panelSwipeActive, settling: panelSwipeSettling }">
      <div
        class="research-panel-face research-board-face"
        :class="{ interactive: !showRenju && !panelSwipeActive }"
        :style="researchFaceStyle"
        :aria-hidden="showRenju ? 'true' : undefined"
      >
        <slot />
      </div>
      <RenjuBoard
        v-if="renjuMounted"
        class="research-panel-face renju-face"
        :class="{ interactive: showRenju && !panelSwipeActive }"
        :style="renjuFaceStyle"
        :aria-hidden="showRenju ? undefined : 'true'"
      />
    </div>
    <div class="research-mode-dots" role="group" aria-label="Research panel view">
      <button
        v-for="mode in modes"
        :key="mode"
        type="button"
        class="research-mode-dot"
        :class="{ active: mode === panelVisibleFace }"
        :data-mode="mode"
        :aria-label="mode === 'research' ? 'Show the research board' : 'Show the shared renju board'"
        :aria-pressed="mode === panelVisibleFace ? 'true' : 'false'"
        @pointerdown.stop
        @click.stop="selectPanelMode(mode)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from "vue-property-decorator";
import PanelSwipe from "../logic/panel-swipe";
import RenjuBoard from "./RenjuBoard.vue";
import { RenjuBackend, RenjuPanelMode } from "../logic/renju-backend";
import { localRenjuPanelStorageKey } from "../logic/renju";

@Component({ components: { RenjuBoard } })
export default class ResearchPanel extends Mixins(PanelSwipe) {
  showRenju = false;
  renjuMounted = false;

  mounted() {
    // No backend call: the visible face is this viewer's own, so there is nothing to fetch. That
    // also means `ensure_renju_assignment` now runs when someone first opens the board (via
    // RenjuBoard.vue's own mount) rather than when anyone opens the Gaia game - the first person to
    // reach for it still creates the row and locks in the colour shuffle for everyone.
    this.showRenju = window.localStorage.getItem(this.localPanelStorageKey) === "renju";
    this.renjuMounted = this.showRenju;
  }

  // ---- PanelSwipe contract -------------------------------------------------

  get panelFaces(): [string, string] {
    return ["research", "renju"];
  }

  get panelVisibleFace(): string {
    return this.showRenju ? "renju" : "research";
  }

  get panelSwipeIgnoreSelector(): string {
    return "button, .lf-renju-overlay";
  }

  panelSwipePrepare() {
    this.renjuMounted = true;
  }

  panelSwipeCommit(face: string) {
    this.setPanelMode(face as RenjuPanelMode);
  }

  // ---- faces ---------------------------------------------------------------

  get modes(): RenjuPanelMode[] {
    return ["research", "renju"];
  }

  get researchFaceStyle(): Record<string, string> {
    return { transform: this.panelFaceTransform("research") };
  }

  get renjuFaceStyle(): Record<string, string> {
    return { transform: this.panelFaceTransform("renju") };
  }

  get renjuBackend(): RenjuBackend | null {
    return this.$store.state.renjuBackend ?? null;
  }

  get localPanelStorageKey(): string {
    const search = typeof window === "undefined" ? "" : window.location.search;
    return localRenjuPanelStorageKey(search, this.renjuBackend?.userId ?? null);
  }

  selectPanelMode(mode: RenjuPanelMode) {
    if (mode === this.panelVisibleFace) {
      return;
    }
    this.setPanelMode(mode);
  }

  // ---- which face this viewer is looking at --------------------------------
  // Purely local (owner request: the side games are not shared state). The renju POSITION is still
  // shared through RenjuBackend - it's the same board everyone plays on - but whether your research
  // panel is currently showing it is yours alone, and is remembered per Gaia game so leaving and
  // re-entering the game brings back the face you left on. Nothing here awaits the network, so a
  // swipe can never be locked out or snapped back by someone else's write.

  private applyPanelMode(mode: RenjuPanelMode) {
    if (mode === "renju" && !this.showRenju) {
      this.$root.$emit("bv::hide::tooltip");
    }
    if (mode === "renju") {
      this.renjuMounted = true;
    }
    this.showRenju = mode === "renju";
  }

  private setPanelMode(mode: RenjuPanelMode) {
    this.applyPanelMode(mode);
    window.localStorage.setItem(this.localPanelStorageKey, mode);
  }
}
</script>

<style lang="scss" scoped>
.research-panel {
  position: relative;
  // Vertical scrolling stays with the page; horizontal drags belong to the drawer. Pinch zoom
  // remains native even when the gesture starts anywhere on this panel.
  touch-action: pan-y pinch-zoom;
}

.research-panel-viewport {
  position: relative;
  width: 100%;
  overflow: hidden;

  &.settling .research-panel-face {
    transition: transform 180ms ease-out;
  }
}

.research-panel-face {
  width: 100%;
  will-change: transform;
  backface-visibility: hidden;
  // The hidden face must not receive the release tap of a swipe - on this panel that tap would be a
  // real Gaia move, not just a tile highlight.
  pointer-events: none;

  &.interactive {
    pointer-events: auto;
  }
}

.renju-face {
  position: absolute;
  z-index: 1;
  inset: 0;
  overflow: hidden;
  border-radius: 9px;
}

.research-mode-dots {
  position: absolute;
  z-index: 3;
  right: 7px;
  bottom: 4px;
  display: flex;
  height: 7px;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 0;
}

.research-mode-dot {
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
</style>
