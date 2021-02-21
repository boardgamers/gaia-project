import launch from "./launcher";
import launchSelfContained from "./self-contained";

console.log(process.env);

if (process.env.VUE_APP_BGIO) {
  launch("#app");
} /* if (process.env.VUE_APP_SelfContained || 1) */ else {
  launchSelfContained();
} /* else {
  launch("#app");
} */
