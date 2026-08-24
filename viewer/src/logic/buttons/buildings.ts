import Engine, {
  ANALYSIS_CHEAP_BUILD,
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
import { ButtonData } from "../../data";
import { availableBuildingShortcut, buildingName } from "../../data/building";
import { RichText, richText, richTextArrow, richTextBuilding } from "../../graphics/rich-text";
import { pick, sortBy } from "../lodash-utils";
import { hexSelectionButton } from "./hex";
import { withShortcut } from "./shortcuts";
import { CommandController } from "./types";
import { confirmationButton, hexMap, isFree, symbolButton, textButton } from "./utils";
import { commonButtonWarning } from "./warnings";

function buildingMenu(building: Building, faction: Faction): { richText?: RichText; label: string } | null {
  if (isShip(building)) {
    return { label: "<u>B</u>uild Ship" };
  }

  if (isAcademy(building)) {
    return { label: "Upgrade to A<u>c</u>ademy", richText: [richTextBuilding(Building.Academy1, faction, 1, true)] };
  }

  return null;
}

/**
 * The sandbox's pair of Trading Station buttons (owner instruction, 2026-08-19). Every build button
 * in this app is icon-only - the words live in the tooltip - which is fine when each icon is a
 * different building, and useless the moment two buttons carry the SAME Trading Station icon. So
 * whenever the sandbox twin exists, BOTH get a visible word on the button face: you pick "cheap" or
 * "expensive" by reading them, not by hovering. Outside sandbox mode there is no twin and the real
 * button keeps exactly the bare icon it has always had.
 */
function buildingLabel(
  bld: AvailableBuilding,
  faction: Faction,
  hasCheapTwin = false
): { richText: RichText; label: string } {
  const building = bld.building;
  const name = buildingName(building, faction);
  if (bld.analysisCheap) {
    return {
      label: `Cheap ${name} - sandbox only: 3c, as if an opponent's building were next door. A line holding one cannot be committed.`,
      richText: [richText("Cheap"), richTextBuilding(building, faction)],
    };
  }
  let label = `Build a ${name}`;
  const rich = [richTextBuilding(building, faction)];

  if (bld.upgrade) {
    if (building == Building.Mine) {
      label = "Upgrade Gaia Former to Mine";
      rich.unshift(richTextBuilding(Building.GaiaFormer, faction), richTextArrow);
    } else if (hasCheapTwin) {
      // No `withShortcut` here: it exists to put the shortcut's underline into the label text, and
      // `symbolButton`'s own `tooltipWithShortcut` already does that from `button.shortcuts` - which
      // this button still carries, so `t` keeps working and the tooltip still marks it.
      label = `Expensive ${name} - the real price: 6c on a hex with no opponent's building next door`;
      rich.unshift(richText("Expensive"));
    } else {
      label = withShortcut(`Upgrade to ${name}`, availableBuildingShortcut(bld, faction), ["Upgrade to"]);
    }
  } else if (bld.downgrade) {
    label = `Downgrade to ${name}`;
    rich.unshift(richText("Downgrade to"));
  } else if (
    isFree(bld.cost) ||
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
  shortcut: string | null,
  command: string,
  engine: Engine,
  buildings: AvailableBuilding[],
  confirm: ButtonData[],
  upgrade: boolean,
  player: Player,
  /** Appended to each hex button's own command, so the sandbox's second Trading Station commits as
   * `build ts <hex> cheap` and the engine can tell the two entries for that hex apart. */
  commandSuffix?: string
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
  const parent = hexSelectionButton(
    controller,
    symbolButton({
      label,
      richText,
      shortcuts: shortcut ? [shortcut] : [],
      command,
      hexes,
      smartAutoClick: !isShip(building),
    }),
    () => textButton({ buttons: confirm }),
    building,
    null,
    symbolButton
  );
  if (commandSuffix) {
    // `hexSelectionButton` sets each child's command to the bare hex; the qualifier has to land after
    // it, since the engine reads it as the argument following the location.
    for (const b of parent.buttons ?? []) {
      b.command = `${b.command} ${commandSuffix}`;
    }
  }
  return parent;
}

export function buildButtons(
  controller: CommandController,
  engine: Engine,
  command: AvailableCommand<Command.Build>,
  player: Player
): ButtonData[] {
  const byTypeLabel = new Map<string, AvailableBuilding[]>();
  const faction = engine.player(command.player).faction;
  // Only true inside the sandbox, and only where a hex was isolated enough to be worth duplicating.
  const cheapTwins = new Set(command.data.buildings.filter((b) => b.analysisCheap).map((b) => b.building as Building));
  for (const bld of command.data.buildings) {
    // `analysisCheap` is part of the key so the sandbox's neighbour-priced Trading Station becomes its
    // OWN button rather than being folded into the real one - two buttons for one hex, which is the
    // whole point of it (owner instruction, 2026-08-19).
    const key = JSON.stringify(pick(bld, ["building", "upgrade", "downgrade", "analysisCheap"]));
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
  const menuButtons: ButtonData[] = [];

  for (const s of sorted) {
    const buildings = s[1] as AvailableBuilding[];
    const b = buildings[0];
    const label = buildingLabel(b, faction, cheapTwins.has(b.building));

    const building = b.building;
    // No shortcut for the sandbox's cheap Trading Station: it would be the same letter as the real
    // one beside it, and nothing here resolves a collision - both buttons would fire on that key.
    const shortcut = b.analysisCheap ? null : availableBuildingShortcut(b, faction);

    const menu = buildingMenu(building, player.faction);
    if (menu) {
      const buttons = menus.get(menu.label) ?? [];

      if (buttons.length == 0) {
        const fac = menu.richText ? symbolButton : textButton;
        const menuButton = fac({
          label: menu.label,
          richText: menu.richText,
          command: Command.Build,
          buttons,
        });
        ret.push(menuButton);
        menuButtons.push(menuButton);
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
          player,
          b.analysisCheap ? ANALYSIS_CHEAP_BUILD : undefined
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
          player,
          b.analysisCheap ? ANALYSIS_CHEAP_BUILD : undefined
        )
      );
    }
  }
  for (const button of menuButtons) {
    button.warning = commonButtonWarning(
      controller,
      "choice",
      button.buttons.map((b) => b.warning?.body ?? [])
    );
  }
  return ret;
}
