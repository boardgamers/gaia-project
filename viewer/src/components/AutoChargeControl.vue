<template>
  <b-dropdown
    size="sm"
    variant="outline-secondary"
    right
    :dropup="dropup"
    boundary="window"
    :popper-opts="{ positionFixed: true }"
    class="auto-leech-select"
    title="Auto-charge: automatically accept or decline power-charge offers up to this amount, instead of asking every time"
  >
    <template #button-content>
      <span class="auto-leech-dot" :class="autoChargePowerActive ? 'active' : 'inactive'"></span>
      {{ autoChargePowerShortLabel }}
    </template>
    <b-dropdown-item
      v-for="opt in autoChargePowerOptions"
      :key="opt.value"
      :active="opt.value === autoChargePower"
      @click="setAutoChargePower(opt.value)"
    >
      {{ opt.text }}
    </b-dropdown-item>
    <template v-if="showAutoChargePassedCapOptions">
      <b-dropdown-divider />
      <b-dropdown-item
        v-for="opt in autoChargePassedCapOptions"
        :key="`passed-${opt.value}`"
        :active="opt.value === autoChargeMaxPassedRoundLeech"
        @click="setAutoChargeMaxPassedRoundLeech(opt.value)"
      >
        {{ opt.text }}
      </b-dropdown-item>
    </template>
  </b-dropdown>
</template>
<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
@Component
export default class AutoChargeControl extends Vue {
  @Prop({ default: false }) dropup: boolean;
  get autoChargePower(): string {
    return String(
      this.$store.state.hosted
        ? (this.$store.state.playerSettings?.autoCharge ?? "ask")
        : (this.$store.state.preferences.autoChargePower ?? "ask")
    );
  }

  get autoChargeMaxPassedRoundLeech(): string {
    return String(
      this.$store.state.hosted
        ? (this.$store.state.playerSettings?.autoChargeMaxPassedRoundLeech ?? "0")
        : (this.$store.state.preferences.autoChargeMaxPassedRoundLeech ?? "0")
    );
  }

  get autoChargePowerOptions() {
    return [
      { value: "ask", text: "Auto-charge: off (ask every time)" },
      { value: "decline-cost", text: "Auto-charge: free only (decline anything with a cost)" },
      { value: "1", text: "Auto-charge: up to 1 power" },
      { value: "2", text: "Auto-charge: up to 2 power" },
      { value: "3", text: "Auto-charge: up to 3 power" },
      { value: "4", text: "Auto-charge: up to 4 power" },
      { value: "5", text: "Auto-charge: up to 5 power" },
    ];
  }

  get autoChargePassedCapOptions() {
    return [
      { value: "0", text: "After passing: no total cap" },
      { value: "1", text: "After passing: max 1 total power" },
      { value: "2", text: "After passing: max 2 total power" },
      { value: "3", text: "After passing: max 3 total power" },
      { value: "4", text: "After passing: max 4 total power" },
      { value: "5", text: "After passing: max 5 total power" },
    ];
  }

  get showAutoChargePassedCapOptions(): boolean {
    const player = this.$store.state.player?.index ?? this.$store.state.data.currentPlayer;
    return player !== undefined && (this.$store.state.data.passedPlayers ?? []).includes(player);
  }

  setAutoChargePower(value: string) {
    if (this.$store.state.hosted) this.$store.dispatch("updatePlayerSetting", { name: "autoCharge", value });
    else this.$store.commit("preferences", { autoChargePower: value });
  }

  setAutoChargeMaxPassedRoundLeech(value: string) {
    if (this.$store.state.hosted)
      this.$store.dispatch("updatePlayerSetting", { name: "autoChargeMaxPassedRoundLeech", value });
    else this.$store.commit("preferences", { autoChargeMaxPassedRoundLeech: value });
  }

  get autoChargePowerActive(): boolean {
    return this.autoChargePower !== "ask";
  }

  /** Short label for the auto-leech dropdown button itself - the full sentence lives in the menu
   * options (autoChargePowerOptions), not on the button, so the button doesn't force the status
   * line next to it to wrap. */
  get autoChargePowerShortLabel(): string {
    const cap = this.showAutoChargePassedCapOptions ? this.autoChargeMaxPassedRoundLeech : "0";
    switch (this.autoChargePower) {
      case "ask":
        return "Charge: off";
      case "decline-cost":
        return cap === "0" ? "Charge: free" : `Charge: free cap ${cap}`;
      default:
        return cap === "0" ? `Charge: ${this.autoChargePower}` : `Charge: ${this.autoChargePower} cap ${cap}`;
    }
  }
}
</script>

<style lang="scss" scoped>
.auto-leech-select ::v-deep(.dropdown-menu) {
  max-width: calc(100vw - 16px);
  min-width: min(24rem, calc(100vw - 16px));
}
.auto-leech-select ::v-deep(.dropdown-item) {
  white-space: normal;
}

.auto-leech-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 0.3rem;
  border-radius: 50%;

  &.inactive {
    background: var(--oxide, #ff160a);
  }

  &.active {
    background: var(--highlighted, #2c4);
    animation: auto-leech-pulse 1.6s infinite;
  }
}

@keyframes auto-leech-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--highlighted-rgb, 32, 204, 68), 0.7);
  }
  70% {
    box-shadow: 0 0 0 5px rgba(var(--highlighted-rgb, 32, 204, 68), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--highlighted-rgb, 32, 204, 68), 0);
  }
}
</style>
