<template>
  <div class="cancel-trigger-refine">
    <div class="cancel-trigger-refine__hint">Which part of this should cancel my queue?</div>
    <div v-for="(candidate, i) in candidates" :key="candidate.exact" class="cancel-trigger-refine__row mb-2">
      <label class="d-flex align-items-center mb-1">
        <input type="checkbox" class="mr-2" v-model="selected[i]" />
        {{ candidate.label }}
      </label>
      <div v-if="selected[i] && candidate.any" class="cancel-trigger-refine__toggle btn-group btn-group-sm ml-4">
        <button
          type="button"
          class="btn"
          :class="loose[i] ? 'btn-outline-secondary' : 'btn-secondary'"
          @click="loose[i] = false"
        >
          exact
        </button>
        <button
          type="button"
          class="btn"
          :class="loose[i] ? 'btn-secondary' : 'btn-outline-secondary'"
          @click="loose[i] = true"
        >
          any
        </button>
      </div>
    </div>

    <div class="cancel-trigger-refine__preview text-muted small mt-2">{{ previewText }}</div>
  </div>
</template>

<script lang="ts">
import Engine from "@gaia-project/engine";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { atomMatches, candidateAtoms, moveAtoms } from "../logic/premove-cancel-trigger";

// §2.3/§8.3 - the refine step, the most important UI decision in the feature: nothing is
// pre-selected (Arm stays disabled until at least one atom is chosen) UNLESS the composed move
// produced exactly one candidate atom, which pre-selects itself since there's no ambiguity to ask
// about. Each selection can be loosened to its "any" form where one exists (§2.4).
//
// Body-only, same split as CancelTriggerLeechConfig: the host sheet (PremoveBar) owns the header
// band and the Arm/Back footer, so this component only reports its current atom selection upward via
// `input` and never arms anything itself.
@Component
export default class CancelTriggerRefine extends Vue {
  @Prop()
  move: string;

  @Prop()
  watchedSeat: number;

  /** Editing an already-armed trigger (PremoveBar's "Edit") seeds the current selection instead of
   * the fresh-compose default below, rather than making the player re-pick from scratch. */
  @Prop({ default: () => [] })
  initialAtoms: string[];

  selected: boolean[] = [];
  loose: boolean[] = [];

  get engine(): Engine {
    return this.$store.state.data;
  }

  get candidates() {
    return candidateAtoms(this.move, this.engine.map as any);
  }

  @Watch("move", { immediate: true })
  onMoveChanged() {
    const candidates = this.candidates;
    if (this.initialAtoms.length > 0) {
      this.selected = candidates.map(
        (c) => this.initialAtoms.includes(c.exact) || (!!c.any && this.initialAtoms.includes(c.any))
      );
      this.loose = candidates.map((c) => !!c.any && this.initialAtoms.includes(c.any));
      return;
    }
    // Exception (§2.3): a move producing exactly one atom pre-selects it - no point asking a
    // one-answer question. Everything else starts fully unselected.
    this.selected = candidates.map((_, i) => candidates.length === 1);
    this.loose = candidates.map(() => false);
  }

  get selectedAtoms(): string[] {
    return this.candidates
      .map((candidate, i) =>
        this.selected[i] ? (this.loose[i] && candidate.any ? candidate.any : candidate.exact) : null
      )
      .filter((atom): atom is string => atom !== null);
  }

  mounted() {
    this.emitState();
  }

  /** Reports the current selection to the host sheet. Watching the computed rather than emitting
   * from each control keeps the "exact/any" toggle and the checkboxes on one path. Not `immediate`:
   * `onMoveChanged` seeds `selected`/`loose` from its own immediate watcher, and the two would race
   * on first render - `mounted()` above covers the initial value instead. */
  @Watch("selectedAtoms")
  emitState() {
    this.$emit("input", this.selectedAtoms);
  }

  /** The watched opponent's own committed move lines so far (moveHistory carries the faction name,
   * not the numeric seat, so lines are matched by that faction's prefix). */
  get watchedMoves(): string[] {
    const faction = this.engine.players[this.watchedSeat]?.faction;
    if (!faction) {
      return [];
    }
    return this.engine.moveHistory.slice(1).filter((line) => line.startsWith(`${faction} `));
  }

  get wouldHaveFiredCount(): number {
    const atoms = this.selectedAtoms;
    if (atoms.length === 0) {
      return 0;
    }
    const map = this.engine.map as any;
    return this.watchedMoves.filter((line) => {
      const actual = moveAtoms(line, map);
      return atoms.some((stored) => actual.some((a) => atomMatches(stored, a)));
    }).length;
  }

  get previewText(): string {
    const total = this.watchedMoves.length;
    if (total === 0) {
      return "This opponent hasn't moved yet this game.";
    }
    if (this.selectedAtoms.length === 0) {
      return `Select at least one row to see how often it would have fired (out of ${total} move${
        total === 1 ? "" : "s"
      } so far).`;
    }
    return `This would have fired on ${this.wouldHaveFiredCount} of this opponent's last ${total} move${
      total === 1 ? "" : "s"
    }.`;
  }
}
</script>

<style lang="scss" scoped>
.cancel-trigger-refine__toggle .btn {
  padding: 0.1rem 0.5rem;
}

.cancel-trigger-refine__hint {
  font-size: 0.78rem;
  color: var(--ui-text-muted);
  margin-bottom: 0.4rem;
}
</style>
