import Engine, { Command } from "@gaia-project/engine";
import { analysisView, move as hostedMove } from "@gaia-project/engine/wrapper";
import { fireEvent } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { makeStore } from "../store";
import Game from "./Game.vue";

Vue.use(BootstrapVue);

function position() {
  const engine = new Engine(
    Engine.parseMoves(`
    init 4 concurrent-charge-test
    p1 faction terrans
    p2 faction nevlas
    p3 faction firaks
    p4 faction hadsch-hallas
    p1 build m 8A2
    p2 build m 8B1
    p3 build m 8B3
    p4 build m 7B5
    p4 build m 1A2
    p3 build m 7A4
    p2 build m 5A2
    p1 build m 4A4
    p4 booster booster2
    p3 booster booster4
    p2 booster booster5
    p1 booster booster6
    hadsch-hallas income 2t
    terrans build ts 8A2.
    nevlas decline 1pw @1
  `),
    { concurrentCharges: true }
  );
  engine.players.forEach((p) => {
    p.settings.autoChargePower = "ask";
  });
  engine.generateAvailableCommandsIfNeeded();
  return engine;
}

function mountGame(seat: number, engine: Engine) {
  const store = makeStore();
  store.commit("hosted", true);
  store.commit("player", { index: seat });
  const vm = new (Vue.extend(Game as any))({ store }) as any;
  vm.handleData(engine);
  vm.$mount();
  document.body.appendChild(vm.$el);
  return vm;
}

function button(vm: any, label: string) {
  return Array.from(vm.$el.querySelectorAll<HTMLButtonElement>("#move button")).find(
    (el: HTMLButtonElement) => el.textContent.trim() === label
  ) as HTMLButtonElement;
}

describe("concurrent charge controls", () => {
  afterEach(() => {
    for (const element of Array.from(document.body.children)) {
      (element as any).__vue__?.$destroy();
      element.remove();
    }
  });

  it("uses the host-selected analysis seat for concurrent charges rather than the next main turn", async () => {
    const saved = position();
    const vm = mountGame(0, analysisView(saved, { player: 0 }).state);
    expect(vm.canPlay).to.equal(false);
    vm.$store.commit("preferences", { analysis: true });
    vm.$store.commit("player", { index: 3 });
    vm.handleData(analysisView(saved, { player: 3 }).state);
    const actions = [];
    vm.$store.subscribeAction(({ type, payload }) => {
      if (type === "move") actions.push(payload);
    });
    await Vue.nextTick();
    expect(vm.engine.playerToMove).to.equal(1);
    expect(vm.player).to.equal(3);
    expect(vm.canPlay).to.equal(true);
    expect(vm.analysisMode).to.equal(false);
    expect(vm.$el.querySelector("#move").textContent).to.contain("Charge power");
    expect(button(vm, "Research")).to.equal(undefined);
    expect(actions).to.deep.equal([]);
    vm.$store.commit("player", { index: 1 });
    vm.handleData(analysisView(saved, { player: 1 }).state);
    await Vue.nextTick();
    expect(vm.player).to.equal(1);
    expect(button(vm, "Research")).not.to.equal(undefined);
    expect(actions).to.deep.equal([]);
    vm.$el.remove();
    vm.$destroy();
  });

  it("commits the turn player to waiting until the other charge resolves", async () => {
    let saved = position();
    const vm = mountGame(1, Engine.fromData(JSON.parse(JSON.stringify(saved))));
    const pending = mountGame(3, Engine.fromData(JSON.parse(JSON.stringify(saved))));
    const actions = [];
    vm.$store.subscribeAction(({ type, payload }) => {
      if (type !== "move") return;
      actions.push(payload);
      saved = hostedMove(JSON.parse(JSON.stringify(saved)), payload, 1);
      vm.handleData(Engine.fromData(JSON.parse(JSON.stringify(saved))));
    });
    await Vue.nextTick();
    expect(vm.canPlay).to.equal(true);
    expect(pending.canPlay).to.equal(true);
    expect(button(vm, "Research")).not.to.equal(undefined);
    expect(button(pending, "Research")).to.equal(undefined);
    expect(pending.$el.querySelector("#move").textContent).to.contain("Charge power");
    await fireEvent.click(button(vm, "Wait"));
    await Vue.nextTick();
    expect(actions).to.deep.equal(["nevlas waitForCharges"]);
    expect(vm.canPlay).to.equal(false);
    expect(button(vm, "Research")).to.equal(undefined);
    expect(button(vm, "Resume")).to.equal(undefined);
    expect(button(vm, "Wait")).to.equal(undefined);
    expect(vm.$el.querySelector(".charge-wait").textContent).to.contain("Waiting for charges");
    // Keep the status in its own text node so the DOM localizer can match its catalog key.
    expect(vm.$el.querySelector(".charge-wait > span > span").textContent).to.equal("Waiting for charges");
    saved = hostedMove(saved, "hadsch-hallas decline 1pw @2", 3);
    vm.handleData(Engine.fromData(JSON.parse(JSON.stringify(saved))));
    await Vue.nextTick();
    expect(actions).to.deep.equal(["nevlas waitForCharges"]);
    expect(vm.canPlay).to.equal(true);
    expect(button(vm, "Research")).not.to.equal(undefined);
  });

  for (const answer of ["charge", "decline"]) {
    it(`restores a legacy wait cache's charge controls and resolves ${answer} locally`, async () => {
      const saved = hostedMove(JSON.parse(JSON.stringify(position())), "nevlas waitForCharges", 1);
      // Old saved games include Resume alongside another seat's pending decision.
      // fromData invalidates that cache; the viewer must rebuild it before rendering.
      const incoming = JSON.parse(JSON.stringify(saved));
      incoming.version = "4.17.3";
      incoming.availableCommands.push({ name: Command.ResumeCharges, player: 1 });
      const before = JSON.stringify(incoming);
      const vm = mountGame(3, position());
      await vm.$store.dispatch("externalData", incoming);
      await Vue.nextTick();
      expect(vm.canPlay).to.equal(true);
      expect(vm.engine.availableCommands).not.to.equal(null);
      expect(vm.$el.querySelector("#move").textContent).to.contain("Charge power");
      expect(button(vm, "Decline")).not.to.equal(undefined);
      expect(button(vm, "Resume")).to.equal(undefined);
      expect(button(vm, "Research")).to.equal(undefined);
      expect(JSON.stringify(incoming)).to.equal(before);

      vm.$store.commit("player", { index: 1 });
      await Vue.nextTick();
      expect(vm.canPlay).to.equal(false);
      expect(button(vm, "Resume")).to.equal(undefined);
      expect(button(vm, "Research")).to.equal(undefined);
      const resolved = hostedMove(incoming, `hadsch-hallas ${answer} 1pw @2`, 3);
      await vm.$store.dispatch("externalData", JSON.parse(JSON.stringify(resolved)));
      await Vue.nextTick();
      expect(vm.engine.pendingCharges).to.have.length(0);
      expect(vm.engine.chargeWaits).to.deep.equal({});
      expect(vm.canPlay).to.equal(true);
      expect(button(vm, "Research")).not.to.equal(undefined);
    });
  }

  it("keeps an unfinished turn when an opponent answers, without modifying the incoming saved position", async () => {
    const saved = position();
    const partial = Engine.fromData(JSON.parse(JSON.stringify(saved)));
    partial.move("nevlas up nav");
    partial.generateAvailableCommandsIfNeeded();
    const vm = mountGame(1, partial);
    const incoming = JSON.parse(
      JSON.stringify(hostedMove(JSON.parse(JSON.stringify(saved)), "hadsch-hallas decline 1pw @2", 3))
    );
    const before = JSON.stringify(incoming);
    await vm.$store.dispatch("externalData", incoming);
    await Vue.nextTick();
    expect(vm.currentMove).to.equal("nevlas up nav");
    expect(vm.engine.pendingCharges).to.have.length(0);
    expect(vm.engine.findAvailableCommand(1, Command.EndTurn)).not.to.equal(undefined);
    expect(JSON.stringify(incoming)).to.equal(before);
    expect(button(vm, "End Turn")).not.to.equal(undefined);
  });
});
