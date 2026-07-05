import {
  Building,
  classifySectorId,
  GaiaHex,
  LostFleetSectorType,
  Planet,
  Resource,
  Reward,
} from "@gaia-project/engine";
import assert from "assert";
import { sortBy } from "lodash";
import { ButtonData, HighlightHex } from "../../data";
import { buildingData } from "../../data/building";
import { planetNames } from "../../data/planets";
import { splitCostBonus } from "../../data/resources";
import { RichText, richText, richTextArrow, richTextPlanet, richTextRewards } from "../../graphics/rich-text";
import { prependShortcut, tooltipWithShortcut } from "./shortcuts";
import { CommandController } from "./types";
import { addOnClick, addOnShow, isFree, textButton } from "./utils";
import { buttonWarnings, commonButtonWarning } from "./warnings";

export function hexSelectionButton(
  controller: CommandController,
  button: ButtonData,
  newLocationButton = (hex: GaiaHex) => textButton({}),
  highlightOnClick?: Building,
  hideOnClick?: { hex: GaiaHex; building: Building },
  buttonTransformer = textButton
): ButtonData {
  const hexSelection = button.hexes;
  assert(hexSelection, "hexes missing");
  assert(!button.buttons, "buttons already exists");
  assert(!button.warning, "warning already exists");

  let i = 1;

  const hexes = hexSelection.hexes;

  const sortKey = (h: HighlightHex): string => (isFree(h.cost) ? "0" : h.cost);

  button.buttons = sortBy(Array.from(hexes.keys()), (h) => sortKey(hexes.get(h)))
    .filter((h) => !hexes.get(h).preventClick)
    .map((hex) => {
      const b = newLocationButton(hex);
      assert(!b.command, "command already exists");
      assert(!b.label, "label already exists");
      assert(!b.richText, "richText already exists");
      assert(!b.shortcuts, "shortcuts already exists");
      assert(!b.warning, "warning already exists");
      assert(!b.tooltip, "tooltip already exists");
      assert(!b.hover, "hover already exists");

      b.command = hex.toString();
      const shortcut = String(i);

      //we need the label to determine the active button
      b.label = hex.toString();

      const label: RichText = [];
      b.richText = label;

      if (i <= 9) {
        label.push(richText(prependShortcut(shortcut, hex.toString())));
        b.shortcuts = [shortcut];
        i++;
      } else {
        label.push(richText(hex.toString()));
      }

      // Lost Fleet Interspace/Deep Space addresses (IS3, DS14_1) don't carry a readable sector
      // reference like base-game coordinates do, so show which planet the button targets
      if (hex.data.planet !== Planet.Empty && classifySectorId(hex.data.sector) !== LostFleetSectorType.Space) {
        label.push(richTextPlanet(hex.data.planet), richText(planetNames[hex.data.planet]));
      }

      const highlightHex = hexes.get(hex);
      if (highlightHex.tradeCost) {
        label.push(richTextRewards(Reward.parse(highlightHex.tradeCost)), richTextArrow);
      }
      if (highlightHex.rewards) {
        label.push(richTextRewards(Reward.parse(highlightHex.rewards)));
      }
      if (highlightHex.building) {
        label.push(richText(`Build ${buildingData[highlightHex.building].name} for`));
      }
      if (highlightHex.cost != null) {
        if (isFree(highlightHex.cost)) {
          label.push(richTextRewards([new Reward(0, Resource.Credit)]));
        } else {
          const { cost, bonus } = splitCostBonus(Reward.parse(highlightHex.cost));
          label.push(richTextRewards(cost));
          for (const b of bonus) {
            label.push(richText(`(+${b.count} VP bonus)`));
          }
        }
      }

      b.warning = buttonWarnings(highlightHex.warnings);
      b.tooltip = tooltipWithShortcut(null, b.warning);

      b.hover = {
        enter: () => {
          const h = Object.assign({}, hexSelection);
          h.hexes = new Map(Array.from(hexes.entries()).filter((e) => e[0] === hex));
          h.selectedLight = false;
          controller.highlightHexes(h);
        },
        leave: () => {
          controller.highlightHexes(hexSelection);
          controller.disableTooltips();
        },
      };

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
    controller,
    "building location",
    Array.from(hexes.values())
      .filter((h) => !h.preventClick)
      .map((h) => h.warnings)
  );
  return buttonTransformer(button);
}
