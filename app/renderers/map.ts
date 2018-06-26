import * as PIXI from "pixi.js";
import * as Honeycomb from "honeycomb-grid";
import {GaiaHexData, Planet, Faction} from "@gaia-project/engine";
import { CubeCoordinates } from "hexagrid";
import PlanetRenderer from "./planet";
import BuildingRenderer from "./building";

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

type GaiaHex = {data: GaiaHexData, orientation: "flat"} & {size: number};
type ZonesOfInterest = Array<{coord: CubeCoordinates, qic: boolean}>;

export default class MapRenderer extends PIXI.Graphics {
  lastData: Array<Honeycomb.CubeCoordinates & {data: GaiaHexData}>;
  zonesOfInterest: ZonesOfInterest = [];
  factions: Faction[] = [];

  constructor() {
    super();
  }

  render(map: Array<Honeycomb.CubeCoordinates & {data: GaiaHexData}>, factions: Faction[], zonesOfInterest?: ZonesOfInterest) {
    this.lastData = map;
    this.zonesOfInterest = zonesOfInterest;
    this.factions = factions;

    this.clear();
    this.removeChildren();

    const Hex = Honeycomb.extendHex<GaiaHex>({ size: hexData.radius , orientation: "flat", data: {planet: Planet.Empty, sector: null}});
    const Grid = Honeycomb.defineGrid(Hex);

    Grid(...map.map(hex=>Hex(hex))).forEach(hex => {
      const ofInterest = zonesOfInterest && zonesOfInterest.find(zone => zone.coord.q === hex.q && zone.coord.r === hex.r);
      this.drawHex(hex, !!ofInterest, ofInterest && ofInterest.qic);
    });
  }

  drawHex(hex: Honeycomb.Hex<GaiaHex>, ofInterest = false, qic = false) {
    const graphics = new PIXI.Graphics();

    const point = hex.toPoint();
    // separate the first from the other corners
    const [firstCorner, ...otherCorners] = hex.corners();
    const center = {x: hexData.radius, y: otherCorners[1].y/2};

    graphics.lineStyle(hexData.border.width, hexData.border.color);
    graphics.beginFill(ofInterest ? (qic ? hexData.backgroundQicHighlight : hexData.backgroundHighlight) : hexData.background);
    graphics.drawPolygon([].concat(...hex.corners().map(corner => [corner.x, corner.y])));
    graphics.endFill();

    /* Draw planet if there */
    if (hex.data.planet !== Planet.Empty) {
      const planetGraphics = new PlanetRenderer(hex.data.planet, hexData.radius, hexData.border.width);
      [planetGraphics.x, planetGraphics.y] = [center.x, center.y];
      graphics.addChild(planetGraphics);
    }

    /* Draw building if there */
    if (hex.data.building) {
      const building = new BuildingRenderer(hex.data.building, this.factions[hex.data.player], hexData.radius, hexData.border.width);
      [building.x, building.y] = [center.x, center.y];
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