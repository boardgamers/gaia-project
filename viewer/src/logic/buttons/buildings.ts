import Engine, {
  AvailableBuilding,
  AvailableCommand,
  AvailableHex,
  AvailableMoveShipData,
  Building,
  Command,
  Faction,
  GaiaHex,
  isShip,
  Planet,
  Player,
  Reward,
  Round,
} from "@gaia-project/engine";
import { qicForDistance } from "@gaia-project/engine/src/cost";
import assert from "assert";
import { sortBy, sortedUniq } from "lodash";
import { ButtonData, HighlightHex } from "../../data";
import { buildingName, buildingShortcut, shipActionName, shipLetter } from "../../data/building";
import { moveWarnings } from "../../data/warnings";
import { prependShortcut, tooltipWithShortcut, withShortcut } from "./shortcuts";
import { CommandController } from "./types";
import { addOnClick, addOnShow, autoClickButton, confirmationButton, hexMap, isFree, textButton } from "./utils";
import { buttonWarnings, commonButtonWarning } from "./warnings";

export function hexSelectionButton(
  controller: CommandController,
  button: ButtonData,
  newLocationButton = (hex: GaiaHex) => textButton({}),
  highlightOnClick?: Building,
  hideOnClick?: { hex: GaiaHex; building: Building }
): ButtonData {
  assert(button.hexes, "hexes missing");
  assert(!button.buttons, "buttons already exists");
  assert(!button.warning, "warning already exists");

  let i = 1;

  const hexes = button.hexes.hexes;

  const sortKey = (h: HighlightHex): string => (isFree(h) ? "0" : h.cost);

  button.buttons = sortBy(Array.from(hexes.keys()), (h) => sortKey(hexes.get(h)))
    .filter((h) => !hexes.get(h).preventClick)
    .map((hex) => {
      const b = newLocationButton(hex);
      b.command = hex.toString();
      const shortcut = String(i);
      if (i <= 9) {
        b.label = prependShortcut(shortcut, hex.toString());
        b.shortcuts = [shortcut];
        i++;
      } else {
        b.label = hex.toString();
      }

      const highlightHex = hexes.get(hex);
      b.warning = buttonWarnings(highlightHex.warnings?.map((w) => moveWarnings[w].text));
      if (!isFree(highlightHex)) {
        b.conversion = { from: Reward.parse(highlightHex.cost), to: [] };
      }
      b.tooltip = tooltipWithShortcut(null, b.warning);

      addOnShow(b, () => {
        controller.subscribeHexClick(
          b,
          () => {
            controller.handleButtonClick(b);
          },
          (h) => h == hex
        );
      });
      addOnClick(b, () => {
        controller.executeCommand(b);

        if (highlightOnClick) {
          const nullMove = hideOnClick && hideOnClick.hex === hex;
          const map = new Map<GaiaHex, HighlightHex>([
            [hex, { building: nullMove ? null : highlightOnClick, preventClick: true }],
          ]);

          if (hideOnClick && !nullMove) {
            map.set(hideOnClick.hex, { hideBuilding: hideOnClick.building, preventClick: true });
          }
          controller.highlightHexes({ hexes: map });
        }
      });
      return b;
    });
  button.warning = commonButtonWarning(
    "building location",
    Array.from(hexes.values())
      .filter((h) => !h.preventClick)
      .map((h) => h.warnings),
    (w) => moveWarnings[w].text
  );
  return textButton(button);
}

function buildingMenu(building: Building): string | null {
  if (isShip(building)) {
    return "<u>B</u>uild Ship";
  }

  if (building == Building.Academy1 || building == Building.Academy2) {
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
      label = withShortcut(`Upgrade to ${name}`, buildingShortcut(bld, faction), ["Upgrade to"]);
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
    autoClickButton({
      label,
      shortcuts: [shortcut],
      command,
      hexes,
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

function moveTargetButton(controller: CommandController, data: AvailableMoveShipData, target: GaiaHex, engine: Engine) {
  const actions = data.targets.find((t) => t.location.coordinates === target.toString()).actions;
  if (actions.length == 0) {
    return textButton({});
  }
  return textButton({
    buttons: actions
      .map((a) => {
        const hexes = hexMap(engine, a.locations, false);
        hexes.hexes.set(target, { building: data.ship, preventClick: true });

        return hexSelectionButton(
          controller,
          autoClickButton({
            command: a.type,
            label: shipActionName(a.type),
            hexes,
          }),
          () => textButton({})
        );
      })
      .concat(
        textButton({
          label: "Decline",
          shortcuts: ["d"],
          command: "",
        })
      ),
  });
}

function moveSourceButton(controller: CommandController, engine: Engine, data: AvailableMoveShipData) {
  return hexSelectionButton(
    controller,
    autoClickButton({
      hexes: hexMap(
        engine,
        data.targets.map((t) => t.location),
        false
      ),
    }),
    (target) => moveTargetButton(controller, data, target, engine),
    data.ship,
    { building: data.ship, hex: engine.map.getS(data.source) }
  );
}

export function moveShipButton(
  controller: CommandController,
  engine: Engine,
  command: AvailableCommand<Command.MoveShip>
): ButtonData {
  const faction = engine.player(command.player).faction;

  return textButton({
    label: "Move Ship",
    shortcuts: ["o"],
    command: Command.MoveShip,
    buttons: sortedUniq(command.data.map((e) => e.ship)).map((ship) =>
      hexSelectionButton(
        controller,
        autoClickButton({
          label: buildingName(ship, faction),
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
            command.data.find((d) => d.ship == ship && d.source == hex.toString())
          )
      )
    ),
  });
}
