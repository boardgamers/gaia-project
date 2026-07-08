<template>
  <div class="open-game-preview">
    <div v-if="error" class="text-muted small">{{ error }}</div>
    <div v-else ref="board"></div>
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

  private nestedStore: Store = null;
  private nestedApp: Vue = null;

  mounted() {
    this.nestedStore = makeStore();
    this.nestedApp = new Vue({
      store: this.nestedStore,
      render: (h) => h(SetupPreviewBoard),
    }).$mount(this.$refs.board as Element);
    this.renderGame();
  }

  beforeDestroy() {
    this.nestedApp?.$destroy();
  }

  @Watch("game", { deep: true })
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
