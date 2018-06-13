import { Building, Faction } from "@gaia-project/engine";
import { factionColor } from "../graphics/utils";

export default class BuildingRenderer extends PIXI.Graphics {
  constructor(building: Building, faction:Faction, scale: number, border: number) {
    super();

    this.lineStyle(border*2, 0x303030);
    this.beginFill(factionColor(faction));

    switch (building) {
      case Building.Mine: {
        this.drawRect(-0.3*scale, -0.3 * scale, 0.6 * scale, 0.6 * scale);
        break;
      }
    }

    this.endFill();
  }
}