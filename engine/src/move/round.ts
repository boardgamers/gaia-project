import assert from "assert";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import { Booster, Command, Player as PlayerEnum } from "../enums";
import Reward from "../reward";

export function moveChooseRoundBooster(
  engine: Engine,
  command: AvailableCommand<Command.ChooseRoundBooster>,
  player: PlayerEnum,
  booster: Booster
) {
  const { boosters } = command.data;

  assert(boosters.includes(booster), `${booster} is not in the available boosters`);

  engine.tiles.boosters[booster] = false;
  engine.players[player].getRoundBooster(booster);
}

export function movePass(
  engine: Engine,
  command: AvailableCommand<Command.Pass>,
  player: PlayerEnum,
  booster: Booster
) {
  engine.tiles.boosters[engine.players[player].data.tiles.booster] = true;
  engine.players[player].pass();

  if (!engine.isLastRound) {
    moveChooseRoundBooster(engine, (command as any) as AvailableCommand<Command.ChooseRoundBooster>, player, booster);
  }

  engine.passedPlayers.push(player);
  engine.turnOrder.splice(engine.turnOrder.indexOf(player), 1);
}

export function moveEndTurn(engine: Engine, command: AvailableCommand<Command.EndTurn>, player: PlayerEnum) {
  // engine.player(player).endTurn();
}

export function moveChooseIncome(
  engine: Engine,
  command: AvailableCommand<Command.ChooseIncome>,
  player: PlayerEnum,
  income: string
) {
  const incomes = command.data;
  const incomeRewards = income.split(",");
  const pl = engine.player(player);

  for (const incR of incomeRewards) {
    const eventIdx = incomes.findIndex((rw) => Reward.match(Reward.parse(incR), Reward.parse(rw)));
    assert(eventIdx > -1, `${incR} is not in the available income: ${incomes.join(",")}`);
    incomes.splice(eventIdx, 1);
  }
  pl.receiveIncomeEvent(Reward.parse(income));
}
