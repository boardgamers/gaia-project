<template>
  <div class="setup-preview">
    <div class="d-flex align-items-center flex-wrap mb-2" style="gap: 0.5rem">
      <span class="text-muted small">Seed</span>
      <code>{{ seed }}</code>
      <b-button size="sm" variant="outline-secondary" @click="showSeedTools = !showSeedTools">
        {{ showSeedTools ? "Hide seed tools" : "Seed tools" }}
      </b-button>
      <b-button size="sm" variant="outline-secondary" :disabled="history.length === 0" @click="goBack">
        Previous seed
      </b-button>
      <b-button size="sm" variant="secondary" @click="reroll">Reroll</b-button>
      <b-button size="sm" variant="outline-secondary" @click="resetRotations">Reset rotations</b-button>
    </div>
    <b-collapse :visible="showSeedTools" class="mb-2">
      <div class="d-flex align-items-center flex-wrap" style="gap: 0.5rem">
        <b-form-input v-model="seedInput" size="sm" style="max-width: 18rem" @keyup.enter="useTypedSeed" />
        <b-button size="sm" variant="outline-secondary" @click="useTypedSeed">Use seed</b-button>
        <b-button size="sm" variant="outline-secondary" @click="copySeed">Copy seed</b-button>
      </div>
    </b-collapse>
    <b-alert :show="!!error" variant="warning">{{ error }}</b-alert>
    <div ref="board"></div>
  </div>
</template>

<script lang="ts">
import Engine from "@gaia-project/engine";
import Vue from "vue";
import { Component, Prop, Watch } from "vue-property-decorator";
import { makeStore } from "../store";
import { setViewportZoomLocked } from "./viewport";
import { randomSeed } from "./new-game";
import SetupPreviewBoard from "./SetupPreviewBoard.vue";
import { buildRotateMove, validateRotation } from "./setup-preview";

type Store = ReturnType<typeof makeStore>;

@Component<SetupPreview>({
  components: { SetupPreviewBoard },
})
export default class SetupPreview extends Vue {
  @Prop({ required: true })
  playerCount: number;

  @Prop({ default: false })
  officialCenterSectors: boolean;

  seed: string = randomSeed();
  seedInput = "";
  history: string[] = [];
  error: string | null = null;
  showSeedTools = false;

  private nestedStore: Store = null;
  private nestedApp: Vue = null;

  mounted() {
    this.seedInput = this.seed;
    setViewportZoomLocked(false);
    this.nestedStore = makeStore();
    this.rebuild();
    this.nestedApp = new Vue({
      store: this.nestedStore,
      render: (h) => h(SetupPreviewBoard),
    }).$mount(this.$refs.board as Element);

    this.nestedStore.subscribeAction(({ type, payload }) => {
      if (type === "hexClick") {
        this.nestedStore.commit("rotate", payload.hex);
        this.emitState();
      }
    });
  }

  beforeDestroy() {
    setViewportZoomLocked(true);
    this.nestedApp?.$destroy();
  }

  @Watch("playerCount")
  onPlayerCountChanged() {
    this.history = [];
    this.setSeed(randomSeed());
  }

  @Watch("officialCenterSectors")
  onOfficialCenterSectorsChanged() {
    this.rebuild();
  }

  private rebuild() {
    const engine = new Engine([`init ${this.playerCount} ${this.seed}`], {
      lostFleet: true,
      officialCenterSectors: this.officialCenterSectors,
    });
    this.nestedStore.commit("receiveData", engine);
    this.armClickToRotate();
    this.emitState();
  }

  private armClickToRotate() {
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
    this.emitState();
  }

  copySeed() {
    navigator.clipboard?.writeText(this.seed);
  }

  private rotateMove(): string {
    return buildRotateMove(this.playerCount, this.nestedStore.state.context.rotation);
  }

  private emitState() {
    const rotateMove = this.rotateMove();
    const result = validateRotation(this.playerCount, this.seed, rotateMove, this.officialCenterSectors);
    this.error = result.valid ? null : result.error;
    this.$emit("update", { seed: this.seed, rotateMove, valid: result.valid });
  }
}
</script>
