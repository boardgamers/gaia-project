import { expect } from "chai";
import {
  askOrDeclineBasedOnCost,
  autoChargeItars,
  ChargeDecision,
  ChargeRequest,
  decideChargeRequest,
} from "./auto-charge";
import { getTaklonsExtraLeechOffers } from "./available-command";
import Player from "./player";

describe("AutoCharge", () => {
  it("should auto-charge when no power tokens are going to be put in area3", () => {
    expect(autoChargeItars(2, 2)).to.be.true;
    expect(autoChargeItars(1, 2)).to.be.false;
    expect(autoChargeItars(0, 1)).to.be.false;
  });

  describe("askOrDeclineBasedOnCost", () => {
    const tests: {
      name: string;
      give: { power: number; autoCharge: number };
      want: ChargeDecision;
    }[] = [
      {
        name: "accept free or decline - it's free",
        give: { power: 1, autoCharge: 0 },
        want: ChargeDecision.Undecided,
      },
      {
        name: "accept free or decline - it's not free",
        give: { power: 2, autoCharge: 0 },
        want: ChargeDecision.No,
      },
      {
        name: "accept free or ask - it's free",
        give: { power: 1, autoCharge: 1 },
        want: ChargeDecision.Undecided,
      },
      {
        name: "accept free or ask - it's not free",
        give: { power: 2, autoCharge: 1 },
        want: ChargeDecision.Ask,
      },
      {
        name: "auto charge 3 - 2 power",
        give: { power: 2, autoCharge: 3 },
        want: ChargeDecision.Undecided,
      },
      {
        name: "auto charge 3 - 3 power",
        give: { power: 3, autoCharge: 3 },
        want: ChargeDecision.Undecided,
      },
      {
        name: "auto charge 3 - 4 power",
        give: { power: 4, autoCharge: 3 },
        want: ChargeDecision.Ask,
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const decision = askOrDeclineBasedOnCost(test.give.power, test.give.power, test.give.autoCharge);
        expect(decision).to.equal(test.want);
      });
    }
  });

  describe("decideChargeRequest for taklons special leech", () => {
    const tests: {
      name: string;
      give: { earlyLeechValue: number; lateLeechValue: number; autoBrainstone: boolean; autoCharge: number };
      want: { decision: ChargeDecision; offer: string };
    }[] = [
      {
        name: "manual brainstone",
        give: { earlyLeechValue: 2, lateLeechValue: 3, autoBrainstone: false, autoCharge: 100 },
        want: { decision: ChargeDecision.Ask, offer: null },
      },
      {
        name: "auto brainstone - not limited by auto charge - take max leech",
        give: { earlyLeechValue: 2, lateLeechValue: 3, autoBrainstone: true, autoCharge: 100 },
        want: { decision: ChargeDecision.Yes, offer: "1t,3pw" },
      },
      {
        name: "auto brainstone - not limited by auto charge - both charge same amount - take charge first",
        give: { earlyLeechValue: 2, lateLeechValue: 2, autoBrainstone: true, autoCharge: 100 },
        want: { decision: ChargeDecision.Yes, offer: "2pw,1t" },
      },
      {
        name: "auto brainstone - one option leeches more than max - ask",
        give: { earlyLeechValue: 2, lateLeechValue: 3, autoBrainstone: true, autoCharge: 2 },
        want: { decision: ChargeDecision.Ask, offer: null },
      },
      {
        name: "auto brainstone - both options leeches more than max - ask",
        give: { earlyLeechValue: 4, lateLeechValue: 3, autoBrainstone: true, autoCharge: 2 },
        want: { decision: ChargeDecision.Ask, offer: null },
      },
      {
        name: "auto brainstone - auto charge 0 - one option is free - take it",
        give: { earlyLeechValue: 1, lateLeechValue: 3, autoBrainstone: true, autoCharge: 0 },
        want: { decision: ChargeDecision.Yes, offer: "1pw,1t" },
      },
      {
        name: "auto brainstone - auto charge 0 - one option is free - take it",
        give: { earlyLeechValue: 2, lateLeechValue: 3, autoBrainstone: true, autoCharge: 0 },
        want: { decision: ChargeDecision.No, offer: null },
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const give = test.give;
        const offers = getTaklonsExtraLeechOffers(give.earlyLeechValue, give.lateLeechValue);

        const player = new Player();
        player.settings.autoChargePower = test.give.autoCharge;
        player.settings.autoBrainstone = test.give.autoBrainstone;

        const request = new ChargeRequest(player, offers, false, false, null);
        const decision = decideChargeRequest(request);
        expect(decision).to.equal(test.want.decision);
        if (test.want.decision == ChargeDecision.Yes) {
          expect(request.maxAllowedOffer.offer).to.deep.equal(test.want.offer);
        }
      });
    }
  });
});
