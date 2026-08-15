<template>
  <div class="cancel-trigger-picker">
    <h5 class="mb-2">What should cancel my premoves?</h5>
    <div class="cancel-trigger-picker__row d-flex flex-wrap align-items-center">
      <button
        v-for="opponent in opponents"
        :key="opponent.seat"
        type="button"
        class="cancel-trigger-picker__chip mr-2 mb-2"
        :class="{ 'cancel-trigger-picker__chip--disabled': opponent.passed }"
        :style="{ '--chip-color': opponent.color }"
        :disabled="opponent.passed"
        @click="$emit('pick-opponent', opponent.seat)"
      >
        {{ opponent.label }}
        <small v-if="opponent.passed" class="d-block text-muted">passed</small>
      </button>
      <span class="cancel-trigger-picker__divider mr-2 mb-2" aria-hidden="true"></span>
      <button
        type="button"
        class="cancel-trigger-picker__chip cancel-trigger-picker__chip--leech mb-2"
        @click="$emit('pick-leech')"
      >
        ⚡ If leech gained
      </button>
    </div>
    <button type="button" class="btn btn-link btn-sm p-0 mt-1" @click="$emit('cancel')">Cancel</button>
  </div>
</template>

<script lang="ts">
import Engine, { PlayerEnum } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";
import { factionColor } from "../graphics/utils";

type OpponentChip = { seat: number; label: string; color: string; passed: boolean };

// §8.2 - the single picker screen "⚠ Cancel trigger" opens: one chip per opponent (in faction
// colours, greyed out and labelled "passed" for anyone who has passed this round -
// previewAvailableCommandsFor returns null for them) plus the "⚡ If leech gained" condition chip at
// the end of the same row, visually distinct since it watches the owner's own state rather than an
// opponent. Future condition triggers are meant to join this same row - there is no separate
// "presets" section.
@Component
export default class CancelTriggerPicker extends Vue {
  @Prop()
  seat: number;

  get engine(): Engine {
    return this.$store.state.data;
  }

  get opponents(): OpponentChip[] {
    return this.engine.players
      .map((pl) => pl.player)
      .filter((seat) => seat !== this.seat && !!this.engine.players[seat]?.faction)
      .map((seat) => {
        const faction = this.engine.players[seat].faction;
        return {
          seat,
          label: factionName(faction),
          color: factionColor(faction),
          passed: this.engine.previewAvailableCommandsFor(seat as PlayerEnum) === null,
        };
      });
  }
}
</script>

<style lang="scss" scoped>
.cancel-trigger-picker {
  &__row {
    gap: 0.1rem;
  }

  &__chip {
    border: 2px solid var(--chip-color, var(--ui-border-strong));
    border-radius: 10px;
    padding: 0.35rem 0.7rem;
    background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
    color: var(--ui-secondary-text);
    font-weight: 600;
    box-shadow: 0 1px 2px var(--ui-shadow-soft);

    &--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &--leech {
      border-style: dashed;
      border-color: var(--ui-border-strong);
      background: linear-gradient(
        180deg,
        var(--ui-warning-gradient-start, #fff3cd) 0%,
        var(--ui-warning-gradient-end, #ffe9a8) 100%
      );
      color: #7a5b00;
    }
  }

  &__divider {
    width: 1px;
    align-self: stretch;
    background: var(--ui-border);
  }
}
</style>
