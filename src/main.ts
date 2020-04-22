import BootstrapVue from 'bootstrap-vue';
import Vue from 'vue';
import App from './App.vue';
import AppBGIO from './AppBGIO.vue';
import Game from './components/Game.vue';
import launch from './launcher';
import launchSelfContained from './self-contained';

Vue.use(BootstrapVue);
Vue.config.productionTip = false;

console.log(process.env);

if (process.env.VUE_APP_BGIO) {
  launch("#app");
} else if (process.env.VUE_APP_SelfContained) {
  launchSelfContained();
} else {
  launch("#app");
}
