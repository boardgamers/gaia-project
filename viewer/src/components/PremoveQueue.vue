<template>
  <section class="premove-queue" :aria-label="queueEnabled ? 'Your premoves' : 'Planning'">
    <div class="premove-queue__heading">
      <div>
        <strong>{{
          moves.length ? `Your premoves · ${moves.length}` : active ? "Planning · preview only" : "Plan your next turn"
        }}</strong>
        <div class="small text-muted">
          {{
            moves.length
              ? "Attempts each move on your turn with your actual resources. Auto-charge continues as usual."
              : active && previewRound
                ? `Previewing round ${previewRound}. Queued moves will wait for the appropriate round and phase.`
                : active
                  ? "Try moves with the game controls. Nothing is played until you confirm."
                  : queueEnabled
                    ? "Prepare moves for your next turns, even while someone else is playing."
                    : "Try moves and compare plans using the game controls."
          }}
        </div>
      </div>
      <div class="premove-queue__actions">
        <button v-if="active" class="btn btn-sm btn-outline-secondary" @click="$emit('exit')">
          Return to live game
        </button>
        <button
          v-if="moves.length"
          class="btn btn-sm btn-outline-primary"
          :disabled="!canPreview"
          :title="canPreview ? undefined : 'Return to the live game to preview these moves'"
          @click="$emit('view')"
        >
          View on board
        </button>
        <button v-else-if="!active && canPreview" class="btn btn-sm btn-outline-primary" @click="$emit('plan')">
          Plan a move
        </button>
        <button
          v-if="moves.length"
          class="btn btn-sm btn-outline-danger"
          :disabled="pending"
          @click="$emit('cancel', 0)"
        >
          Cancel all
        </button>
      </div>
    </div>
    <ol v-if="moves.length" class="premove-queue__moves">
      <li v-for="(move, index) in moves" :key="index">
        <span v-if="plan.timings" class="premove-queue__price premove-queue__round">{{
          plan.timings[index].round === 0 ? "Setup" : `Round ${plan.timings[index].round}`
        }}</span>
        <span>{{ move }}</span>
        <span
          v-if="isCheapAnalysisBuild(move)"
          class="premove-queue__price"
          title="Stops if the 3c price is unavailable"
          >3c only</span
        >
        <button
          class="btn btn-sm btn-link"
          :disabled="pending"
          :aria-label="`Cancel premove ${index + 1}${index !== moves.length - 1 ? ' and the moves after it' : ''}`"
          @click="$emit('cancel', index)"
        >
          {{ index !== moves.length - 1 ? "Cancel from here" : "Cancel" }}
        </button>
      </li>
    </ol>
    <div v-if="pending" class="small mt-2" role="status">Saving your plan…</div>
    <div
      v-else-if="plan && plan.notice"
      class="small mt-2"
      :class="{ 'text-warning': plan.notice.kind === 'stopped' }"
      role="status"
    >
      {{ plan.notice.text }}
    </div>
  </section>
</template>

<script lang="ts">
import type { PremovePlan } from "@gaia-project/engine/src/premove-types";
import Vue from "vue";
import { isCheapAnalysisBuild } from "../logic/analysis";

export default Vue.extend({
  methods: { isCheapAnalysisBuild },
  props: {
    plan: { type: Object as () => PremovePlan, default: undefined },
    pending: Boolean,
    queueEnabled: { type: Boolean, default: true },
    active: Boolean,
    previewRound: Number,
    canPreview: { type: Boolean, default: true },
  },
  computed: {
    moves(): string[] {
      return this.plan?.moves ?? [];
    },
  },
});
</script>

<style scoped>
.premove-queue {
  background: var(--ui-surface-muted);
  border: 1px solid var(--ui-border-strong);
  border-left: 3px solid var(--ui-info, #4294c4);
  border-radius: 0.4rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}
.premove-queue__heading,
.premove-queue__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.premove-queue__heading {
  justify-content: space-between;
}
.premove-queue__moves {
  padding-left: 1.5rem;
  margin-bottom: 0;
}
.premove-queue__moves li {
  padding-top: 0.35rem;
}
.premove-queue__moves span {
  overflow-wrap: anywhere;
}
.premove-queue__moves button {
  margin-left: 0.5rem;
}
.premove-queue__price {
  margin-left: 0.5rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--ui-border-strong);
  border-radius: 0.25rem;
  font-size: 0.8rem;
}
.premove-queue__round {
  margin-left: 0;
  margin-right: 0.5rem;
  white-space: nowrap;
}
</style>
