import launch from './launcher';
import launchSelfContained from './self-contained';

console.log(process.env);

if (process.env.VUE_APP_BGIO) {
  launch("#app");
} else if (process.env.VUE_APP_SelfContained || 1) {
  launchSelfContained();
} /* else {
  launch("#app");
} */
