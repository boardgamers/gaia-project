import assert from "assert";
import { isEqual } from "lodash";
import { boardActions } from "../actions";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import { BoardAction, Building, Command, Player as PlayerEnum } from "../enums";
import Event from "../events";
import Reward from "../reward";

export function moveSpecial(
  engine: Engine,
  command: AvailableCommand<Command.Special>,
  player: PlayerEnum,
  income: string
) {
  const { specialacts } = command.data;
  const actAvailable = specialacts.find((sa) => Reward.match(Reward.parse(sa.income), Reward.parse(income)));

  assert(actAvailable !== undefined, `Special action ${income} is not available`);

  // mark as activated special action for engine turn
  // triggers buildMine subphase from the activation
  engine.player(player).activateEvent(actAvailable.spec);
}

export function moveSpend(
  engine: Engine,
  command: AvailableCommand<Command.Spend>,
  player: PlayerEnum,
  costS: string,
  _for: "for",
  incomeS: string
) {
  const pl = engine.player(player);
  const cost = Reward.merge(Reward.parse(costS));
  const income = Reward.merge(Reward.parse(incomeS));

  assert(!cost.some((r) => r.count <= 0) && !income.some((r) => r.count <= 0), "Nice try!");
  assert(pl.data.canPay(cost) && cost, `Impossible to pay ${costS}`);
  assert(_for === "for", "Expect second part of command to be 'for'");

  // tslint:disable-next-line no-shadowed-variable
  const isPossible = (cost: Reward[], income: Reward[]) => {
    for (const action of command.data.acts) {
      const actionCost = Reward.parse(action.cost);
      if (Reward.includes(cost, actionCost)) {
        // Remove income & cost of action
        const newCost = Reward.merge(cost, Reward.negative(actionCost));
        let newIncome = Reward.merge(income, Reward.negative(Reward.parse(action.income)));

        // Convert unused income into cost
        newCost.push(...Reward.negative(newIncome.filter((rew) => rew.count < 0)));
        newIncome = newIncome.filter((rew) => rew.count > 0);

        if (newIncome.length === 0 && newCost.length === 0) {
          return true;
        }

        if (isPossible(newCost, newIncome)) {
          return true;
        }
      }
    }
    return false;
  };

  assert(isPossible(cost, income), `spend ${cost} for ${income} is not allowed`);

  pl.payCosts(cost, Command.Spend);
  pl.gainRewards(income, Command.Spend);
}

export function moveBurn(
  engine: Engine,
  command: AvailableCommand<Command.BurnPower>,
  player: PlayerEnum,
  cost: string
) {
  assert(command.data.includes(+cost), `Impossible to burn ${cost} power`);

  engine.players[player].data.burnPower(+cost);
}

export function moveAction(
  engine: Engine,
  command: AvailableCommand<Command.Action>,
  player: PlayerEnum,
  action: BoardAction
) {
  assert(
    command.data.poweracts.find((act) => act.name === action),
    `${action} is not in the available power actions`
  );

  const pl = engine.player(player);
  engine.boardActions[action] = player;

  pl.payCosts(Reward.parse(boardActions[action].cost), action);
  pl.loadEvents(Event.parse(boardActions[action].income, action));
}

export function movePiSwap(
  engine: Engine,
  command: AvailableCommand<Command.PISwap>,
  player: PlayerEnum,
  location: string
) {
  const { buildings } = command.data;
  const pl = engine.player(player);

  const PIHex = pl.data.occupied.find((hex) => hex.buildingOf(player) === Building.PlanetaryInstitute);
  const parsed = engine.map.parse(location);

  for (const elem of buildings) {
    if (isEqual(engine.map.parse(elem.coordinates), parsed)) {
      const hex = engine.map.getS(location);

      if (hex.buildingOf(player) === Building.Mine) {
        hex.data.building = Building.PlanetaryInstitute;
        PIHex.data.building = Building.Mine;
        pl.federationCache = null;
        return;
      }
    }
  }

  assert(false, `Impossible to execute PI swap command at ${location}`);
}
