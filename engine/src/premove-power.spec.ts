import { expect } from "chai";
import type Engine from "./engine";
import { PowerArea } from "./enums";
import PlayerData, { Power } from "./player-data";
import { assertPremovePower, capturePremovePower, observePowerCommand, withoutPowerObservation } from "./premove-power";

function trace(data: PlayerData, actions: (() => void)[]) {
  const engine = {
    players: [{ data }],
    move: () =>
      actions.forEach((action, i) => {
        const finish = observePowerCommand(engine as unknown as Engine, `action ${i}`);
        try {
          action();
        } finally {
          finish();
        }
      }),
  };
  return capturePremovePower(engine as unknown as Engine, 0, "");
}

describe("premove power operations", () => {
  it("guards destructive token payments, not ordinary power spending", () => {
    const data = new PlayerData();
    data.power = new Power(3, 0, 0);
    const baseline = trace(data, [() => data.discardPower(2)]);
    data.power = new Power(0, 3, 0);
    const changed = trace(data, [() => data.discardPower(2)]);
    expect(() => assertPremovePower(changed, baseline)).to.throw("bowls II or III");
    expect(() => assertPremovePower(changed, changed)).not.to.throw();
    data.power = new Power(0, 0, 3);
    expect(() => assertPremovePower(trace(data, [() => data.spendPower(2)]))).not.to.throw();
    data.power = new Power(0, 3, 0);
    expect(() => assertPremovePower(trace(data, [() => data.movePowerToGaia(2)]))).to.throw("bowls II or III");
  });

  it("includes a removed brainstone's original bowl", () => {
    const data = new PlayerData();
    data.power = new Power(0, 0, 0);
    data.brainstone = PowerArea.Area2;
    const actual = trace(data, [() => data.discardPower(1)]);
    expect(actual[0].events[0].area2).to.equal(1);
    expect(() => assertPremovePower(actual)).to.throw("bowls II or III");
  });

  it("does not let waste saved in one command or reward mask new waste elsewhere", () => {
    const data = new PlayerData();
    data.power = new Power(0, 0, 0);
    const baseline = trace(data, [
      () => data.chargePower(3),
      () => {
        data.power.area1 = 3;
        data.chargePower(3);
      },
    ]);
    data.power = new Power(3, 0, 0);
    const changed = trace(data, [
      () => data.chargePower(3),
      () => {
        data.power = new Power();
        data.chargePower(3);
      },
    ]);
    expect(() => assertPremovePower(changed, baseline)).to.throw("waste more");
    const sameCommandBaseline = [{ command: "reward", events: baseline.flatMap((c) => c.events) }];
    const sameCommandChanged = [{ command: "reward", events: changed.flatMap((c) => c.events) }];
    expect(() => assertPremovePower(sameCommandChanged, sameCommandBaseline)).to.throw("waste more");
  });

  it("does not reuse an allowance when a command's operation sequence changes", () => {
    const data = new PlayerData();
    data.power = new Power();
    const baseline = trace(data, [
      () => {
        data.chargePower(3);
        data.chargePower(1);
      },
    ]);
    const actual = trace(data, [() => data.chargePower(3)]);
    expect(() => assertPremovePower(actual, baseline)).to.throw("waste more");
  });

  it("ignores non-applied charge queries and synthetic analysis top-ups", () => {
    const data = new PlayerData();
    expect(
      trace(data, [
        () => {
          data.chargePower(100, false);
          withoutPowerObservation(data, () => data.chargePower(100));
        },
      ])[0].events
    ).to.deep.equal([]);
  });
});
