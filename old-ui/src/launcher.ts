import launchCurrent from "../../viewer/src/launcher";
import Game from "./components/Game.vue";
export default function launch(selector: string) {
  return launchCurrent(selector, Game);
}
