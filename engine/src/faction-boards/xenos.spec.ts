import { expect } from "chai";
import { possibleFreeActions } from "../available/actions";
import Engine from "../engine";
import { Expansion, Faction, Player as PlayerEnum } from "../enums";
import { moveSpend } from "../move/actions";

function createXenosEngine(expansions: Expansion) {
  const engine = new Engine([`init 2 xenos-lost-fleet-free-action`], { lostFleet: expansions === Expansion.LostFleet });
  const [p1, p2] = engine.players;
  p1.faction = Faction.Xenos;
  p1.loadFaction(null, expansions);
  p2.faction = Faction.Terrans;
  p2.loadFaction(null, expansions);
  return engine;
}

function offeredSpendAct(engine: Engine, player: PlayerEnum, cost: string, income: string) {
  const pl = engine.player(player);
  const actions = possibleFreeActions(pl);
  const spend = actions.find((a) => a.name === "spend") as any;
  return { spend, act: spend?.data.acts.find((a: any) => a.cost === cost && a.income === income) };
}

describe("Xenos", () => {
  describe("Lost Fleet free action (§I4: 1 ore -> 1 power token in Area III)", () => {
    it("should not be offered without the Lost Fleet expansion", () => {
      const engine = createXenosEngine(Expansion.None);
      const pl = engine.player(PlayerEnum.Player1);
      pl.data.ores = 5;

      const { act } = offeredSpendAct(engine, PlayerEnum.Player1, "1o", "1ta3");

      expect(act).to.equal(undefined);
    });

    it("should be offered and pay 1 ore for 1 power token gained directly into Area III under Lost Fleet", () => {
      const engine = createXenosEngine(Expansion.LostFleet);
      const pl = engine.player(PlayerEnum.Player1);
      pl.data.ores = 5;
      pl.data.power.area3 = 0;

      const { spend, act } = offeredSpendAct(engine, PlayerEnum.Player1, "1o", "1ta3");
      expect(act, "expected the ore -> power token (Area III) free action to be offered").to.not.equal(undefined);

      moveSpend(engine, spend, PlayerEnum.Player1, "1o", "for", "1ta3");

      expect(pl.data.ores).to.equal(4);
      expect(pl.data.power.area3).to.equal(1);
    });

    it("should be repeatable, matching a free action's unlimited-use rules", () => {
      const engine = createXenosEngine(Expansion.LostFleet);
      const pl = engine.player(PlayerEnum.Player1);
      pl.data.ores = 5;
      pl.data.power.area3 = 0;

      for (let i = 0; i < 3; i++) {
        const { spend } = offeredSpendAct(engine, PlayerEnum.Player1, "1o", "1ta3");
        moveSpend(engine, spend, PlayerEnum.Player1, "1o", "for", "1ta3");
      }

      expect(pl.data.ores).to.equal(2);
      expect(pl.data.power.area3).to.equal(3);
    });

    it("is not offered to other factions", () => {
      const engine = createXenosEngine(Expansion.LostFleet);
      const pl = engine.player(PlayerEnum.Player2);
      pl.data.ores = 5;

      const { act } = offeredSpendAct(engine, PlayerEnum.Player2, "1o", "1ta3");

      expect(act).to.equal(undefined);
    });
  });
});
