import * as PIXI from "pixi.js";
import {GaiaHexData, Planet, ResearchField, Player} from "@gaia-project/engine";
import { center } from "../graphics/reposition";
import researchData from "../data/research";
import ResearchTile from "./research-tile";

const {
  trackBorder,
  trackHeight,
  trackWidth,
  fullHeight,
  fullWidth
} = researchData;

export default class ResearchRenderer {
  app: PIXI.Application;
  graphics: PIXI.Graphics;
  lastData: Player[];
  researchTiles: {
    [key in ResearchField]: ResearchTile[]
  };

  constructor(view?: HTMLCanvasElement) {
    this.app = new PIXI.Application({transparent: true, antialias: true, view});
    this.app.renderer.resize(view.offsetWidth, view.offsetHeight);

    this.graphics = new PIXI.Graphics();

    this.app.stage.addChild(this.graphics);

    $(window).on("resize", () => {
      this.app.renderer.resize(view.offsetWidth, view.offsetHeight);
      this.render(this.lastData);
    });

    this.researchTiles = {} as any;

    const researchs = Object.values(ResearchField);
    for (let i = 0; i < researchs.length; i++) {
      const research: ResearchField = researchs[i];

      const x = i * trackWidth;

      const arr = this.researchTiles[research] = [];

      for (let j = 0; j < 3; j++) {
        const tile = new ResearchTile(research, j);
        tile.move(x, fullHeight - trackHeight * (1 + j));
        arr.push(tile);
      }
      for (let j = 3; j < 5; j++) {
        const tile = new ResearchTile(research, j);
        tile.move(x, fullHeight - trackHeight * (1 + j) - 20);
        arr.push(tile);
      }

      const tile = new ResearchTile(research, 5);
      tile.move(x, fullHeight - trackHeight * 6 - 60);
      arr.push(tile);
    }
  }

  render(data: Player[]) {
    if (data !== this.lastData) {
      this.updateInfo(data);
    }
    this.lastData = data;
    this.graphics.clear();

    for (const tile of this.tilesList()) {
      tile.draw(this.graphics);
    }

    // Moves the board back in view
    center(this.graphics, this.app.screen);
  }

  updateInfo(players: Player[]) {
    players = players.filter(pl => pl.faction);

    for (const tile of this.tilesList()) {
      tile.factions = players.filter(pl => pl.data.research[tile.field] === tile.level).map(pl => pl.faction);
    }
  }

  tilesList() : ResearchTile[] {
    return [].concat(...Object.values(this.researchTiles));
  }
 
  drawResearchTile(research: ResearchField, x: number, y: number) {
    this.graphics.beginFill(researchData[research].color);
    this.graphics.lineStyle(trackBorder.width, trackBorder.color); 
    this.graphics.drawRoundedRect(x, y, trackWidth, trackHeight, trackBorder.radius);
    this.graphics.endFill();
  }
}