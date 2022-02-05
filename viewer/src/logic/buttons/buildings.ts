import Engine, {
  AvailableBuilding,
  AvailableCommand,
  Building,
  Command,
  Expansion,
  Faction,
  isShip,
  Planet,
  Player,
  Round,
} from "@gaia-project/engine";
import { qicForDistance } from "@gaia-project/engine/src/cost";
import { isAcademy } from "@gaia-project/engine/src/enums";
import { sortBy } from "lodash";
import { ButtonData } from "../../data";
import { availableBuildingShortcut, buildingName } from "../../data/building";
import { hexSelectionButton } from "./hex";
import { withShortcut } from "./shortcuts";
import { CommandController } from "./types";
import { confirmationButton, hexMap, isFree, textButton } from "./utils";

function buildingMenu(building: Building): string | null {
  if (isShip(building)) {
    return "<u>B</u>uild Ship";
  }

  if (isAcademy(building)) {
    return "Upgrade to A<u>c</u>ademy";
  }

  return null;
}

function buildingLabel(bld: AvailableBuilding, faction: Faction) {
  const building = bld.building;
  const name = buildingName(building, faction);
  let label = `Build a ${name}`;

  if (bld.upgrade) {
    if (building == Building.Mine) {
      label = "Upgrade Gaia Former to Mine";
    } else {
      label = withShortcut(`Upgrade to ${name}`, availableBuildingShortcut(bld, faction), ["Upgrade to"]);
    }
  } else if (bld.downgrade) {
    label = `Downgrade to ${name}`;
  } else if (
    isFree(bld) ||
    building === Building.SpaceStation ||
    building === Building.GaiaFormer ||
    isShip(building)
  ) {
    label = `Place a ${name}`;
  }
  return label;
}

function buildingButton(
  controller: CommandController,
  building: Building,
  label: string,
  shortcut: string,
  command: string,
  engine: Engine,
  buildings: AvailableBuilding[],
  confirm: ButtonData[],
  upgrade: boolean,
  player: Player
) {
  const hexes = hexMap(engine, buildings, false);
  if (!upgrade && engine.round != Round.None && building != Building.SpaceStation && !isShip(building)) {
    const map = engine.map;
    for (const hex of map.grid.values()) {
      if (hex.data.planet == Planet.Empty) {
        const qicNeeded = qicForDistance(map, hex, player, false, controller.temporaryRange);
        if (qicNeeded && qicNeeded.amount <= player.data.qics) {
          hexes.hexes.set(hex, { preventClick: true, class: qicNeeded.amount > 0 ? "qic range" : "range" });
        }
      }
    }
  }
  return hexSelectionButton(
    controller,
    textButton({
      label,
      shortcuts: [shortcut],
      command,
      hexes,
      smartAutoClick: !isShip(building),
    }),
    () => textButton({ buttons: confirm }),
    building
  );
}

export function buildButtons(
  controller: CommandController,
  engine: Engine,
  command: AvailableCommand<Command.Build>,
  player: Player
): ButtonData[] {
  const byTypeLabel = new Map<string, AvailableBuilding[]>();
  const faction = engine.player(command.player).faction;
  for (const bld of command.data.buildings) {
    const label = buildingLabel(bld, faction);

    const old = byTypeLabel.get(label) ?? [];
    old.push(bld);
    byTypeLabel.set(label, old);
  }

  const sort = Building.values(Expansion.All);
  const sorted = sortBy(
    Array.from(byTypeLabel.entries()),
    ([, b]) => sort.indexOf(b[0].building) * 2 + (b[0].upgrade || b[0].downgrade ? 1 : 0)
  );

  const ret: ButtonData[] = [];
  const menus = new Map<string, ButtonData[]>();

  for (const s of sorted) {
    const label = s[0] as string;
    const buildings = s[1] as AvailableBuilding[];

    const b = buildings[0];
    const building = b.building;
    const shortcut = availableBuildingShortcut(b, faction);

    const menu = buildingMenu(building);
    if (menu) {
      const buttons = menus.get(menu) ?? [];

      if (buttons.length == 0) {
        ret.push(
          textButton({
            label: menu,
            command: Command.Build,
            buttons,
          })
        );
      }

      buttons.push(
        buildingButton(
          controller,
          building,
          buildingName(building, faction),
          shortcut,
          building,
          engine,
          buildings,
          [],
          b.upgrade,
          player
        )
      );

      menus.set(menu, buttons);
    } else {
      ret.push(
        buildingButton(
          controller,
          building,
          label,
          shortcut,
          `${Command.Build} ${building}`,
          engine,
          buildings,
          engine.round === Round.None ? confirmationButton(`Confirm ${buildingName(building, faction)}`) : null,
          b.upgrade,
          player
        )
      );
    }
  }
  return ret;
}
