<template>
  <div class="d-flex flex-wrap" style="justify-content: center; align-items: center">
    <template v-for="(c, i) in content.filter((c) => c.length > 0)">
      <svg
        v-if="typeof c !== 'string'"
        :viewBox="`-10 -13 ${c.length * 25} 25`"
        :width="c.length * 30"
        height="36"
        :key="i"
      >
        <Resource
          v-for="(r, j) in c"
          :key="j"
          :transform="`translate(${j * 20}, -1) scale(${r.type === 'vp' ? 1.3 : 1.15})`"
          :kind="r.type"
          :count="r.count"
        />
      </svg>
      <svg v-else-if="c === 'arrow'" :key="i" viewBox="0 0 10 10" width="20" height="20">
        <use xlink:href="#arrow" x="-2" y="5" />
      </svg>
      <div v-else v-html="c" :key="i" class="text" />
    </template>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ResourceText } from "../../graphics/utils";

@Component
export default class ResourcesText extends Vue {
  @Prop()
  content: ResourceText;
}
</script>

<style lang="scss" scoped>
.text {
  margin: 2px;
}
</style>
