<template>
  <div class="auto-leech-fab" :style="{ '--auto-leech-bottom-offset': `${bottomOffset}px` }">
    <AutoChargeControl class="auto-leech-fab__menu" dropup />
  </div>
</template>
<script lang="ts">
import Vue from "vue";
import AutoChargeControl from "./AutoChargeControl.vue";
export default Vue.extend({
  name: "AutoLeechFab",
  components: { AutoChargeControl },
  props: { bottomOffset: { type: Number, default: 24 } },
});
</script>
<style lang="scss" scoped>
.auto-leech-fab {
  position: fixed;
  // ChatNotesPanel's 3rem bubble occupies the rightmost 4rem on phones. Keep this pill on the same
  // baseline but one 0.75rem gap to its left, so both controls remain independently tappable.
  right: calc(4.75rem + env(safe-area-inset-right));
  bottom: var(--auto-leech-bottom-offset, 24px);
  z-index: 1028;
}

.auto-leech-fab__menu ::v-deep(.btn) {
  border-radius: 999px;
  border-color: var(--ui-border-strong);
  background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
  color: var(--ui-secondary-text);
  box-shadow:
    0 10px 28px var(--ui-shadow),
    0 1px 2px var(--ui-shadow-soft);
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
    // Desktop docks the chat panel against the right edge (ChatNotesPanel.vue) and reserves its
    // width by padding `#app` - which does nothing for this pill, since `position: fixed` takes it
    // out of that flow entirely, so it ended up hidden behind the dock (owner report). Slide it by
    // the same width instead: `--chat-dock-width` is set alongside that padding in frontend.scss
    // and inherits down here, and is unset (0 via the fallback) whenever the chat is closed or the
    // viewer is self-contained. Transition matches the padding's, so the two move together.
    right: calc(var(--chat-dock-width, 0px) + 1.1rem);
    bottom: 1.1rem;
    transition: right 0.15s ease-out;
  }
}
</style>
