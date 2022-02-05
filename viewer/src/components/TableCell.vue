<template>
  <div :class="{ 'd-flex': true, 'flex-column': cells.length > 0 && cells[0].flex === 'column' }">
    <div
      v-for="(c, i) in cells"
      :key="i"
      :class="{ first: i === 0, 'info-table-cell': true, 'flex-grow-1': c.flex === 'rowGrow', compact }"
      :style="c.style"
      v-b-tooltip.html.hover
      :title="c.title"
      @click="convert(c.convert)"
    >
      <div v-if="compact" v-html="c.label[0].text" />
      <RichTextView v-else :content="c.label" />
    </div>
  </div>
</template>
<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { PowerArea, Resource as ResourceEnum } from "@gaia-project/engine";
import { FastConversionEvent } from "../data/actions";
import RichTextView from "./Resources/RichTextView.vue";
import { UiMode } from "../store";
import { InfoTableCell } from "src/logic/table/types";
@Component({
  components: { RichTextView },
})
export default class TableCell extends Vue {
  @Prop()
  cells: InfoTableCell[];

  convert(resource: ResourceEnum | PowerArea) {
    if (resource) {
      this.$store.dispatch("fastConversionClick", { button: resource } as FastConversionEvent);
    }
  }

  get compact(): boolean {
    return this.$store.state.preferences.uiMode == UiMode.compactTable;
  }
}
</script>
<style lang="scss">
.info-table-cell {
  border-width: 0 0 0 1px !important;
  min-height: 36px !important;
  min-width: 16px;
  text-align: center !important;
  padding-left: 2px;
  padding-right: 2px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  cursor: pointer;

  &.compact {
    min-height: 26px !important;
  }

  &.first {
    border-left: 0 !important;
  }
}
</style>
