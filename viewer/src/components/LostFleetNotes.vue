<template>
  <!-- A yellow sticky note that fills whatever height is left under the round-booster/federation Pool
       in the Lost Fleet sidebar (see Game.vue's `.lf-sidebar-col`), so the sidebar column ends level
       with the ship boards and the note never spills below them on mobile. Tapping anywhere focuses
       the textarea (the label is pointer-events:none), so a phone pops the keyboard on the first tap. -->
  <div class="lost-fleet-notes" @click="focusArea">
    <span class="lost-fleet-notes__label" aria-hidden="true">notes</span>
    <!-- `@keydown.stop`: the viewer's move-button/log keyboard shortcuts listen on `window`, so
         without this every letter typed here would also fire a game shortcut (and steal focus into a
         modal). Stopping propagation keeps the keystroke in the textarea while shielding those global
         handlers - it never preventDefaults, so normal typing/newlines are unaffected. -->
    <textarea
      ref="area"
      v-model="text"
      class="lost-fleet-notes__area"
      :placeholder="placeholder"
      aria-label="Private game notes"
      @input="onInput"
      @keydown.stop
    ></textarea>
    <span v-if="status" class="lost-fleet-notes__status" aria-hidden="true">{{ status }}</span>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Watch } from "vue-property-decorator";
import { NotesBackend } from "../store";

const SAVE_DEBOUNCE_MS = 1200;

/** The Lost Fleet sidebar's private notes sheet. Its text is the same per-game private note the chat
 * panel used to hold: in hosted play the store carries a `notesBackend` (a Supabase `game_notes`
 * adapter injected by hosted.ts, synced across the player's devices); in self-contained/hot-seat play
 * there is no backend, so it persists to localStorage for this browser only. */
@Component
export default class LostFleetNotes extends Vue {
  text = "";
  status = "";
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private serverLoaded = false;

  get backend(): NotesBackend | null {
    return this.$store.state.notesBackend;
  }

  get placeholder(): string {
    return this.backend ? "Private notes for this game — synced to your devices." : "Private notes for this game.";
  }

  // Load as soon as a backend is available. In hosted play hosted.ts injects the backend just after
  // the viewer mounts (so after this component's own mounted hook), hence a watcher rather than a
  // one-shot load - `immediate` also covers the self-contained case where it stays null.
  @Watch("backend", { immediate: true })
  onBackendChange() {
    this.load();
  }

  async load() {
    if (this.backend) {
      try {
        this.text = await this.backend.load();
        this.serverLoaded = true;
      } catch {
        // Leave whatever's there (e.g. a local draft) if the server read fails.
      }
    } else if (!this.serverLoaded) {
      this.text = this.readLocal();
    }
  }

  onInput() {
    this.status = "Saving…";
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS);
  }

  async save() {
    if (this.backend) {
      try {
        await this.backend.save(this.text);
        this.status = "Saved";
      } catch {
        this.status = "Not saved";
      }
    } else {
      this.writeLocal(this.text);
      this.status = "Saved";
    }
  }

  focusArea() {
    (this.$refs.area as HTMLTextAreaElement | undefined)?.focus();
  }

  private localKey(): string {
    // Self-contained games have no id; key by the launch query (seed/players/etc.) so two different
    // local setups keep separate notes, and reopening the same one restores them.
    const search = typeof window !== "undefined" ? window.location.search : "";
    return `lost-fleet-notes:${search}`;
  }

  private readLocal(): string {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem(this.localKey()) ?? "";
  }

  private writeLocal(body: string) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(this.localKey(), body);
    }
  }

  beforeDestroy() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      // Flush any pending edit so closing/switching the game doesn't drop the last keystrokes.
      this.save();
    }
  }
}
</script>

<style lang="scss" scoped>
.lost-fleet-notes {
  position: relative;
  display: flex;
  flex-direction: column;
  // Fills the leftover height under the Pool so the sidebar column bottoms out level with the ship
  // boards; a small floor keeps it usable when that leftover is tiny (2-3 ship game).
  flex: 1 1 auto;
  min-height: 3rem;
  border-radius: 5px;
  border: 2px solid #e6d24a;
  // Warm sticky-note yellow, with a faint top-lit gradient so it reads as paper, not a flat swatch.
  background: linear-gradient(160deg, #fff9b0 0%, #fdf07a 100%);
  box-shadow: 0 1px 4px var(--ui-shadow);
  overflow: hidden;
  cursor: text;
}

.lost-fleet-notes__label {
  position: absolute;
  top: 0.15rem;
  left: 0.4rem;
  // Cursive, tiny, top-left - a handwritten "notes" caption on the sticky.
  font-family: "Segoe Script", "Bradley Hand", "Snell Roundhand", "Brush Script MT", cursive;
  font-size: 0.72rem;
  font-style: italic;
  font-weight: 700;
  color: #9a7b12;
  pointer-events: none;
  user-select: none;
}

.lost-fleet-notes__area {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  resize: none;
  border: 0;
  background: transparent;
  // Same size as the final-scoring tile text (10px SVG ≈ 11px on screen), in a cursive hand so it
  // reads as a jotted note rather than UI copy (owner request: same size, different font, cursive).
  font-family: "Segoe Script", "Bradley Hand", "Snell Roundhand", "Brush Script MT", cursive;
  font-size: 11px;
  line-height: 1.25;
  color: #4a3d05;
  // Clear the "notes" caption at the top-left.
  padding: 1.35rem 0.45rem 0.4rem;

  &::placeholder {
    color: #9a8420;
    opacity: 0.8;
  }

  &:focus {
    outline: none;
  }
}

.lost-fleet-notes__status {
  position: absolute;
  bottom: 0.15rem;
  right: 0.4rem;
  font-size: 0.6rem;
  color: #9a7b12;
  opacity: 0.75;
  pointer-events: none;
}
</style>
