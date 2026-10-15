import Engine, {
  AdvTechTile,
  AdvTechTilePos,
  Booster,
  Command,
  Event,
  Operator,
  TechTile,
  TechTilePos,
} from "@gaia-project/engine";
import { techTileEvents } from "@gaia-project/engine/src/tiles/techs";
import { fireEvent, render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import Vue from "vue";
import AlternatePlayerInfo from "../../../old-ui/src/components/PlayerInfo.vue";
import { makeStore } from "../store";
import PlayerInfo from "./PlayerInfo.vue";

Vue.use(BootstrapVue);

function fixture() {
  const engine = new Engine(["init 2 board-actions", "p1 faction gleens", "p2 faction terrans"], { lostFleet: true });
  const player = engine.players[0];
  engine.passedPlayers = [];
  player.loadEvents(Event.parse(["=> q"], Command.ChooseIncome));
  player.getRoundBooster(Booster.Booster4);
  player.gainTechTile({ tile: TechTile.Tech9, pos: TechTilePos.Free1 });
  for (const tile of [
    { tile: AdvTechTile.AdvTech3, pos: AdvTechTilePos.Navigation },
    { tile: AdvTechTile.AdvTech11, pos: AdvTechTilePos.Intelligence },
    { tile: AdvTechTile.AdvTech13, pos: AdvTechTilePos.Science },
  ]) {
    player.data.tiles.techs.push({ ...tile, enabled: true });
    player.loadEvents(techTileEvents(tile));
  }
  const store = makeStore();
  store.commit("player", { index: 0 });
  store.commit("receiveData", engine);
  return { engine, player, store };
}

for (const [name, component] of [
  ["regular", PlayerInfo],
  ["alternate", AlternatePlayerInfo],
] as const) {
  describe(`${name} player-board actions`, () => {
    it("includes owned techs and boosters, wraps the action row, and removes covered tile actions", async () => {
      const { engine, player, store } = fixture();
      const { container } = render(component, { props: { player }, store });
      const actions = () => Array.from(container.querySelectorAll(".player-board [data-player-action]"));
      expect(actions().map((el) => el.getAttribute("data-player-action"))).toEqual([
        "range+2",
        "q",
        "step",
        "4pw",
        "q,5c",
        "3o",
        "3k",
      ]);
      expect(actions()[6].getAttribute("x")).toBe("0");
      expect(Number(actions()[6].getAttribute("y"))).toBeCloseTo(20.7);
      expect(Number(container.querySelector(".player-board").getAttribute("viewBox").split(" ")[3])).toBeCloseTo(24.7);

      player.events[Operator.Activate].find((event) => event.source === Booster.Booster4).activated = true;
      await Vue.nextTick();
      expect(container.querySelector('[data-player-action="step"] .disabled')).not.toBeNull();
      player.coverTechTile(TechTilePos.Free1);
      await Vue.nextTick();
      expect(container.querySelector('[data-player-action="4pw"]')).toBeNull();
      expect(actions()).toHaveLength(6);
      expect(container.querySelector(".player-board").getAttribute("viewBox")).toContain("21.4");

      engine.passedPlayers.push(player.player);
      store.commit("receiveData", Engine.fromData(JSON.parse(JSON.stringify(engine))));
      await Vue.nextTick();
      expect(actions().every((el) => el.querySelector(".disabled"))).toBe(true);
    });

    it("uses the existing action command and does not activate a used or another player's action", async () => {
      const { player, store } = fixture();
      const { container } = render(component, { props: { player }, store });
      store.commit("highlightSpecialActions", ["4pw"]);
      await Vue.nextTick();
      const dispatch = vi.spyOn(store, "dispatch").mockResolvedValue(undefined);
      const action = () => container.querySelector('[data-player-action="4pw"] polygon');
      await fireEvent.click(action());
      expect(dispatch).toHaveBeenCalledWith("specialActionClick", expect.objectContaining({ command: "4pw" }));
      dispatch.mockClear();

      player.events[Operator.Activate].find((event) => event.action().rewards === "4pw").activated = true;
      await Vue.nextTick();
      await fireEvent.click(action());
      expect(dispatch).not.toHaveBeenCalled();

      player.events[Operator.Activate].find((event) => event.action().rewards === "4pw").activated = false;
      store.commit("player", { index: 1 });
      await Vue.nextTick();
      await fireEvent.click(action());
      expect(dispatch).not.toHaveBeenCalled();
      expect(container.querySelector('[data-player-action="4pw"] .highlighted')).toBeNull();
    });
  });
}
