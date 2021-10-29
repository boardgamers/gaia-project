import { ButtonData, ButtonWarning } from "../../data";
import { moveWarnings } from "../../data/warnings";
import Engine, {
  AvailableBuilding,
  AvailableCommand,
  AvailableHex,
  Building,
  Command,
  Faction,
  GaiaHex,
  HighlightHex,
  isShip,
  Round,
} from "@gaia-project/engine";
import { buildingName, buildingShortcut, shipLetter } from "../../data/building";
import { sortBy, sortedUniq } from "lodash";
import { addOnClick, addOnShow, hexMap, prependShortcut, textButton, tooltipWithShortcut, withShortcut } from "./utils";
import assert from "assert";
import { CommandController } from "./types";
import { buttonWarnings } from "./warnings";

function commonHexWarning(buildings): ButtonWarning | null {
  if (buildings.every((b) => b.warnings?.length > 0)) {
    const common = buildings[0].warnings
      .filter((w) => buildings.every((b) => b.warnings.includes(w)))
      .map((w) => moveWarnings[w].text);
    return {
      title: "Every possible building location has a warning",
      body: common.length > 0 ? common : ["Different warnings."],
    } as ButtonWarning;
  }
  return null;
}

function hexSelectionButton(data: ButtonData, newLocationButton = (hex: GaiaHex) => textButton({})): ButtonData {
  const button = textButton(data);

  assert(button.hexes, "hexes missing");
  assert(!button.buttons, "buttons already exists");

  let i = 1;

  const hexes = button.hexes.hexes;
  button.buttons = Array.from(hexes.keys()).map((hex) => {
    const b = newLocationButton(hex);
    b.command = hex.toString();
    const shortcut = String(i);
    b.label = prependShortcut(shortcut, hex.toString());
    b.shortcuts = [shortcut];
    i++;

    b.warning = buttonWarnings(hexes.get(hex).warnings?.map(w => moveWarnings[w].text));
    b.tooltip = tooltipWithShortcut(null, b.warning);

    addOnShow(b, (c) => {
      c.subscribeHexClick((h) => {
        if (h == hex) {
          c.handleClick();
        }
      }, false);
    });
    addOnClick(b, (c) => {
      c.executeCommand();
      if (button.needConfirm) {
        c.highlightHexes({ hexes: new Map<GaiaHex, HighlightHex>([[hex, {}]]) });
      }
    });
    return b;
  });
  return button;
}

function buildingMenu(building: Building): string | null {
  if (isShip(building)) {
    return "<u>B</u>uild Ship";
  }

  if (building == Building.Academy1 || building == Building.Academy2) {
    return "Upgrade to <u>A</u>cademy";
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
      label = withShortcut(`Upgrade to ${name}`, buildingShortcut(bld, faction), ["Upgrade to"]);
    }
  } else if (bld.downgrade) {
    label = `Downgrade to ${name}`;
  } else if (
    bld.cost === "~" ||
    building === Building.SpaceStation ||
    building === Building.GaiaFormer ||
    isShip(building)
  ) {
    label = `Place a ${name}`;
  }
  return label;
}

function buildingButton(label: string, shortcut: string, command: string, engine: Engine,
                        buildings: AvailableBuilding[], commonWarning: ButtonWarning, confirm: ButtonData[]) {
  return hexSelectionButton(
    {
      label,
      shortcuts: [shortcut],
      command,
      hexes: hexMap(engine, buildings, false),
      warning: commonWarning,
      needConfirm: confirm?.length > 0,
    },
    (hex) => textButton({ buttons: confirm }),
  );
}

export function buildButtons(engine: Engine, command: AvailableCommand<Command.Build>): ButtonData[] {
  const byTypeLabel = new Map<string, AvailableBuilding[]>();
  const faction = engine.player(command.player).faction;
  for (const bld of command.data.buildings) {
    const label = buildingLabel(bld, faction);

    const old = byTypeLabel.get(label) ?? [];
    old.push(bld);
    byTypeLabel.set(label, old);
  }

  const sort = Object.values(Building);
  const sorted = sortBy(
    Array.from(byTypeLabel.entries()),
    ([, b]) => sort.indexOf(b[0].building) * 2 + (b[0].upgrade || b[0].downgrade ? 1 : 0)
  );

  const ret: ButtonData[] = [];
  const menus = new Map<string, ButtonData[]>();

  for (const s of sorted) {
    const label = s[0] as string;
    const buildings = s[1] as AvailableBuilding[];
    const commonWarning = commonHexWarning(buildings);

    const b = buildings[0];
    const building = b.building;
    const shortcut = buildingShortcut(b, faction);

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

      buttons.push(buildingButton(
        buildingName(building, faction), shortcut, building, engine, buildings, commonWarning, []
      ));

      menus.set(menu, buttons);
    } else {
      const confirm: ButtonData[] =
        engine.round === Round.None
          ? [
              {
                command: "",
                label: `Confirm ${buildingName(building, faction)}`,
              } as ButtonData,
            ]
          : undefined;

      ret.push(buildingButton(label, shortcut, `${Command.Build} ${building}`, engine, buildings, commonWarning, confirm));
    }
  }
  return ret;
}

export function moveShipButton(
  engine: Engine,
  command: AvailableCommand<Command.MoveShip>,
  commandController: CommandController
): ButtonData {
  const faction = engine.player(command.player).faction;

  return textButton({
    label: "Move Ship",
    shortcuts: ["o"],
    command: Command.MoveShip,
    buttons: sortedUniq(command.data.map((e) => e.ship)).map((ship) =>
      hexSelectionButton(
        {
          label: buildingName(ship, faction),
          command: ship,
          shortcuts: [shipLetter(ship).toLowerCase()],
          hexes: hexMap(
            engine,
            command.data.filter((e) => e.ship === ship).map((l) => ({ coordinates: l.source } as AvailableHex)),
            false
          ),
        },
        (hex) =>
          hexSelectionButton({
            hexes: hexMap(
              engine,
              command.data.find((d) => d.ship == ship && d.source == hex.toString()).targets,
              false
            ),
          })
      )
    ),
  });
}

