import BootstrapVue from 'bootstrap-vue';
import Vue from 'vue';
import App from './App.vue';
import AppBGIO from './AppBGIO.vue';
import Game from './components/Game.vue';
import store from './store';

Vue.use(BootstrapVue);
Vue.config.productionTip = false;

let selected: any = App;

console.log(process.env);

if (process.env.VUE_APP_BGIO) {
  selected = AppBGIO;
}

if (process.env.VUE_APP_SelfContained) {
  selected = Game;
}

new Vue({
  store,
  render: (h) => h(selected),
}).$mount('#app');
