import * as PIXI from "pixi.js";
import {GaiaHexData, Planet, ResearchField} from "@gaia-project/engine";
import { center } from "../graphics/reposition";
import researchData from "../data/research";

type GaiaHex = {data: GaiaHexData, orientation: "flat"} & {size: number};

const fullWidth = 360;
const fullHeight = 360;

const trackHeight = 50;
const trackWidth = 60;

const trackBorder = {
  width: 1,
  color: 0x666666,
  radius: 10
}

export default class ResearchRenderer {
  app: PIXI.Application;
  graphics: PIXI.Graphics;
  lastData: any;

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

  render(data: any) {
    this.lastData = data;
    this.graphics.clear();

    const researchs = Object.values(ResearchField);

    this.graphics.drawRect(0, 0, fullWidth, fullHeight);

    for (let i = 0; i < researchs.length; i++) {
      const research: ResearchField = researchs[i];

      const x = i * trackWidth;

      for (let j = 0; j < 3; j++) {
        this.drawResearchTile(research, x, fullHeight - trackHeight * (1 + j))
      }
      for (let j = 3; j < 5; j++) {
        this.drawResearchTile(research, x, fullHeight - trackHeight * (1 + j) - 20)
      }

      this.drawResearchTile(research, x, fullHeight - trackHeight * 6 - 60)
    }

    // Moves the board back in view
    center(this.graphics, this.app.screen);
  }

  drawResearchTile(research: ResearchField, x: number, y: number) {
    this.graphics.beginFill(researchData[research].color);
    this.graphics.lineStyle(trackBorder.width, trackBorder.color); 
    this.graphics.drawRoundedRect(x, y, trackWidth, trackHeight, trackBorder.radius);
    this.graphics.endFill();
  }
}