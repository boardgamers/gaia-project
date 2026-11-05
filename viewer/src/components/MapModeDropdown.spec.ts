import Engine from "@gaia-project/engine";
import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { MapModeType } from "../data/actions";
import { makeStore, UiMode } from "../store";
import PlayerInfo from "./PlayerInfo.vue";
import Table from "./Table.vue";

Vue.use(BootstrapVue);

for (const [name, component] of [
  ["player board", PlayerInfo],
  ["table", Table],
] as const) {
  describe(`${name} sector dropdown`, () => {
    for (const lostFleet of [false, true]) {
      it(`offers separate Deep Space sectors only in Lost Fleet (lostFleet=${lostFleet})`, async () => {
        const engine = new Engine(["init 2 separate-sector-modes", "p1 faction terrans", "p2 faction xenos"], {
          lostFleet,
        });
        const store = makeStore();
        store.commit("receiveData", engine);
        if (component === Table) {
          store.commit("preferences", { uiMode: UiMode.table });
        }
        const props = component === PlayerInfo ? { player: engine.players[0] } : { players: [engine.players[0]] };
        const { container } = render(component, { props, store });
        const select = container.querySelector("select");
        expect(select).not.to.equal(null);
        expect(select.querySelector('option[value="sectors"]')).not.to.equal(null);
        const deep = select.querySelector('option[value="deepSpaceSectors"]');
        expect(deep !== null).to.equal(lostFleet);
        if (lostFleet) {
          expect(deep.textContent).to.equal("Deep Space sectors");
          await fireEvent.change(select, { target: { value: MapModeType.deepSpaceSectors } });
          expect(store.getters.mapModes).to.deep.equal([{ type: MapModeType.deepSpaceSectors, player: 0 }]);
          expect(select.value).to.equal(MapModeType.deepSpaceSectors);
          // Counter clicks and dropdown selection remain synchronized through the shared store.
          store.commit("toggleMapMode", { type: MapModeType.sectors, player: 0 });
          await Vue.nextTick();
          expect(select.value).to.equal(MapModeType.sectors);
        }
      });
    }
  });
}
