import Engine, {
  AvailableBuilding,
  AvailableCommand,
  AvailableHex,
  AvailableMoveShipData,
  Command,
  GaiaHex,
  Player,
  Reward,
  ShipAction,
} from "@gaia-project/engine";
import { TradingLocation } from "@gaia-project/engine/src/available/types";
import { sortedUniq } from "lodash";
import { ButtonData } from "../../data";
import { shipActionName, shipLetter } from "../../data/building";
import { richTextBuilding } from "../../graphics/rich-text";
import { hexSelectionButton } from "./hex";
import { CommandController } from "./types";
import { hexMap, symbolButton, textButton } from "./utils";
import { rewardWarnings } from "./warnings";

function moveTargetButton(
  controller: CommandController,
  data: AvailableMoveShipData,
  target: GaiaHex,
  engine: Engine,
  player: Player
): ButtonData {
  const actions = data.targets.find((t) => t.location.coordinates === target.toString()).actions;
  if (actions.length == 0) {
    return textButton({});
  }
  return textButton({
    buttons: actions.map((a) => {
      const hexes = hexMap(engine, a.locations, false);
      for (const location of a.locations) {
        const hex = hexes.hexes.get(engine.map.getS(location.coordinates));
        const l = location as TradingLocation;
        hex.tradeCost = l.tradeCost;
        hex.rewards = l.rewards;
        hex.building = (location as AvailableBuilding).building;

        //don't merge the rewards, because we want the trade cost to be applied first
        hex.warnings = rewardWarnings(
          player,
          Reward.negative(Reward.parse(l.tradeCost)).concat(Reward.parse(l.rewards))
        );
      }
      hexes.hexes.set(target, { building: data.ship, preventClick: true });
      hexes.hexes.set(engine.map.getS(data.source), { hideBuilding: data.ship, preventClick: true });

      return hexSelectionButton(
        controller,
        textButton({
          command: a.type === ShipAction.Nothing ? null : a.type,
          label: shipActionName(a.type),
          hexes,
        }),
        () => textButton({})
      );
    }),
  });
}

function moveSourceButton(
  controller: CommandController,
  engine: Engine,
  player: Player,
  data: AvailableMoveShipData
): ButtonData {
  return hexSelectionButton(
    controller,
    textButton({
      hexes: hexMap(
        engine,
        data.targets.map((t) => t.location),
        false
      ),
    }),
    (target) => moveTargetButton(controller, data, target, engine, player),
    data.ship,
    { building: data.ship, hex: engine.map.getS(data.source) }
  );
}

export function moveShipButton(
  controller: CommandController,
  engine: Engine,
  command: AvailableCommand<Command.MoveShip>
): ButtonData {
  let player = engine.player(command.player);
  const faction = player.faction;

  return textButton({
    label: "Move Ship",
    shortcuts: ["o"],
    command: Command.MoveShip,
    buttons: sortedUniq(command.data.map((e) => e.ship)).map((ship) =>
      hexSelectionButton(
        controller,
        symbolButton({
          richText: [richTextBuilding(ship, faction)],
          command: ship,
          shortcuts: [shipLetter(ship).toLowerCase()],
          hexes: hexMap(
            engine,
            command.data.filter((e) => e.ship === ship).map((l) => ({ coordinates: l.source } as AvailableHex)),
            false
          ),
        }),
        (hex) =>
          moveSourceButton(
            controller,
            engine,
            player,
            command.data.find((d) => d.ship == ship && d.source == hex.toString())
          )
      )
    ),
  });
}
