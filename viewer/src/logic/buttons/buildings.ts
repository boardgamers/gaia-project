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
import { pick, sortBy } from "lodash";
import { ButtonData } from "../../data";
import { availableBuildingShortcut, buildingName } from "../../data/building";
import { RichText, richText, richTextArrow, richTextBuilding } from "../../graphics/rich-text";
import { hexSelectionButton } from "./hex";
import { withShortcut } from "./shortcuts";
import { CommandController } from "./types";
import { confirmationButton, hexMap, isFree, symbolButton, textButton } from "./utils";

function buildingMenu(building: Building, faction: Faction): { richText?: RichText; label: string } | null {
  if (isShip(building)) {
    return { label: "<u>B</u>uild Ship" };
  }

  if (isAcademy(building)) {
    return { label: "Upgrade to A<u>c</u>ademy", richText: [richTextBuilding(Building.Academy1, faction, 1, true)] };
  }

  return null;
}

function buildingLabel(bld: AvailableBuilding, faction: Faction): { richText: RichText; label: string } {
  const building = bld.building;
  const name = buildingName(building, faction);
  let label = `Build a ${name}`;
  const rich = [richTextBuilding(building, faction)];

  if (bld.upgrade) {
    if (building == Building.Mine) {
      label = "Upgrade Gaia Former to Mine";
      rich.unshift(richTextBuilding(Building.GaiaFormer, faction), richTextArrow);
    } else {
      label = withShortcut(`Upgrade to ${name}`, availableBuildingShortcut(bld, faction), ["Upgrade to"]);
    }
  } else if (bld.downgrade) {
    label = `Downgrade to ${name}`;
    rich.unshift(richText("Downgrade to"));
  } else if (
    isFree(bld) ||
    building === Building.SpaceStation ||
    building === Building.GaiaFormer ||
    isShip(building)
  ) {
    label = `Place a ${name}`;
  }
  return { label, richText: rich };
}

function buildingButton(
  controller: CommandController,
  building: Building,
  label: string,
  richText: RichText,
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
    symbolButton({
      label,
      richText,
      shortcuts: [shortcut],
      command,
      hexes,
      smartAutoClick: !isShip(building),
    }),
    () => textButton({ buttons: confirm }),
    building,
    null,
    symbolButton
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
    const key = JSON.stringify(pick(bld, ["building", "upgrade", "downgrade"]));
    const old = byTypeLabel.get(key) ?? [];
    old.push(bld);
    byTypeLabel.set(key, old);
  }

  const sort = Building.values(Expansion.All);
  const sorted = sortBy(
    Array.from(byTypeLabel.entries()),
    ([, b]) => sort.indexOf(b[0].building) * 2 + (b[0].upgrade || b[0].downgrade ? 1 : 0)
  );

  const ret: ButtonData[] = [];
  const menus = new Map<string, ButtonData[]>();

  for (const s of sorted) {
    const buildings = s[1] as AvailableBuilding[];
    const b = buildings[0];
    const label = buildingLabel(b, faction);

    const building = b.building;
    const shortcut = availableBuildingShortcut(b, faction);

    const menu = buildingMenu(building, player.faction);
    if (menu) {
      const buttons = menus.get(menu.label) ?? [];

      if (buttons.length == 0) {
        const fac = menu.richText ? symbolButton : textButton;
        ret.push(
          fac({
            label: menu.label,
            richText: menu.richText,
            command: Command.Build,
            buttons,
          })
        );
      }

      buttons.push(
        buildingButton(
          controller,
          building,
          label.label,
          label.richText,
          shortcut,
          building,
          engine,
          buildings,
          [],
          b.upgrade,
          player
        )
      );

      menus.set(menu.label, buttons);
    } else {
      ret.push(
        buildingButton(
          controller,
          building,
          label.label,
          label.richText,
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
