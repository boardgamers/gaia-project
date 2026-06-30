<template>
  <div>
    <Game />
    <b-modal v-model="modalShow" size="lg" @ok="handleOK" :title="modalTitle">
      <b-container fluid>
        <b-row class="my-1" v-if="modalMode === 'load'">
          <b-col sm="3">Type</b-col>
          <b-col sm="9">
            <b-form-group>
              <b-form-radio v-model="loadType" value="load">Load</b-form-radio>
              <b-form-radio v-model="loadType" value="strictReplay">Strict Replay</b-form-radio>
              <b-form-radio v-model="loadType" value="permissiveReplay">Permissive Replay</b-form-radio>
            </b-form-group>
          </b-col>
        </b-row>
        <b-row class="my-1" v-if="modalMode === 'load'">
          <b-col sm="3">Stop Move</b-col>
          <b-col sm="9">
            <b-form-input v-model="stopMove" />
          </b-col>
        </b-row>
      </b-container>
      <b-textarea v-model="text" rows="6" :readonly="modalMode !== 'load'" />
    </b-modal>
    <b-modal v-model="scenarioModalShow" size="xl" hide-footer title="Lost Fleet Test Scenarios">
      <p class="text-muted mb-3">
        Load a curated Lost Fleet state directly in the viewer, or open a short bookmarkable URL for it.
      </p>
      <div
        v-for="scenario in scenarios"
        :key="scenario.id"
        class="scenario-entry"
      >
        <div class="scenario-entry__body">
          <div class="scenario-entry__copy">
            <div class="scenario-entry__title">{{ scenario.label }}</div>
            <div class="scenario-entry__description">{{ scenario.description }}</div>
            <div class="scenario-entry__meta">{{ scenario.id }}</div>
            <div class="scenario-entry__tags">
              <span
                v-for="tag in scenario.tags"
                :key="`${scenario.id}-${tag}`"
                class="scenario-entry__tag"
              >
                {{ tag }}
              </span>
            </div>
          </div>
          <div class="scenario-entry__actions">
            <b-button size="sm" variant="primary" @click="loadScenario(scenario.id)">Load</b-button>
            <a class="btn btn-sm btn-outline-secondary" :href="scenarioUrl(scenario.id)">Open Link</a>
          </div>
        </div>
      </div>
      <p class="text-muted mb-0">
        Use <strong>Share URL</strong> for custom positions you build yourself.
      </p>
    </b-modal>
    <div class="d-flex align-content-stretch">
      <b-button @click="openScenarios">Test Scenarios</b-button>
      <b-button @click="openLoad">Load</b-button>
      <b-button @click="openExport">Export</b-button>
      <b-button @click="openShareUrl">Share URL</b-button>
      <b-btn variant="info" size="sm" @click="startReplay" v-if="!replayData">Replay</b-btn>
      <div v-else class="d-flex align-items-center">
        <b-btn size="sm" class="mr-1" @click="replayTo(replayData.start)">⏮️</b-btn>
        <b-btn
          size="sm"
          class="mx-1"
          accesskey="["
          @click="replayTo(Math.max(replayData.start, replayData.current - 1))"
        >
          ⏪
        </b-btn>
        <span
          class="mx-1 text-center"
          style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex-grow: 1"
        >
          {{ replayData.current }} / {{ replayData.end }}
        </span>
        <b-btn size="sm" class="mx-1" accesskey="]" @click="replayTo(Math.min(replayData.end, replayData.current + 1))">
          ⏩
        </b-btn>
        <b-btn size="sm" class="mx-1" @click="replayTo(replayData.end)">⏭️</b-btn>
        <b-btn size="sm" class="ml-1" @click="endReplay">⏹️</b-btn>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import Game from "./Game.vue";
import { LoadFromJson, LoadFromJsonType } from "../store";
import { buildScenarioUrl, loadScenarioEngineData, selfContainedScenarios } from "../self-contained-scenarios";
import { buildStateUrl } from "../self-contained-state";

@Component({
  components: { Game },
})
export default class Wrapper extends Vue {
  modalMode: "load" | "export" | "share" = "load";
  modalShow = false;
  scenarioModalShow = false;
  loadType = LoadFromJsonType.load;
  stopMove = "";
  text = "";
  replayData: { stard: number; end: number; current: number } | null = null;
  scenarios = selfContainedScenarios;

  get modalTitle() {
    switch (this.modalMode) {
      case "export":
        return "Export JSON";
      case "share":
        return "Share URL";
      default:
        return "Load from JSON";
    }
  }

  handleOK() {
    if (this.modalMode !== "load") {
      return;
    }

    this.$store.dispatch("loadFromJSON", {
      engineData: JSON.parse(this.text),
      type: this.loadType,
      stopMove: this.stopMove
    } as LoadFromJson);
  }

  openLoad() {
    this.modalMode = "load";
    this.modalShow = true;
  }

  openScenarios() {
    this.scenarioModalShow = true;
  }

  openExport() {
    this.modalMode = "export";
    this.text = JSON.stringify(this.$store.state.data);
    this.modalShow = true;
  }

  openShareUrl() {
    this.modalMode = "share";
    this.text = buildStateUrl(window.location.href, this.$store.state.data);
    this.modalShow = true;
  }

  scenarioUrl(id: string) {
    return buildScenarioUrl(window.location.href, id);
  }

  loadScenario(id: string) {
    this.$store.dispatch("loadFromJSON", {
      engineData: loadScenarioEngineData(id),
      type: LoadFromJsonType.load,
    } as LoadFromJson);
    this.scenarioModalShow = false;
    window.history.replaceState({}, "", this.scenarioUrl(id));
  }

  startReplay() {
    this.$store.dispatch("replayStart");
  }

  replayTo(dest: number) {
    this.$store.dispatch("replayTo", dest);
  }

  endReplay() {
    this.$store.dispatch("replayEnd");
    this.replayData = null;
  }

  mounted() {
    const unsub = this.$store.subscribeAction(({ type, payload }) => {
      if (type === "replayInfo") {
        this.replayData = payload;
      }
    });
    this.$on("hook:beforeDestroy", unsub);
  }
}
</script>
<style lang="scss" scoped>
.btn {
  margin: 0.3rem;
}

.scenario-entry {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding: 0.9rem 0;
}

.scenario-entry:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.scenario-entry__body {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.scenario-entry__copy {
  min-width: 0;
}

.scenario-entry__title {
  font-size: 1rem;
  font-weight: 700;
}

.scenario-entry__description {
  color: #4a4a4a;
  margin-top: 0.15rem;
}

.scenario-entry__meta {
  color: #7a7a7a;
  font-family: monospace;
  font-size: 0.78rem;
  margin-top: 0.35rem;
}

.scenario-entry__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.55rem;
}

.scenario-entry__tag {
  background: #eef3f8;
  border-radius: 999px;
  color: #35506d;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.55rem;
  text-transform: lowercase;
}

.scenario-entry__actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
}

@media (max-width: 767px) {
  .scenario-entry__body {
    flex-direction: column;
  }

  .scenario-entry__actions {
    width: 100%;
  }
}
</style>
