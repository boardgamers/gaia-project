import { ResearchField, Faction } from "@gaia-project/engine";
import researchData from "../data/research";
import Token from "./token";

const {
  trackBorder, trackHeight, trackWidth
} = researchData;

const tokenPositions = {
  1: [{x: 30, y: 25}],
  2: [{x: 20, y: 25}, {x: 40, y: 25}],
  3: [{x: 12, y: 25}, {x: 30, y: 25}, {x: 48, y: 25}],
  4: [{x: 20, y: 15}, {x: 40, y: 15}, {x: 20, y: 35}, {x: 40, y: 35}],
  5: [{x: 20, y: 15}, {x: 40, y: 15}, {x: 12, y: 35}, {x: 30, y: 35}, {x: 48, y: 35}],
};

export default class ResearchTile {
  constructor(public field: ResearchField, public level: number) {

  }

  move(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  draw(graphics: PIXI.Graphics) {
    graphics.beginFill(researchData[this.field].color);
    graphics.lineStyle(trackBorder.width, trackBorder.color); 
    graphics.drawRoundedRect(this.x, this.y, trackWidth, trackHeight, trackBorder.radius);
    graphics.endFill();

    for (let i = 0; i < this.factions.length; i++) {
      const faction = this.factions[i];

      const tokenX = tokenPositions[this.factions.length][i].x;
      const tokenY = tokenPositions[this.factions.length][i].y;

      Token.draw(faction, this.x + tokenX, this.y + tokenY, graphics);
    }
  }

  x: number = 0;
  y: number = 0;

  factions: Faction[] = [];
}