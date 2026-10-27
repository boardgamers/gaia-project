import Engine, { Command } from "@gaia-project/engine";
import { move as hostedMove } from "@gaia-project/engine/wrapper";
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

  it("lets the turn player wait and resume, while the charging seat sees only its own decisions", async () => {
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
    await fireEvent.click(button(vm, "Resume"));
    await Vue.nextTick();
    expect(actions[1]).to.equal("nevlas resumeCharges");
    expect(vm.canPlay).to.equal(true);
    expect(button(vm, "Research")).not.to.equal(undefined);
  });

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
