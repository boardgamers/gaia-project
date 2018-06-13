import * as PIXI from "pixi.js";
import * as Honeycomb from "honeycomb-grid";
import {GaiaHexData, Planet} from "@gaia-project/engine";
import { center } from "../graphics/reposition";
import planetData from "../data/planets";
import { CubeCoordinates } from "hexagrid";
import { EventEmitter } from "eventemitter3";

const hexData = {
  radius: 15,
  border: {
    width: 1,
    color: 0x666666,
  },
  background: 0x172E62,
  backgroundHighlight: 0xF0F0F0
};

type GaiaHex = {data: GaiaHexData, orientation: "flat"} & {size: number};

export default class MapRenderer extends EventEmitter {
  app: PIXI.Application;
  graphics: PIXI.Graphics;
  lastData: Array<Honeycomb.CubeCoordinates & {data: GaiaHexData}>;
  zonesOfInterest: CubeCoordinates[] = [];

  constructor(view?: HTMLCanvasElement) {
    super();

    this.app = new PIXI.Application({transparent: true, antialias: true, view});
    this.app.renderer.resize(view.offsetWidth, view.offsetHeight);
    this.app.renderer.autoResize = true;

    this.graphics = new PIXI.Graphics();

    this.app.stage.addChild(this.graphics);

    $(window).on("resize", () => {
      this.app.renderer.resize(view.offsetWidth, view.offsetHeight);
      this.render(this.lastData, this.zonesOfInterest);
    });
  }

  render(map: Array<Honeycomb.CubeCoordinates & {data: GaiaHexData}>, zonesOfInterest?: CubeCoordinates[]) {
    this.lastData = map;
    this.zonesOfInterest = zonesOfInterest;

    this.graphics.clear();
    this.app.stage.removeChildren();

    const Hex = Honeycomb.extendHex<GaiaHex>({ size: hexData.radius , orientation: "flat", data: {planet: Planet.Empty, sector: null}});
    const Grid = Honeycomb.defineGrid(Hex);

    Grid(...map.map(hex=>Hex(hex))).forEach(hex => {
      const ofInterest = zonesOfInterest && zonesOfInterest.some(zone => zone.q === hex.q && zone.r === hex.r);
      this.drawHex(hex, ofInterest);
    });

    // Moves the board back in view
    center(this.app.stage, this.app.screen);
  }

  drawHex(hex: Honeycomb.Hex<GaiaHex>, ofInterest = false) {
    const graphics = new PIXI.Graphics();

    const point = hex.toPoint();
    // separate the first from the other corners
    const [firstCorner, ...otherCorners] = hex.corners();

    graphics.lineStyle(hexData.border.width, hexData.border.color);
    graphics.beginFill(ofInterest ? hexData.backgroundHighlight : hexData.background);
    graphics.drawPolygon([].concat(...hex.corners().map(corner => [corner.x, corner.y])));
    graphics.endFill();

    const planet = hex.data.planet;

    if (planet && planet !== Planet.Empty && planetData[planet]) {
      const planetInfo = planetData[planet];

      graphics.beginFill(planetInfo.color);
      graphics.lineStyle(hexData.border.width, planetInfo.borderColor);
      graphics.drawCircle(hexData.radius, otherCorners[1].y/2, planetInfo.radius * hexData.radius);
      graphics.endFill();
    }

    const {x, y} = hex.toPoint();
    graphics.x = x;
    graphics.y = y;

    if (ofInterest) {
      graphics.interactive = true;
      graphics.cursor = "pointer";
      graphics.on("click", () => {
        this.emit("hexClick", hex);
      });
    }

    this.app.stage.addChild(graphics);
  }
}