import * as PIXI from "pixi.js";
import * as Honeycomb from "honeycomb-grid";
import {GaiaHex, Planet} from "@gaia-project/engine";

export default class MapRenderer {
  app: PIXI.Application;
  graphics: PIXI.Graphics;

  constructor(view?: HTMLCanvasElement) {
    this.app = new PIXI.Application({transparent: true, antialias: true, view});
    this.app.renderer.resize(view.offsetWidth, view.offsetHeight);

    this.graphics = new PIXI.Graphics();

    this.app.stage.addChild(this.graphics);
  }

  render(map: Honeycomb.Types.Hex<GaiaHex>[] ) {
    this.graphics.lineStyle(1, 0x333333);
    const Hex = Honeycomb.extendHex<GaiaHex>({ size: 15 , orientation: "flat", data: {planet: Planet.Empty, sector: null}});
    const Grid = Honeycomb.defineGrid(Hex);

    Grid(...map.map(hex=>Hex(hex))).forEach(hex => {
      const point = hex.toPoint();
      // add the hex's position to each of its corner points
      const corners = hex.corners().map(corner => corner.add(point));
      // separate the first from the other corners
      const [firstCorner, ...otherCorners] = corners;

      // move the "pencil" to the first corner
      this.graphics.moveTo(firstCorner.x, firstCorner.y);
      this.graphics.beginFill(0x0099FF);
      // draw lines to the other corners
      otherCorners.forEach(({ x, y }) => this.graphics.lineTo(x, y));
      // finish at the first corner
      this.graphics.lineTo(firstCorner.x, firstCorner.y);
      this.graphics.endFill();
    });
  }
}