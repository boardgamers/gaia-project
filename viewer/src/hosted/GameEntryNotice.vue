<template>
  <!-- Sits directly under the top banner (HostedBar.vue) - hosted.ts inserts this element right
       after the bar. One dismissible line per player who joined this game while you were already in
       it; driven by presence-roster diffs in hosted.ts (see its `usersInGame` watcher). -->
  <div v-if="notices.length" class="game-entry-notice">
    <div v-for="notice in notices" :key="notice.id" class="alert alert-info game-entry-notice__item" role="status">
      <span class="game-entry-notice__text">{{ notice.text }}</span>
      <button type="button" class="close game-entry-notice__dismiss" aria-label="Dismiss" @click="dismiss(notice.id)">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";

type Notice = { id: number; text: string };

export default Vue.extend({
  name: "GameEntryNotice",
  data() {
    return {
      notices: [] as Notice[],
      nextId: 1,
    };
  },
  methods: {
    /** Called by hosted.ts when a new player's presence appears in this game. */
    notifyEntered(name: string) {
      const label = name && name.trim() ? name.trim() : "A player";
      this.notices.push({ id: this.nextId++, text: `${label} just entered the game.` });
    },
    dismiss(id: number) {
      this.notices = this.notices.filter((n) => n.id !== id);
    },
  },
});
</script>

<style lang="scss" scoped>
.game-entry-notice {
  padding: 0 0.75rem;
}

.game-entry-notice__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.9rem;
}

.game-entry-notice__text {
  min-width: 0;
}

.game-entry-notice__dismiss {
  font-size: 1.2rem;
  line-height: 1;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
}
</style>
