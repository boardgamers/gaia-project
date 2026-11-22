import Engine, { Building, Command, Faction, Phase, PowerArea, Reward, Spaceship } from "@gaia-project/engine";
import { Power } from "@gaia-project/engine/src/player-data";
import { mount } from "@vue/test-utils";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import OldGame from "../../../../old-ui/src/components/Game.vue";
import Commands from "../../components/Commands.vue";
import { WarningsPreference } from "../../data";
import { WarningKey } from "../../data/warnings";
import { makeStore } from "../../store";
import { exploreButton } from "./lost-fleet";

Vue.use(BootstrapVue);

function fixture(faction = Faction.Bescods) {
  const engine = new Engine(["init 2 exploration-warning"], { lostFleet: true });
  engine.players.forEach((player, i) => {
    player.faction = i === 0 ? faction : Faction.Terrans;
    player.loadFaction(null, engine.expansions);
    player.data.victoryPoints = 30;
    player.data.qics = 10;
  });
  engine.phase = Phase.RoundMove;
  engine.round = 1;
  engine.turnOrder = [0, 1];
  engine.currentPlayer = 0;
  const player = engine.players[0];
  const hex = [...engine.map.grid.values()].find((h) => h.hasPlanet() && !h.data.spaceship);
  hex.data.player = 0;
  hex.data.building = Building.Mine;
  player.data.occupied.push(hex);
  player.data.buildings[Building.Mine] = 1;
  player.data.power = new Power(0, 1, 2, 0);
  engine.players[1].data.explorationShips[Spaceship.TFMars] = 1;
  engine.generateAvailableCommands();
  const command = engine.findAvailableCommand(0, Command.Explore);
  return { engine, player, command };
}

function marsButton(command, player) {
  return exploreButton(command, player).buttons.find((b) => b.command === Spaceship.TFMars);
}

describe("exploration resource warning", () => {
  it("warns for a later slot's actual excess charge, without changing the engine", () => {
    const { engine, player, command } = fixture();
    const before = JSON.stringify(engine);
    const button = marsButton(command, player);
    expect(button.warning.body).to.deep.equal([
      { disableKey: WarningKey.resourceWaste, message: "1pw will be wasted." },
    ]);
    expect(button.tooltip).to.contain("1pw will be wasted.");
    expect(JSON.stringify(engine)).to.equal(before);
    // First-slot choices have no charge reward and must not inherit this warning.
    expect(exploreButton(command, player).buttons.find((b) => b.command !== Spaceship.TFMars).warning).to.equal(null);
  });

  it("uses the current partial-turn wallet after a conversion creates charging capacity", () => {
    const { player, command } = fixture();
    player.payCosts(Reward.parse("1pw"), Command.Spend);
    player.gainRewards(Reward.parse("1c"), Command.Spend);
    expect(marsButton(command, player).warning).to.equal(null);
  });

  it("pays token costs before measuring charge capacity", () => {
    const { player, command } = fixture(Faction.Nevlas);
    player.data.power = new Power(1, 0, 2, 0);
    expect(marsButton(command, player).warning.body[0].message).to.equal("2pw will be wasted.");
    expect(player.data.power.area1).to.equal(1);
  });

  it("removes the Taklons brainstone before measuring charge capacity", () => {
    const { player, command } = fixture(Faction.Taklons);
    player.data.power = new Power(0, 0, 2, 0);
    player.data.brainstone = PowerArea.Area1;
    expect(marsButton(command, player).warning.body[0].message).to.equal("2pw will be wasted.");
    expect(player.data.brainstone).to.equal(PowerArea.Area1);
  });

  it("accounts for power payments before rewards if an offered exploration has one", () => {
    const { player, command } = fixture();
    command.data.ships.find((s) => s.ship === Spaceship.TFMars).cost = "1pw,5vp";
    expect(marsButton(command, player).warning).to.equal(null);
  });

  it("both UI shells bind the same warning-aware command component", () => {
    expect((OldGame as any).options.components.Commands).to.equal(Commands);
  });

  for (const disabled of [false, true]) {
    it(`clicking the ship ${disabled ? "respects disabled resource warnings" : "opens the existing confirmation and cancellation does not emit a move"}`, async () => {
      const { engine } = fixture();
      const store = makeStore();
      store.commit("receiveData", engine);
      store.state.preferences.warnings = WarningsPreference.ModalDialog;
      store.state.preferences[`warning-${WarningKey.resourceWaste}`] = !disabled;
      const wrapper = mount(Commands, { propsData: { currentMove: "" }, store });
      const confirm = vi.spyOn((wrapper.vm as any).$bvModal, "msgBoxConfirm").mockResolvedValue(false);
      try {
        const buttons = () => wrapper.findAll("#move-buttons button.move-button");
        await buttons()
          .wrappers.find((b) => b.text().includes("Explore"))
          .trigger("click");
        await Vue.nextTick();
        await buttons()
          .wrappers.find((b) => b.text().includes("T F Mars"))
          .trigger("click");
        await Vue.nextTick();
        expect(confirm.mock.calls.length).to.equal(disabled ? 0 : 1);
        if (!disabled) {
          expect(confirm.mock.calls[0][0]).to.equal("1pw will be wasted.");
          expect(wrapper.emitted("command")).to.equal(undefined);
        }
      } finally {
        confirm.mockRestore();
        wrapper.destroy();
      }
    });
  }
});
