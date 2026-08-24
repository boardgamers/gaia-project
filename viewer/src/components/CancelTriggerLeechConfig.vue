<template>
  <div class="cancel-trigger-leech-config">
    <div class="mb-2">
      <label class="d-block mb-1">
        <input type="radio" value="offered" v-model="mode" class="mr-1" />
        offered to me
      </label>
      <label class="d-block mb-1">
        <input type="radio" value="gained" v-model="mode" class="mr-1" />
        taken by me
      </label>
    </div>
    <div class="mb-2 d-flex align-items-center">
      at least
      <input type="number" min="1" class="mx-2 cancel-trigger-leech-config__amount" v-model.number="minPower" />
      power
    </div>

    <div class="cancel-trigger-leech-config__preview text-muted small">{{ previewText }}</div>
  </div>
</template>

<script lang="ts">
import Engine from "@gaia-project/engine";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { moveAtoms } from "../logic/premove-cancel-trigger";

// §2.6/§8.4 - no composing, no refine: the config IS the trigger. Default mode 'gained' with
// minPower 2 (charging N power costs N-1 VP, so 2 is the first threshold that costs anything -
// owner decision, not optional, see §2.6).
//
// Body-only: the sheet that hosts this step (PremoveBar) draws the title in its header band and the
// Arm/Back pair in its footer, so every step of the cancel-trigger flow confirms from the same spot
// instead of each one growing its own buttons wherever it happens to be rendered. This component
// therefore just reports its current value upward via `input` and never arms anything itself.
@Component
export default class CancelTriggerLeechConfig extends Vue {
  @Prop()
  seat: number;

  /** Editing an already-armed trigger seeds the form with its current config. */
  @Prop({ default: null })
  initialConfig: { mode: "gained" | "offered"; minPower: number } | null;

  mode: "gained" | "offered" = "gained";
  minPower = 2;

  created() {
    if (this.initialConfig) {
      this.mode = this.initialConfig.mode;
      this.minPower = this.initialConfig.minPower;
    }
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get ownMoves(): string[] {
    const faction = this.engine.players[this.seat]?.faction;
    if (!faction) {
      return [];
    }
    return this.engine.moveHistory.slice(1).filter((line) => line.startsWith(`${faction} `));
  }

  get wouldHaveFiredCount(): number {
    const map = this.engine.map as any;
    let count = 0;
    for (const line of this.ownMoves) {
      const atoms = moveAtoms(line, map);
      const hit = atoms.some((atom) => {
        const [command, arg] = atom.split(":");
        if (command !== "charge" && (command !== "decline" || this.mode !== "offered")) {
          return false;
        }
        const amount = parseInt(arg ?? "", 10);
        return !Number.isNaN(amount) && amount >= this.minPower;
      });
      if (hit) {
        count++;
      }
    }
    return count;
  }

  get previewText(): string {
    return `This would have fired ${this.wouldHaveFiredCount} time${
      this.wouldHaveFiredCount === 1 ? "" : "s"
    } so far this game.`;
  }

  mounted() {
    this.emitState();
  }

  /** Reports the current config to the host sheet, or `null` while it isn't armable - the footer's
   * "Arm rule" button is disabled on exactly that null. */
  @Watch("mode")
  @Watch("minPower")
  emitState() {
    this.$emit("input", this.minPower >= 1 ? { mode: this.mode, minPower: this.minPower } : null);
  }
}
</script>

<style lang="scss" scoped>
.cancel-trigger-leech-config__amount {
  width: 3.5rem;
  text-align: center;
}
</style>
