import run from "../../viewer/src/self-contained";
import Game from "./components/Game.vue";
export default function launchSelfContained(selector = "#app", debug = true) {
  return run(selector, debug, Game);
}
