<template>
  <div>
    <Game />
    <b-modal v-model="modalShow" size="lg" @ok="handleOK" title="Load from JSON">
      <b-textarea v-model="text" rows=6 />
    </b-modal>
    <b-avatar button style="position: fixed; left: 20px; bottom: 20px; z-index: 100" size=50 @click="modalShow = true">
      LOAD
    </b-avatar>
    <b-avatar button style="position: fixed; left: 80px; bottom: 20px; z-index: 100" size=50 @click="openExport">
      EXPORT
    </b-avatar>
  </div>
</template>
<script lang="ts">
import { Vue, Prop, Watch, Component } from "vue-property-decorator";
import Game from "./Game.vue";

@Component({
  components: { Game }
})
export default class Wrapper extends Vue {
  modalShow = false;
  text = "";

  handleOK () {
    this.$store.dispatch("gaiaViewer/loadFromJSON", JSON.parse(this.text));
  }

  openExport () {
    this.text = JSON.stringify(this.$store.state.gaiaViewer.data);
    this.modalShow = true;
  }
}

</script>
<style lang="scss">
.b-avatar-custom {
  display: contents !important;
}
</style>
