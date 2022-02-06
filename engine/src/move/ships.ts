import assert from "assert";
import { AvailableBuilding, AvailableCommand, ShipAction, TradingLocation } from "../available/types";
import Engine from "../engine";
import { Building, Command, Condition, Player as PlayerEnum } from "../enums";
import { tradeCostSource, tradeSource } from "../events";
import Player from "../player";
import Reward from "../reward";
import { placeBuilding } from "./buildings";

export function moveShip(
  engine: Engine,
  command: AvailableCommand<Command.MoveShip>,
  player: PlayerEnum,
  shipType: Building,
  source: string,
  dest: string,
  actionType?: ShipAction,
  actionLocation?: string
) {
  const pl = engine.player(player);

  const data = command.data;

  const shipCommand = data.find((s) => s.ship === shipType && s.source === source);
  assert(shipCommand, `There is no ship ${shipType} at ${source}`);

  const target = shipCommand.targets.find((t) => t.location.coordinates === dest);
  assert(target, `The ship ${shipType} doesn't have the range to move from ${source} to ${dest}`);

  const ship = pl.findUnmovedShip(shipType, source);
  assert(ship, `No ${shipType} at ${source} (or has already moved)`);

  ship.moved = true;
  ship.location = dest;

  const actions = target.actions;

  if (actionType) {
    const action = actions?.find((a) => a.type === actionType);

    assert(action, `action ${actionType} not possible for ship ${shipType} at ship location ${dest}`);
    assert(actionLocation, "no action location provided");

    const location = action.locations.find((l) => l.coordinates === actionLocation);
    assert(location, `action ${actionType} not possible for ship ${shipType} at action location ${actionLocation}`);

    switch (actionType) {
      case ShipAction.BuildColony:
        placeBuilding(engine, pl, location as AvailableBuilding);
        pl.removeShip(ship, false);
        break;
      case ShipAction.Trade:
        trade(engine, pl, location as TradingLocation);
        break;
    }
  }
}

function trade(engine: Engine, pl: Player, location: TradingLocation) {
  if (location.tradeCost) {
    pl.payCosts(Reward.parse(location.tradeCost), tradeCostSource);
  }
  if (location.rewards) {
    pl.gainRewards(Reward.parse(location.rewards), tradeSource);
  }

  const hex = engine.map.getS(location.coordinates);
  if (hex.data.building === Building.Mine && pl.player !== hex.data.player) {
    const cost = location.cost ? Reward.parse(location.cost) : [];
    pl.build(Building.CustomsPost, hex, cost, engine.map);
  } else {
    hex.data.tradeTokens = hex.tradeTokens.concat(pl.player);
  }
  pl.receiveTriggerIncome(Condition.Trade);
}
