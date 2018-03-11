import * as PIXI from "pixi.js";

export default class MapRenderer {
  app: PIXI.Application;
  graphics: PIXI.Graphics;

  constructor(view?: HTMLCanvasElement) {
    this.app = new PIXI.Application({transparent: false, antialias: true, view});
    this.graphics = new PIXI.Graphics();

    this.app.stage.addChild(this.graphics);
  }
}