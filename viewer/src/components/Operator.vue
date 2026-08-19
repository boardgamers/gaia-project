<template>
  <g class="operator">
    <image
      xlink:href="../assets/operators/build.svg"
      v-if="condition !== 'step' && condition !== 'a'"
      width="15"
      :height="(1152 / 584) * 15"
      :transform="`translate(-22,-24)`"
    />
  </g>
</template>
<script lang="ts">
import { Condition as ConditionEnum, Operator as OperatorEnum } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
  components: {},
})
export default class Operator extends Vue {
  @Prop()
  condition!: ConditionEnum;

  @Prop()
  operator: OperatorEnum;

  get isTrigger() {
    return this.operator === OperatorEnum.Trigger;
  }
}
</script>
