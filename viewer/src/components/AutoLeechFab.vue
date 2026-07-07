<template>
  <div class="auto-leech-fab" :style="{ '--auto-leech-bottom-offset': `${bottomOffset}px` }">
    <b-dropdown
      right
      dropup
      boundary="window"
      :popper-opts="{ positionFixed: true }"
      variant="outline-secondary"
      class="auto-leech-fab__menu"
      v-b-tooltip.hover
      title="Auto leech: automatically accept or decline power-charge offers up to this amount, instead of asking every time"
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
    </b-dropdown>
  </div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "AutoLeechFab",
  props: {
    bottomOffset: { type: Number, default: 0 },
  },
  computed: {
    autoChargePower(): string {
      return String((this as any).$store.state.preferences.autoChargePower ?? "ask");
    },
    autoChargePowerOptions(): Array<{ value: string; text: string }> {
      return [
        { value: "ask", text: "Auto leech: off (ask every time)" },
        { value: "decline-cost", text: "Auto leech: free only (decline anything with a cost)" },
        { value: "1", text: "Auto leech: up to 1 power" },
        { value: "2", text: "Auto leech: up to 2 power" },
        { value: "3", text: "Auto leech: up to 3 power" },
        { value: "4", text: "Auto leech: up to 4 power" },
        { value: "5", text: "Auto leech: up to 5 power" },
      ];
    },
    autoChargePowerActive(): boolean {
      return (this as any).autoChargePower !== "ask";
    },
    autoChargePowerShortLabel(): string {
      switch ((this as any).autoChargePower) {
        case "ask":
          return "Leech: off";
        case "decline-cost":
          return "Leech: free";
        default:
          return `Leech: ${(this as any).autoChargePower}`;
      }
    },
  },
  methods: {
    setAutoChargePower(value: string) {
      (this as any).$store.commit("preferences", { autoChargePower: value });
    },
  },
});
</script>

<style lang="scss" scoped>
.auto-leech-fab {
  position: fixed;
  right: calc(0.9rem + env(safe-area-inset-right));
  bottom: calc(var(--auto-leech-bottom-offset, 0px) + 1rem + env(safe-area-inset-bottom));
  z-index: 1028;
}

.auto-leech-fab__menu ::v-deep(.btn) {
  border-radius: 999px;
  border-color: rgba(31, 45, 82, 0.14);
  background: linear-gradient(180deg, #ffffff 0%, #e7ebf3 100%);
  color: #33415c;
  box-shadow: 0 10px 28px rgba(20, 26, 50, 0.18), 0 1px 2px rgba(31, 45, 82, 0.08);
  padding: 0.38rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 600;
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

@media (min-width: 768px) {
  .auto-leech-fab {
    right: 1.1rem;
    bottom: calc(var(--auto-leech-bottom-offset, 0px) + 1.1rem);
  }
}
</style>
