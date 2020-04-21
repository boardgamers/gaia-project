<template>
  <Game />
</template>
<script lang="ts">
import {Vue, Component, Prop, Watch} from "vue-property-decorator";
import Game from './components/Game.vue';
import {Client} from 'boardgame.io/dist/cjs/client';

const client = new Client({game: {setup() {return {}}}});

@Component
export default class App extends Vue {

}

</script>
