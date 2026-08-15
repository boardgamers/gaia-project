<template>
  <div class="cancel-trigger-picker">
    <div class="cancel-trigger-picker__hint">Pick whose move you want to watch.</div>
    <div class="cancel-trigger-picker__row d-flex flex-wrap">
      <button
        v-for="opponent in opponents"
        :key="opponent.seat"
        type="button"
        class="cancel-trigger-picker__chip"
        :class="{ 'cancel-trigger-picker__chip--dim': opponent.status === 'passed' }"
        :style="{ '--chip-color': opponent.color }"
        @click="$emit('pick-opponent', opponent.seat)"
      >
        {{ opponent.label }}
        <small v-if="opponent.status">{{ opponent.status === "on-turn" ? "on turn" : "passed" }}</small>
      </button>
    </div>
    <div class="cancel-trigger-picker__rule"></div>
    <div class="d-flex flex-wrap">
      <button
        type="button"
        class="cancel-trigger-picker__chip cancel-trigger-picker__chip--leech"
        @click="$emit('pick-leech')"
      >
        ⚡ I gain power
        <small>from leech</small>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import Engine, { PlayerEnum } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";
import { factionColor } from "../graphics/utils";

type OpponentChip = {
  seat: number;
  label: string;
  color: string;
  status: "on-turn" | "passed" | null;
};

// §8.2 - the picker step, rendered inside the premove sheet's body (it used to be a b-modal, which
// bounced the player from the bottom of the screen to the middle mid-flow). One chip per opponent in
// faction colours, plus the "⚡ I gain power" condition chip below the divider, visually distinct
// since it watches the owner's own state rather than an opponent.
//
// EVERY chip stays clickable. The status badge is informational only:
//
//  - "on turn" - this opponent is the one the game is currently waiting on. That used to be read off
//    `previewAvailableCommandsFor(seat) === null` and rendered as a DISABLED chip labelled "passed",
//    which was wrong twice over. That method answers "can *I* premove?", where "it is already this
//    seat's turn" correctly means no; reused here it silently turned into "this opponent has
//    passed". The result was that the opponent you are most likely to want to watch - the one you
//    are sitting off-turn waiting for - was the only one you could not pick, and the UI lied about
//    why. `pickCancelTriggerOpponent` composes against its own clone with `forcePremovePreviewTurn`,
//    so an on-turn opponent works fine; the lockout was purely cosmetic.
//  - "passed" - genuinely passed this round (`passedPlayers`). Still pickable on purpose: a trigger
//    armed now is still live next round, and so is the queue it guards.
@Component
export default class CancelTriggerPicker extends Vue {
  @Prop()
  seat: number;

  get engine(): Engine {
    return this.$store.state.data;
  }

  get opponents(): OpponentChip[] {
    const passed: PlayerEnum[] = this.engine.passedPlayers ?? [];
    const onTurn = this.engine.playerToMove;
    return this.engine.players
      .map((pl) => pl.player)
      .filter((seat) => seat !== this.seat && !!this.engine.players[seat]?.faction)
      .map((seat) => {
        const faction = this.engine.players[seat].faction;
        return {
          seat,
          label: factionName(faction),
          color: factionColor(faction),
          status: passed.includes(seat) ? "passed" : seat === onTurn ? "on-turn" : null,
        } as OpponentChip;
      });
  }
}
</script>

<style lang="scss" scoped>
.cancel-trigger-picker {
  &__hint {
    font-size: 0.78rem;
    color: var(--ui-text-muted);
    margin-bottom: 0.4rem;
  }

  &__row {
    gap: 0.3rem;
  }

  &__rule {
    height: 1px;
    background: var(--ui-border);
    margin: 0.5rem 0;
  }

  &__chip {
    border: 2px solid var(--chip-color, var(--ui-border-strong));
    border-radius: 10px;
    padding: 0.3rem 0.7rem;
    background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
    color: var(--ui-secondary-text);
    font-weight: 600;
    font-size: 0.82rem;
    line-height: 1.2;
    text-align: center;
    box-shadow: 0 1px 2px var(--ui-shadow-soft);
    cursor: pointer;

    small {
      display: block;
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ui-text-muted);
    }

    // Passed opponents read as secondary but stay fully clickable - see the class comment above.
    &--dim {
      opacity: 0.55;
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

      small {
        color: #7a5b00;
      }
    }
  }
}
</style>
