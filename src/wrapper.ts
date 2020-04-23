// Import vue component
import launch from './launcher';

let globalItem: any;
if (typeof window !== 'undefined') {
	globalItem = window;
} else if (typeof global !== 'undefined') {
  globalItem = global;
}

if (globalItem) {
  globalItem.launch = launch;
}

// To allow use as module (npm/webpack/etc.) export component
export default launch;