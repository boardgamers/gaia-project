<template>
  <div v-if="visible" class="charge-wait">
    <span
      >{{ waiting ? "Waiting for charges" : "Pending charges" }}: <span>{{ names }}</span></span
    >
    <button v-if="canWait || waiting" type="button" class="btn btn-link btn-sm" @click="changeWait">
      {{ waiting ? "Resume" : "Wait" }}
    </button>
  </div>
</template>

<script lang="ts">
import Engine, { Command } from "@gaia-project/engine";
import { chargesToWaitFor, hasConcurrentCharges, waitingForCharges } from "@gaia-project/engine/src/pending-charges";
import { Component, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";

@Component
export default class ChargeWait extends Vue {
  get engine(): Engine {
    return this.$store.state.data;
  }
  get seat(): number {
    return this.$store.state.player?.index ?? (this.$store.state.player === null ? this.engine.playerToMove : -1);
  }
  get others() {
    return this.engine.pendingCharges.filter((charge) => charge.player !== this.seat);
  }
  get visible() {
    return this.seat >= 0 && hasConcurrentCharges(this.engine) && this.others.length > 0;
  }
  get waiting() {
    return waitingForCharges(this.engine, this.seat);
  }
  get canWait() {
    return chargesToWaitFor(this.engine, this.seat).length > 0;
  }
  get names() {
    return [...new Set(this.others.map((charge) => factionName(this.engine.player(charge.player).faction)))].join(", ");
  }
  changeWait() {
    this.$emit(
      "command",
      `${this.engine.player(this.seat).faction} ${this.waiting ? Command.ResumeCharges : Command.WaitForCharges}`
    );
  }
}
</script>

<style scoped>
.charge-wait {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 0.5rem;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  opacity: 0.85;
}
.charge-wait .btn {
  padding: 0.25rem;
}
</style>
