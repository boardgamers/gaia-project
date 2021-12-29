import assert from "assert";
import { AvailableBuilding, AvailableCommand, ShipAction } from "../available/types";
import Engine from "../engine";
import { Building, Command, Player as PlayerEnum, Resource } from "../enums";
import { GaiaHex } from "../gaia-hex";
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
        trade(pl, engine.map.getS(location.coordinates));
        break;
    }
  }
}

function trade(pl: Player, hex: GaiaHex) {
  hex.data.tradeTokens = hex.tradeTokens.concat(pl.player);
  gainTradeReward(pl, pl.player === hex.data.player, hex.data.building);
}

function gainTradeReward(p: Player, ownBuilding: boolean, building: Building) {
  const gain = (reward: Reward) => {
    p.gainRewards([reward], "trade");
  };

  switch (building) {
    case Building.Mine:
      if (ownBuilding) {
        gain(new Reward(1, Resource.Ore));
      } else {
        //build toll station
      }
      break;
    case Building.TradingStation:
      gain(new Reward(5, Resource.Credit));
      break;
    case Building.ResearchLab:
      gain(new Reward(2, Resource.Knowledge));
      break;
    case Building.PlanetaryInstitute:
      gain(new Reward(5, Resource.ChargePower));
      break;
    case Building.Academy1:
    case Building.Academy2:
      gain(new Reward(2, Resource.Knowledge));
      break;
    case Building.Colony:
      gain(new Reward(3, Resource.VictoryPoint));
      break;
  }
}
