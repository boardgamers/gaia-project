<template>
  <div v-if="open" class="info-modal-backdrop" @click.self="$emit('close')">
    <div class="info-modal shadow-lg" role="dialog" aria-modal="true" :aria-label="title">
      <div class="info-modal__header">
        <h4 class="info-modal__title mb-0">{{ title }}</h4>
        <button type="button" class="info-modal__close" aria-label="Close" @click="$emit('close')">&times;</button>
      </div>
      <div class="info-modal__body">
        <slot />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "InfoModal",
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, required: true },
  },
});
</script>

<style lang="scss" scoped>
.info-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: var(--ui-backdrop);
}

.info-modal {
  width: min(100%, 42rem);
  overflow: hidden;
  border: 1px solid var(--ui-border-strong);
  border-radius: 0.85rem;
  background: linear-gradient(180deg, var(--ui-surface-raised) 0%, var(--ui-surface) 100%);
  color: var(--ui-text);
}

.info-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.1rem 0.85rem;
  border-bottom: 1px solid var(--ui-border);
}

.info-modal__title {
  font-size: 1.05rem;
}

.info-modal__close {
  border: 0;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 1.5rem;
  line-height: 1;
  padding: 0;
}

.info-modal__close:hover {
  color: var(--ui-text);
}

.info-modal__body {
  padding: 1rem 1.1rem 1.15rem;
  max-height: min(68vh, 32rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--ui-text);
}
</style>
