import { Building, Faction } from "@gaia-project/engine";
import { factionColor } from "../graphics/utils";
import * as Honeycomb from "honeycomb-grid";

export default class BuildingRenderer extends PIXI.Graphics {
  constructor(building: Building, faction:Faction, scale: number, border: number) {
    super();

    this.lineStyle(border*2, (faction === Faction.Bescods || faction === Faction.Firaks) ? 0xc0c0c0 : 0x303030);
    this.beginFill(factionColor(faction));
//TODO render different buildings
    switch (building) {
      case Building.Mine: {
        this.drawRect(-0.2*scale, -0.2 * scale, 0.4 * scale, 0.4 * scale);
        break;
      }
      case Building.PlanetaryInstitute: {
        this.drawRect(-0.4*scale, -0.4 * scale, 0.8 * scale, 0.8 * scale);
        break;
      }
      case Building.TradingStation: {
        this.drawPolygon([-0.5, Math.sqrt(3)/4, 0.5, Math.sqrt(3)/4, 0, -Math.sqrt(3)/4, -0.5, Math.sqrt(3)/4].map(x => x * scale*0.6));
        break;
      }
      case Building.ResearchLab: {
        this.drawCircle(0, 0, 0.3*scale);
        break;
      }
      case Building.Academy1:
      case Building.Academy2: {
        this.drawRect(-0.3*scale, -0.3 * scale, 0.6 * scale, 0.6 * scale);
        break;
      }
      case Building.GaiaFormer: {
        const hex = Honeycomb.extendHex({ size: scale * 0.4, orientation: "flat"})(0, 0);
        const [firstCorner, ...otherCorners] = hex.corners();
        const center = {x: scale*0.4, y: otherCorners[1].y/2};

        this.drawPolygon([].concat(...[firstCorner, ...otherCorners, firstCorner].map(corner => [corner.x-center.x, corner.y-center.y])));
      };

      case Building.PlanetaryInstitute: {
        this.drawRect(-0.3*scale, -0.3 * scale, 0.6 * scale, 0.6 * scale);
        break;
      }
    }

    this.endFill();
  }
}