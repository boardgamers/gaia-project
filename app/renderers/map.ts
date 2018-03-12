import * as PIXI from "pixi.js";
import * as Honeycomb from "honeycomb-grid";
import {GaiaHex, Planet} from "@gaia-project/engine";
import { center } from "../graphics/reposition";
import planetData from "../data/planets";

const HEXRADIUS = 15;
const HEXBORDER = 0x666666;
const LINEWIDTH = 1;

export default class MapRenderer {
  app: PIXI.Application;
  graphics: PIXI.Graphics;
  lastData: Honeycomb.Types.Hex<GaiaHex>[];

  constructor(view?: HTMLCanvasElement) {
    this.app = new PIXI.Application({transparent: true, antialias: true, view});
    this.app.renderer.resize(view.offsetWidth, view.offsetHeight);

    this.graphics = new PIXI.Graphics();

    this.app.stage.addChild(this.graphics);

    $(window).on("resize", () => {
      this.app.renderer.resize(view.offsetWidth, view.offsetHeight);
      this.render(this.lastData);
    });
  }

  render(map: Honeycomb.Types.Hex<GaiaHex>[] ) {
    this.lastData = map;
    this.graphics.clear();

    const Hex = Honeycomb.extendHex<GaiaHex>({ size: HEXRADIUS , orientation: "flat", data: {planet: Planet.Empty, sector: null}});
    const Grid = Honeycomb.defineGrid(Hex);

    Grid(...map.map(hex=>Hex(hex))).forEach(hex => {
      this.drawHex(hex);
    });

    // Moves the board back in view
    center(this.graphics, this.app.screen);
  }

  drawHex(hex: Honeycomb.Types.Hex<GaiaHex>) {
    this.graphics.lineStyle(LINEWIDTH, HEXBORDER);

    const point = hex.toPoint();
    // add the hex's position to each of its corner points
    const corners = hex.corners().map(corner => corner.add(point));
    // separate the first from the other corners
    const [firstCorner, ...otherCorners] = corners;

    // move the "pencil" to the first corner
    this.graphics.moveTo(firstCorner.x, firstCorner.y);
    this.graphics.beginFill(0x172E62);
    // draw lines to the other corners
    otherCorners.forEach(({ x, y }) => this.graphics.lineTo(x, y));
    // finish at the first corner
    this.graphics.lineTo(firstCorner.x, firstCorner.y);
    this.graphics.endFill();

    this.drawPlanet(hex.data.planet, point.add(hex.center()));
  }

  drawPlanet(planet: Planet, point: Honeycomb.Types.Point) {
    if (planet === Planet.Empty) {
      return;
    }
    if (!planetData[planet]) {
      console.log("Unknown planet for drawing", planet);
      return;
    }

    const planetInfo = planetData[planet];

    this.graphics.beginFill(planetInfo.color);
    this.graphics.moveTo(point.x, point.y);
    this.graphics.lineStyle(LINEWIDTH, planetInfo.borderColor);
    this.graphics.drawCircle(point.x, point.y, planetInfo.radius * HEXRADIUS);
    this.graphics.endFill();
  }
}