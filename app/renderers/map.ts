import * as PIXI from "pixi.js";
import {GaiaHexData, Planet, Faction} from "@gaia-project/engine";
import { CubeCoordinates } from "hexagrid";
import PlanetRenderer from "./planet";
import BuildingRenderer from "./building";
import {hexCenter, corners} from '../graphics/hex';

const hexData = {
  radius: 16,
  border: {
    width: 1,
    color: 0x666666,
  },
  background: 0x172E62,
  backgroundHighlight: 0xF0F0F0,
  backgroundQicHighlight: 0x91ffc4
};

type GaiaHex = CubeCoordinates & {data: GaiaHexData};

type ZonesOfInterest = Array<{coord: CubeCoordinates, qic: boolean}>;

export default class MapRenderer extends PIXI.Graphics {
  lastData: GaiaHex[];
  zonesOfInterest: ZonesOfInterest = [];
  factions: Faction[] = [];

  constructor() {
    super();
  }

  render(map: GaiaHex[], factions: Faction[], zonesOfInterest?: ZonesOfInterest) {
    this.lastData = map;
    this.zonesOfInterest = zonesOfInterest;
    this.factions = factions;

    this.clear();
    this.removeChildren();

    for (const hex of map) {
      const ofInterest = zonesOfInterest && zonesOfInterest.find(zone => zone.coord.q === hex.q && zone.coord.r === hex.r);
      this.drawHex(hex, !!ofInterest, ofInterest && ofInterest.qic);
    };
  }

  drawHex(hex: GaiaHex, ofInterest = false, qic = false) {
    const graphics = new PIXI.Graphics();

    const point = hexCenter(hex, hexData.radius);
    // separate the first from the other corners
    const [firstCorner, ...otherCorners] = corners(hexData.radius);
    const vertices = [firstCorner, ...otherCorners, firstCorner];

    graphics.lineStyle(hexData.border.width, hexData.border.color);
    graphics.beginFill(ofInterest ? (qic ? hexData.backgroundQicHighlight : hexData.backgroundHighlight) : hexData.background);
    graphics.drawPolygon([].concat(...vertices.map(p => [p.x, p.y])));
    graphics.endFill();

    /* Draw planet if there */
    if (hex.data.planet !== Planet.Empty) {
      const planetGraphics = new PlanetRenderer(hex.data.planet, hexData.radius, hexData.border.width);
      graphics.addChild(planetGraphics);
    }

    /* Draw building if there */
    if (hex.data.building) {
      const building = new BuildingRenderer(hex.data.building, this.factions[hex.data.player], hexData.radius, hexData.border.width);
      graphics.addChild(building);
    }

    [graphics.x, graphics.y] = [point.x, point.y];

    if (ofInterest) {
      graphics.interactive = true;
      graphics.cursor = "pointer";
      graphics.on("click", () => {
        this.emit("hexClick", hex);
      });
    }

    this.addChild(graphics);
  }
}