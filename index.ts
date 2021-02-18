import Game from './src/components/Game.vue';

import { gaiaViewer, makeStore } from './src/store';
import launch from './src/launcher';
import launchSelfContained from './src/self-contained';

export {Game, gaiaViewer, makeStore, launchSelfContained};
export default launch;