import { Building, GaiaHex, Resource, Reward } from "@gaia-project/engine";
import assert from "assert";
import { sortBy } from "lodash";
import { ButtonData, HighlightHex } from "../../data";
import { buildingData } from "../../data/building";
import { RichText, richText, richTextArrow, richTextRewards } from "../../graphics/rich-text";
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
        label.push(
          richTextRewards(
            isFree(highlightHex.cost) ? [new Reward(0, Resource.Credit)] : Reward.parse(highlightHex.cost)
          )
        );
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
