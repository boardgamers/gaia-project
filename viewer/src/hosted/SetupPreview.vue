<template>
  <div class="setup-preview">
    <div class="d-flex align-items-center flex-wrap mb-2" style="gap: 0.5rem">
      <b-form-input v-model="seedInput" size="sm" style="max-width: 18rem" @keyup.enter="useTypedSeed" />
      <b-button size="sm" variant="outline-secondary" @click="useTypedSeed">Use seed</b-button>
      <b-button size="sm" variant="outline-secondary" @click="copySeed">Copy seed</b-button>
      <b-button size="sm" variant="outline-secondary" :disabled="history.length === 0" @click="goBack">
        ← Previous seed
      </b-button>
      <b-button size="sm" variant="secondary" @click="reroll">Reroll</b-button>
      <b-button size="sm" variant="outline-secondary" @click="resetRotations">Reset rotations</b-button>
    </div>
    <p class="text-muted small mb-2">
      Seed: <code>{{ seed }}</code> — click a sector on the map below to rotate it, live. Rotate freely; lock in
      once you're happy with the setup.
    </p>
    <b-alert :show="!!error" variant="warning">{{ error }}</b-alert>
    <div ref="board"></div>
    <div class="mt-2">
      <b-button variant="primary" :disabled="!!error" @click="lockIn">Lock in this setup</b-button>
    </div>
  </div>
</template>

<script lang="ts">
import Engine from "@gaia-project/engine";
import Vue from "vue";
import { Component, Prop, Watch } from "vue-property-decorator";
import { makeStore } from "../store";
import { randomSeed } from "./new-game";
import SetupPreviewBoard from "./SetupPreviewBoard.vue";
import { buildRotateMove, validateRotation } from "./setup-preview";

type Store = ReturnType<typeof makeStore>;

/**
 * "Generate & preview setup" screen: repeatedly reroll a seed and see the
 * full resulting Lost Fleet setup (map/boosters/techs/scoring/ships/etc.)
 * rendered with real components, click sectors to rotate them live, then
 * lock in once satisfied. Faction selection is out of scope (SetupFaction
 * happens later, unaffected).
 *
 * Mounted inside Lobby.vue's plain (store-less) Vue tree, so this component
 * cannot rely on `this.$store` for the preview board — it builds its own
 * nested Vue app with its own store (mirrors launcher.ts's `launch()` /
 * hosted.ts's `mountChild()` pattern) and mounts it into the `board` ref.
 */
@Component<SetupPreview>({
  components: { SetupPreviewBoard },
})
export default class SetupPreview extends Vue {
  @Prop({ required: true })
  playerCount: number;

  seed: string = randomSeed();
  seedInput = "";
  history: string[] = [];
  error: string | null = null;

  private nestedStore: Store = null;
  private nestedApp: Vue = null;

  mounted() {
    this.seedInput = this.seed;
    this.nestedStore = makeStore();
    // Populate the store with a real engine BEFORE the nested app's first
    // mount: SpaceMap and friends dereference engine.map unconditionally, and
    // the store's default state is a bare `new Engine()` with no map yet —
    // rendering that would throw during the nested app's very first (never
    // batched) render, which can leave its watcher unable to recover on the
    // reactive updates that follow.
    this.rebuild();
    this.nestedApp = new Vue({
      store: this.nestedStore,
      render: (h) => h(SetupPreviewBoard),
    }).$mount(this.$refs.board as Element);

    // Click-to-rotate, always live, no arming step: every hex click dispatches
    // (selectAnyHex: true), and we turn that into a rotation increment
    // directly against our own nested store instance. Mirrors
    // logic/buttons/setup.ts's sectorRotationButton, minus the button chain.
    this.nestedStore.subscribeAction(({ type, payload }) => {
      if (type === "hexClick") {
        this.nestedStore.commit("rotate", payload.hex);
        this.revalidate();
      }
    });
  }

  beforeDestroy() {
    this.nestedApp?.$destroy();
  }

  @Watch("playerCount")
  onPlayerCountChanged() {
    // A seed's draws are player-count-dependent: reusing the old seed at a
    // different count isn't a meaningful "same setup" to keep.
    this.history = [];
    this.setSeed(randomSeed());
  }

  private rebuild() {
    const engine = new Engine([`init ${this.playerCount} ${this.seed}`], { lostFleet: true });
    this.nestedStore.commit("receiveData", engine);
    this.armClickToRotate();
    this.error = null;
  }

  private armClickToRotate() {
    // Cheap and idempotent to redo after every receiveData: receiveData
    // resets context.rotation but not context.highlighted.hexes, so this
    // isn't strictly required after the first call, but re-arming costs
    // nothing and keeps this resilient to future receiveData changes.
    this.nestedStore.commit("highlightHexes", { hexes: new Map(), backgroundLight: true, selectAnyHex: true });
  }

  private setSeed(seed: string) {
    if (this.seed) {
      this.history.push(this.seed);
    }
    this.seed = seed;
    this.seedInput = seed;
    this.rebuild();
  }

  reroll() {
    this.setSeed(randomSeed());
  }

  useTypedSeed() {
    const trimmed = this.seedInput.trim();
    if (trimmed && trimmed !== this.seed) {
      this.setSeed(trimmed);
    }
  }

  goBack() {
    const previous = this.history.pop();
    if (previous !== undefined) {
      this.seed = previous;
      this.seedInput = previous;
      this.rebuild();
    }
  }

  resetRotations() {
    this.nestedStore.commit("receiveData", this.nestedStore.state.data);
    this.armClickToRotate();
    this.error = null;
  }

  copySeed() {
    navigator.clipboard?.writeText(this.seed);
  }

  private rotateMove(): string {
    return buildRotateMove(this.playerCount, this.nestedStore.state.context.rotation);
  }

  private revalidate() {
    const result = validateRotation(this.playerCount, this.seed, this.rotateMove());
    this.error = result.valid ? null : result.error;
  }

  lockIn() {
    const rotateMove = this.rotateMove();
    const result = validateRotation(this.playerCount, this.seed, rotateMove);
    if (!result.valid) {
      this.error = result.error;
      return;
    }
    this.$emit("lock-in", { seed: this.seed, rotateMove });
  }
}
</script>
