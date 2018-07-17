<template>
  <div id="move">
    <div id="move-title">
      <span v-if="init">Pick the number of players</span>
    </div>
    <div id="move-buttons">
      <div v-if="init">
        <button class='btn btn-secondary mr-2 mb-2 move-button' v-for="i in [2,3,4,5]" :data-command="`init ${i} randomSeed`">{{i}} players</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component } from 'vue-property-decorator';
import { AvailableCommand, Command } from '@gaia-project/engine';

@Component<Commands>({
  watch: {
    availableCommands(this: Commands, val) {
      this.loadCommands(val);
    }
  }
})
export default class Commands extends Vue {
  loadCommands(val: AvailableCommand[]) {
    console.log(val);
  }

  get availableCommands() {
    return this.$store.state.game.data.availableCommands;
  }

  get command(): AvailableCommand {
    return this.availableCommands ? this.availableCommands[0] : null;
  }

  get init() {
    return !this.command || this.command.name === Command.Init;
  }
}

</script>

<style lang="scss" scoped>

</style>
