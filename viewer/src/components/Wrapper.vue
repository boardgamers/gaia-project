<template>
  <div>
    <Game />
    <b-modal v-model="modalShow" size="lg" @ok="handleOK" title="Load from JSON">
      <b-container fluid>
        <b-row class="my-1">
          <b-col sm="3">Type</b-col>
          <b-col sm="9">
            <b-form-group>
              <b-form-radio v-model="loadType" value="load">Load</b-form-radio>
              <b-form-radio v-model="loadType" value="strictReplay">Strict Replay</b-form-radio>
              <b-form-radio v-model="loadType" value="permissiveReplay">Permissive Replay</b-form-radio>
            </b-form-group>
          </b-col>
        </b-row>
        <b-row class="my-1">
          <b-col sm="3">Stop Move</b-col>
          <b-col sm="9">
            <b-form-input v-model="stopMove" />
          </b-col>
        </b-row>
      </b-container>
      <b-textarea v-model="text" rows="6" />
    </b-modal>
    <div class="d-flex align-content-stretch">
      <b-button @click="modalShow = true">Load</b-button>
      <b-button @click="openExport">Export</b-button>
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

@Component({
  components: { Game },
})
export default class Wrapper extends Vue {
  modalShow = false;
  loadType = LoadFromJsonType.load;
  stopMove = "";
  text = "";
  replayData: { stard: number; end: number; current: number } | null = null;

  handleOK() {
    this.$store.dispatch("loadFromJSON", {
      engineData: JSON.parse(this.text),
      type: this.loadType,
      stopMove: this.stopMove
    } as LoadFromJson);
  }

  openExport() {
    this.text = JSON.stringify(this.$store.state.data);
    this.modalShow = true;
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
</style>
