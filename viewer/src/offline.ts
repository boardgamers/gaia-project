import Vue from "vue";
import OfflineLobby from "./components/OfflineLobby.vue";
import CreateGame from "./hosted/CreateGame.vue";
import { initTheme } from "./hosted/theme";
import { setViewportZoomLocked } from "./hosted/viewport";
import { requestPersistentOfflineStorage } from "./offline-game";

export default function launchOffline(selector = "#app"): Vue {
  initTheme();
  setViewportZoomLocked(true);
  requestPersistentOfflineStorage().catch(() => undefined);

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const component = params.has("create") ? CreateGame : OfflineLobby;
  const props = params.has("create") ? { offline: true } : {};

  return new Vue({ render: (h) => h(component, { props }) }).$mount(selector);
}
