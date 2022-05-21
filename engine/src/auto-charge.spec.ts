import { expect } from "chai";
import {
  askOrDeclineBasedOnCost,
  askOrDeclineForPassedPlayer,
  autoChargeItars,
  ChargeDecision,
  ChargeRequest,
  decideChargeRequest,
} from "./auto-charge";
import { getTaklonsExtraLeechOffers } from "./available/leech";
import { Offer } from "./available/types";
import { Resource } from "./enums";
import { IncomeSelection } from "./income";
import Player, { AutoCharge } from "./player";
import Reward from "./reward";

describe("AutoCharge", () => {
  it("should auto-charge when no power tokens are going to be put in area3", () => {
    expect(autoChargeItars(2, 2)).to.be.true;
    expect(autoChargeItars(1, 2)).to.be.false;
    expect(autoChargeItars(0, 1)).to.be.false;
  });

  describe("askOrDeclineBasedOnCost", () => {
    const tests: {
      name: string;
      give: { power: number; autoCharge: AutoCharge };
      want: ChargeDecision;
    }[] = [
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
        const number = test.give.power;
        const decision = askOrDeclineBasedOnCost(number, number, test.give.autoCharge);
        expect(decision).to.equal(test.want);
      });
    }
  });

  describe("askOrDeclineForPassedPlayer", () => {
    describe("when passed & no remaining charges after income", () => {
      const baseRequest: ChargeRequest = {
        playerHasPassed: true,
        autoCharge: 3,
        incomeSelection: {
          remainingChargesAfterIncome: 0,
        } as IncomeSelection,
        minCharge: 1,
        isLastRound: false,
      } as ChargeRequest;

      it("should not decline if taklons can gain a power token", () => {
        expect(
          askOrDeclineForPassedPlayer({
            ...baseRequest,
            offers: [
              { cost: "1vp", offer: "2pw,1t" },
              { cost: "1vp", offer: "1t,2pw" },
            ],
          })
        ).to.equal(ChargeDecision.NoAutomaticYes);
      });

      it("should decline otherwise", () => {
        expect(askOrDeclineForPassedPlayer({ ...baseRequest, offers: [{ cost: "1vp", offer: "2pw" }] })).to.equal(
          ChargeDecision.No
        );
      });
    });
  });

  describe("decideChargeRequest", () => {
    const tests: {
      name: string;
      give: {
        power: number;
        autoCharge: AutoCharge;
        autoChargeTargetSpendablePower?: number;
        powerInArea3?: number;
        lastRound?: boolean;
        playerHasPassed?: boolean;
      };
      want: ChargeDecision;
    }[] = [
      {
        name: "passed player who always wants to decide",
        give: { power: 1, autoCharge: "ask", playerHasPassed: true, lastRound: true },
        want: ChargeDecision.Yes,
      },
      {
        name: "always ask",
        give: { power: 1, autoCharge: "ask" },
        want: ChargeDecision.Ask,
      },
      {
        name: "decline if not free - is free",
        give: { power: 1, autoCharge: "decline-cost" },
        want: ChargeDecision.Yes,
      },
      {
        name: "decline if not free - not free",
        give: { power: 2, autoCharge: "decline-cost" },
        want: ChargeDecision.No,
      },
      {
        name: "auto charge 1 - charge",
        give: { power: 1, autoCharge: 1 },
        want: ChargeDecision.Yes,
      },
      {
        name: "auto charge 1 - ask",
        give: { power: 2, autoCharge: 1 },
        want: ChargeDecision.Ask,
      },
      {
        name: "target power is already satisfied",
        give: { power: 2, autoCharge: 1, powerInArea3: 3, autoChargeTargetSpendablePower: 3 },
        want: ChargeDecision.Ask,
      },
      {
        name: "target power overrides decision",
        give: { power: 2, autoCharge: 1, powerInArea3: 2, autoChargeTargetSpendablePower: 3 },
        want: ChargeDecision.Yes,
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const player = new Player();
        player.settings.autoChargePower = test.give.autoCharge;
        player.settings.autoChargeTargetSpendablePower = test.give.autoChargeTargetSpendablePower;
        player.data.power.area3 = test.give.powerInArea3;

        const offer = new Offer(
          `${test.give.power}${Resource.ChargePower}`,
          new Reward(test.give.power - 1, Resource.VictoryPoint).toString()
        );

        const request = new ChargeRequest(player, [offer], test.give.lastRound, test.give.playerHasPassed, null);
        const decision = decideChargeRequest(request);
        expect(decision).to.equal(test.want);
      });
    }
  });

  describe("decideChargeRequest for taklons special leech", () => {
    const tests: {
      name: string;
      give: {
        earlyLeechValue: number;
        lateLeechValue: number;
        autoCharge: AutoCharge;
        autoBrainstone?: boolean;
        lastRound?: boolean;
        playerHasPassed?: boolean;
      };
      want: { decision: ChargeDecision; offer: string };
    }[] = [
      {
        name: "manual brainstone",
        give: { earlyLeechValue: 2, lateLeechValue: 3, autoBrainstone: false, autoCharge: 5 },
        want: { decision: ChargeDecision.Ask, offer: null },
      },
      {
        name: "auto brainstone - not limited by auto charge - take max leech",
        give: { earlyLeechValue: 2, lateLeechValue: 3, autoBrainstone: true, autoCharge: 5 },
        want: { decision: ChargeDecision.Yes, offer: "1t,3pw" },
      },
      {
        name: "auto brainstone - not limited by auto charge - both charge same amount - take charge first",
        give: { earlyLeechValue: 2, lateLeechValue: 2, autoBrainstone: true, autoCharge: 5 },
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
        name: "auto brainstone - decline-cost - one option is free - take it",
        give: {
          earlyLeechValue: 1,
          lateLeechValue: 3,
          autoBrainstone: true,
          autoCharge: "decline-cost",
        },
        want: { decision: ChargeDecision.Yes, offer: "1pw,1t" },
      },
      {
        name: "auto brainstone - decline-cost - no option is free - decline",
        give: {
          earlyLeechValue: 2,
          lateLeechValue: 3,
          autoBrainstone: true,
          autoCharge: "decline-cost",
        },
        want: { decision: ChargeDecision.No, offer: null },
      },
      {
        name: "last round passed - ask - one option is free - take it",
        give: {
          earlyLeechValue: 1,
          lateLeechValue: 3,
          autoCharge: "ask",
          playerHasPassed: true,
          lastRound: true,
        },
        want: { decision: ChargeDecision.Yes, offer: "1pw,1t" },
      },
      {
        name: "last round passed - ask - no option is free - decline",
        give: {
          earlyLeechValue: 2,
          lateLeechValue: 3,
          autoCharge: "ask",
          playerHasPassed: true,
          lastRound: true,
        },
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

        const request = new ChargeRequest(player, offers, give.lastRound, give.playerHasPassed, null);
        const decision = decideChargeRequest(request);
        expect(decision).to.equal(test.want.decision);
        if (test.want.decision === ChargeDecision.Yes) {
          expect(request.maxAllowedOffer.offer).to.deep.equal(test.want.offer);
        }
      });
    }
  });
});
