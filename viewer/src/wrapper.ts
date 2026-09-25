import { localizeTutorial } from "./localization";
// Import vue component
import type { TutorialLaunchOptions } from "@boardgamers/protocol/tutorial";
import { createTutorialLauncher } from "@boardgamers/protocol/tutorial";
import launchGame, { destroyViewer } from "./launcher";
import launchOffline from "./self-contained";
import { mountTutorial } from "./tutorial/mount";

const tutorial = createTutorialLauncher(localizeTutorial(mountTutorial));
function launch(selector: string) {
  tutorial.destroy();
  return launchGame(selector);
}
function launchSelfContained(...args: Parameters<typeof launchOffline>) {
  tutorial.destroy();
  return launchOffline(...args);
}
function launchTutorial(selector: string, options: TutorialLaunchOptions) {
  destroyViewer();
  return tutorial.launch(selector, options);
}

let globalItem: any;
if (typeof window !== "undefined") {
  globalItem = window;
} else if (typeof global !== "undefined") {
  globalItem = global;
}

if (globalItem) {
  globalItem.gaiaViewer = { launch, launchSelfContained, launchTutorial };
}

export { launchSelfContained, launchTutorial };
export default launch;
