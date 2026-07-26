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
        :disabled="panelModeSaving"
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
import { RenjuBackend, RenjuPanelMode, RenjuRow } from "../logic/renju-backend";
import { localRenjuPanelStorageKey } from "../logic/renju";

@Component({ components: { RenjuBoard } })
export default class ResearchPanel extends Mixins(PanelSwipe) {
  showRenju = false;
  renjuMounted = false;
  panelModeSaving = false;

  private renjuUnsubscribe: (() => void) | null = null;
  private panelModeIntent = 0;
  private pendingPanelMode: RenjuPanelMode | null = null;
  private latestPanelUpdatedAt = 0;
  private localPanelModeOverride = false;
  private localPanelModeBaseline = 0;

  mounted() {
    const backend = this.renjuBackend;
    if (!backend) {
      this.showRenju = window.localStorage.getItem(this.localPanelStorageKey) === "renju";
      this.renjuMounted = this.showRenju;
      return;
    }
    this.renjuUnsubscribe = backend.subscribe((row) => this.applyPanelRow(row));
    const loadIntent = this.panelModeIntent;
    backend
      .load()
      .then((row) => {
        // A four-player assignment can make this first request noticeably slower. Never let its
        // pre-swipe snapshot overwrite a newer local choice when it eventually returns.
        if (row && loadIntent === this.panelModeIntent) {
          this.applyPanelRow(row);
        }
      })
      .catch(() => undefined);
  }

  beforeDestroy() {
    if (this.renjuUnsubscribe) {
      this.renjuUnsubscribe();
    }
  }

  // ---- PanelSwipe contract -------------------------------------------------

  get panelFaces(): [string, string] {
    return ["research", "renju"];
  }

  get panelVisibleFace(): string {
    return this.showRenju ? "renju" : "research";
  }

  get panelSwipeLocked(): boolean {
    return this.panelModeSaving;
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
    return localRenjuPanelStorageKey(typeof window === "undefined" ? "" : window.location.search);
  }

  selectPanelMode(mode: RenjuPanelMode) {
    if (mode === this.panelVisibleFace) {
      return;
    }
    this.setPanelMode(mode);
  }

  // ---- shared mode ---------------------------------------------------------
  // Same ordering rules the chess drawer learned from live play: ignore stale snapshots, keep a
  // spectator's local-only face until a genuinely newer participant change supersedes it, and never
  // let a failed write leave the panel showing a face nobody committed.

  private applyPanelRow(row: RenjuRow) {
    const updatedAt = row.updated_at ? Date.parse(row.updated_at) : 0;
    if (updatedAt && updatedAt < this.latestPanelUpdatedAt) {
      return;
    }
    if (updatedAt) {
      this.latestPanelUpdatedAt = updatedAt;
    }
    if (this.localPanelModeOverride && (!updatedAt || updatedAt <= this.localPanelModeBaseline)) {
      return;
    }
    if (this.localPanelModeOverride) {
      this.localPanelModeOverride = false;
    }
    if (this.pendingPanelMode && row.panel_mode !== this.pendingPanelMode) {
      return;
    }
    this.applyPanelMode(row.panel_mode);
  }

  private applyPanelMode(mode: RenjuPanelMode) {
    if (mode === "renju" && !this.showRenju) {
      this.$root.$emit("bv::hide::tooltip");
    }
    if (mode === "renju") {
      this.renjuMounted = true;
    }
    this.showRenju = mode === "renju";
  }

  private async setPanelMode(mode: RenjuPanelMode) {
    if (this.panelModeSaving) {
      return;
    }
    const previousMode: RenjuPanelMode = this.showRenju ? "renju" : "research";
    const intent = ++this.panelModeIntent;
    this.pendingPanelMode = mode;
    this.applyPanelMode(mode);

    const backend = this.renjuBackend;
    if (!backend) {
      window.localStorage.setItem(this.localPanelStorageKey, mode);
      this.pendingPanelMode = null;
      return;
    }

    this.panelModeSaving = true;
    try {
      const row = await backend.setPanelMode(mode);
      if (intent === this.panelModeIntent) {
        this.pendingPanelMode = null;
        if (row) {
          this.localPanelModeOverride = false;
          this.applyPanelRow(row);
        } else {
          // A null row means the shared write was unavailable (normally because this viewer is a
          // spectator). Keep the chosen face locally; the next newer shared row still wins.
          this.localPanelModeOverride = true;
          this.localPanelModeBaseline = this.latestPanelUpdatedAt;
        }
      }
    } catch (error) {
      this.pendingPanelMode = null;
      this.localPanelModeOverride = false;
      try {
        const row = await backend.load();
        if (intent === this.panelModeIntent) {
          row ? this.applyPanelRow(row) : this.applyPanelMode(previousMode);
        }
      } catch (loadError) {
        if (intent === this.panelModeIntent) {
          this.applyPanelMode(previousMode);
        }
      }
    } finally {
      this.panelModeSaving = false;
    }
  }
}
</script>

<style lang="scss" scoped>
.research-panel {
  position: relative;
  // Vertical scrolling stays with the page; horizontal drags belong to the drawer.
  touch-action: pan-y;
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

  &:disabled {
    cursor: wait;
  }
}
</style>
