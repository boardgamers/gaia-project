import Game from "./src/components/Game.vue";
import launch from "./src/launcher";
import launchSelfContained from "./src/self-contained";
import { gaiaViewer, makeStore } from "./src/store";

export { Game, gaiaViewer, makeStore, launchSelfContained };
export default launch;
