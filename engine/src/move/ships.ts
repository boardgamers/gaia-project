import assert from "assert";
import { AvailableBuilding, AvailableCommand, ShipAction, TradingLocation } from "../available/types";
import Engine from "../engine";
import { Building, Command, Player as PlayerEnum } from "../enums";
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
  const hex = engine.map.getS(location.coordinates);
  const cost = location.cost ? Reward.parse(location.cost) : [];
  if (hex.data.building === Building.Mine && pl.player !== hex.data.player) {
    pl.build(Building.CustomsPost, hex, cost, engine.map)
  } else {
    hex.data.tradeTokens = hex.tradeTokens.concat(pl.player);
    pl.gainRewards(Reward.parse(location.rewards), "trade");
  }
}
