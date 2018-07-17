<template>
  <div class="container">
    <div :class="['alert', 'alert-warning', 'fade', {show: !dismissed}]" role="alert" v-if="error" @transitionend="removeError">
      {{error}}
      <button type="button" class="close" aria-label="Fermer" @click="dismissed=true">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>

    <div :class="['alert', 'alert-info', 'fade', {show: !infoDismissed}]" role="alert" v-if="info" @transitionend="removeInfo">
      {{info}}
      <button type="button" class="close" aria-label="Fermer" @click="infoDismissed=true">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component } from 'vue-property-decorator';

@Component<Alert>({
  watch: {
    error(val) {
      this.dismissed = false;
    },

    info(val) {
      this.infoDismissed = false;
    }
  }
})
export default class Alert extends Vue {
  get error() {
    return this.$store.state.error;
  }

  get info() {
    return this.$store.state.info;
  }

  removeError() {
    this.$store.commit('removeError');
  }

  removeInfo() {
    this.$store.commit('removeInfo');
  }

  dismissed = false;
  infoDismissed = false;
}

</script>
