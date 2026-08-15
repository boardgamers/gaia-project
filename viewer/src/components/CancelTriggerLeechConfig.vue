<template>
  <div class="cancel-trigger-leech-config">
    <h5 class="mb-2">⚡ Cancel if a power charge is …</h5>
    <div class="mb-2">
      <label class="d-block">
        <input type="radio" value="offered" v-model="mode" class="mr-1" />
        offered to me
      </label>
      <label class="d-block">
        <input type="radio" value="gained" v-model="mode" class="mr-1" />
        taken by me
      </label>
    </div>
    <div class="mb-2 d-flex align-items-center">
      at least
      <input type="number" min="1" class="mx-2 cancel-trigger-leech-config__amount" v-model.number="minPower" />
      power
    </div>

    <div class="cancel-trigger-leech-config__preview text-muted small mt-2">{{ previewText }}</div>

    <div class="mt-3 d-flex flex-wrap">
      <button type="button" class="btn btn-warning btn-sm mr-2 mb-1" :disabled="minPower < 1" @click="arm">
        Arm trigger
      </button>
      <button type="button" class="btn btn-link btn-sm mb-1" @click="$emit('cancel')">Cancel</button>
    </div>
  </div>
</template>

<script lang="ts">
import Engine from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import { moveAtoms } from "../logic/premove-cancel-trigger";

// §2.6/§8.4 - no composing, no refine: the config IS the trigger. Default mode 'gained' with
// minPower 2 (charging N power costs N-1 VP, so 2 is the first threshold that costs anything -
// owner decision, not optional, see §2.6).
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

  arm() {
    if (this.minPower < 1) {
      return;
    }
    this.$emit("arm", { mode: this.mode, minPower: this.minPower });
  }
}
</script>

<style lang="scss" scoped>
.cancel-trigger-leech-config__amount {
  width: 3.5rem;
  text-align: center;
}
</style>
