<template>
  <div
    v-if="plan.notice && noticeId !== dismissedId"
    class="premove-notice small d-flex align-items-center"
    :class="plan.notice.kind === 'stopped' ? 'text-warning' : 'text-muted'"
    role="status"
  >
    <span>{{ plan.notice.text }}</span>
    <button
      type="button"
      class="dismiss-notice btn btn-sm btn-link ml-2"
      aria-label="Dismiss premove notice"
      @click="dismiss"
    >
      <span aria-hidden="true">✕</span>
    </button>
  </div>
</template>

<script lang="ts">
import type { PremovePlan } from "@gaia-project/engine/src/premove-types";
import Vue from "vue";

export default Vue.extend({
  props: {
    plan: { type: Object as () => PremovePlan, required: true },
    moveHistory: { type: String, default: "" },
    storageKey: { type: String, required: true },
  },
  data: () => ({ dismissedId: "" }),
  computed: {
    noticeContext(): string[] {
      return [this.storageKey, this.noticeId, this.moveHistory];
    },
    noticeId(): string {
      return JSON.stringify([this.plan.requestId, this.plan.revision, this.plan.notice]);
    },
  },
  watch: {
    noticeContext(current: string[], previous: string[]) {
      // Refetches and new notices must survive; acknowledge an unchanged notice after play advances.
      if (current[0] === previous[0] && current[1] === previous[1] && current[2] !== previous[2]) {
        this.dismiss();
      }
    },
    storageKey: {
      immediate: true,
      handler(key: string) {
        this.dismissedId = "";
        try {
          this.dismissedId = window.localStorage.getItem(key) ?? "";
        } catch {
          // Dismissal still works for this view when browser storage is unavailable.
        }
      },
    },
  },
  methods: {
    dismiss() {
      this.dismissedId = this.noticeId;
      try {
        window.localStorage.setItem(this.storageKey, this.dismissedId);
      } catch {
        // Keep the in-memory dismissal without affecting the saved premove queue.
      }
    },
  },
});
</script>

<style scoped>
.dismiss-notice {
  color: inherit;
  flex-shrink: 0;
}
</style>
