import BootstrapVue from 'bootstrap-vue';
import Vue from 'vue';
import launch from './launcher';
import launchSelfContained from './self-contained';

Vue.use(BootstrapVue);
Vue.config.productionTip = false;

console.log(process.env);

if (process.env.VUE_APP_BGIO) {
  launch("#app");
} else if (process.env.VUE_APP_SelfContained || 1) {
  launchSelfContained();
} /* else {
  launch("#app");
} */
