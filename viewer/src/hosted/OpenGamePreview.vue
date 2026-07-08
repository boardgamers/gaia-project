<template>
  <div class="open-game-preview">
    <div v-if="error" class="text-muted small">{{ error }}</div>
    <component :is="previewRoot" v-else-if="previewRoot" />
  </div>
</template>

<script lang="ts">
import Engine from "@gaia-project/engine";
import Vue from "vue";
import { Component, Prop, Watch } from "vue-property-decorator";
import { makeStore } from "../store";
import SetupPreviewBoard from "./SetupPreviewBoard.vue";

type Store = ReturnType<typeof makeStore>;

@Component<OpenGamePreview>({
  components: { SetupPreviewBoard },
})
export default class OpenGamePreview extends Vue {
  @Prop({ required: true })
  game: any;

  error: string | null = null;
  previewRoot: any = null;

  private nestedStore: Store = null;

  mounted() {
    this.nestedStore = makeStore();
    const nestedStore = this.nestedStore;
    this.previewRoot = Vue.extend({
      store: nestedStore,
      render: (h) => h(SetupPreviewBoard),
    });
    this.$nextTick(() => this.renderGame());
  }

  get previewSignature(): string {
    return JSON.stringify({
      playerCount: this.game?.player_count ?? null,
      seed: this.game?.seed ?? null,
      setupMove: this.game?.setup_move ?? null,
      options: this.game?.options ?? null,
    });
  }

  @Watch("previewSignature")
  onGameChanged() {
    this.renderGame();
  }

  private renderGame() {
    if (!this.nestedStore || !this.game) {
      return;
    }
    try {
      const moves = [`init ${this.game.player_count} ${this.game.seed}`];
      if (this.game.setup_move) {
        moves.push(this.game.setup_move);
      }
      const engine = new Engine(moves, JSON.parse(JSON.stringify(this.game.options ?? {})));
      engine.generateAvailableCommandsIfNeeded();
      this.nestedStore.commit("receiveData", engine);
      this.error = null;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }
}
</script>

<style lang="scss" scoped>
.open-game-preview {
  overflow: visible;
}
</style>
