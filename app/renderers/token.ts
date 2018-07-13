import { Faction } from "@gaia-project/engine";
import { factionColor } from "../graphics/utils";

const tokenRadius = 6;

export default class Token {
  static draw(faction: Faction, centerX: number, centerY: number, graphics: PIXI.Graphics, radius = tokenRadius) {
    graphics.lineStyle(0.5, 0x303030, 0.5);
    graphics.beginFill(factionColor(faction));
    graphics.drawCircle(centerX, centerY, radius);
    graphics.endFill();
  }
}