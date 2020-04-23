// Import vue component
import launch from './launcher';
import launchSelfContained from './self-contained';

let globalItem: any;
if (typeof window !== 'undefined') {
	globalItem = window;
} else if (typeof global !== 'undefined') {
  globalItem = global;
}

if (globalItem) {
  globalItem.gaiaViewer = {launch, launchSelfContained};
}

export {launchSelfContained};
export default launch;