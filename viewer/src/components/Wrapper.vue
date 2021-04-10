<template>
  <div>
    <Game />
    <b-modal v-model="modalShow" size="lg" @ok="handleOK" title="Load from JSON">
      <b-textarea v-model="text" rows="6" />
    </b-modal>
    <b-modal id="final-scoring" size="lg" title="Final Scoring" dialog-class="gaia-viewer-modal">
      <b-table
        striped
        bordered
        small
        responsive="true"
        hover
        :items="finalScoringItems"
        :fields="finalScoringFields"
        class="final-store-table"
      >
        <template #cell(Name)="data">
          <span v-html="data.value"></span>
        </template>
        <template #cell()="data">
          <b-checkbox :checked="data.value" disabled />
        </template>
      </b-table>
    </b-modal>
    <b-avatar
      button
      style="position: fixed; left: 20px; bottom: 20px; z-index: 100"
      size="50"
      @click="modalShow = true"
    >
      LOAD
    </b-avatar>
    <b-avatar button style="position: fixed; left: 80px; bottom: 20px; z-index: 100" size="50" @click="openExport">
      EXPORT
    </b-avatar>
  </div>
</template>
<script lang="ts">
import {Component, Vue} from "vue-property-decorator";
import Game from "./Game.vue";
import {finalScoringFields, finalScoringItems} from "../logic/final-scoring";

@Component({
  components: {Game},
  computed: {
    finalScoringFields() {
      return finalScoringFields(document.getElementById("root"));
    },
    finalScoringItems(): any[] {
      return finalScoringItems(document.getElementById("root"));
    }
  }
})
export default class Wrapper extends Vue {
  modalShow = false;
  text = "";

  handleOK() {
    this.$store.dispatch("gaiaViewer/loadFromJSON", JSON.parse(this.text));
  }

  openExport() {
    this.text = JSON.stringify(this.$store.state.gaiaViewer.data);
    this.modalShow = true;
  }
}
</script>
<style lang="scss">
.b-avatar-custom {
  display: contents !important;
}

.final-store-table th > span > span,
.final-store-table th > div {
  display: block;
}
</style>
