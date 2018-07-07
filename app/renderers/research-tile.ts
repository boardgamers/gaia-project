import { ResearchField, Faction } from "@gaia-project/engine";
import researchData, {descriptions} from "../data/research";
import Token from "./token";
import { Graphics } from "pixi.js";

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

export default class ResearchTile extends Graphics {
  constructor(public field: ResearchField, public level: number) {
    super();
  }

  move(x: number, y: number) {
    this.position.set(x, y);
  }

  draw(highlighted: boolean) {
    this.interactive = true;

    const baseColor = researchData[this.field].color;
    let fillColor = baseColor;

    if (highlighted) {
      const [r, g, b] = PIXI.utils.hex2rgb(baseColor);
      console.log(r,g,b);
      fillColor = PIXI.utils.rgb2hex([r*0.6 + 0.4, g*0.6 + 0.4, b*0.6 + 0.4]);
    }

    this.clear();
    this.beginFill(fillColor);
    this.lineStyle(trackBorder.width, trackBorder.color); 
    this.drawRoundedRect(0, 0, trackWidth, trackHeight, trackBorder.radius);
    this.endFill();

    for (let i = 0; i < this.factions.length; i++) {
      const faction = this.factions[i];

      const tokenX = tokenPositions[this.factions.length][i].x;
      const tokenY = tokenPositions[this.factions.length][i].y;

      Token.draw(faction, tokenX, tokenY, this);
    }

    if (highlighted) {
      this.cursor = "pointer";
      this.on("click", () => {
        this.emit("fieldClick", this.field, this.level);
      });
    } else {
      this.off("click");
    }

    this.on("mouseover", () => {
      this.emit("tooltip", this, `<b>Level ${this.level}:</b> ${descriptions[this.field][this.level]}`);
    });
    this.on("mouseout", () => {
      this.emit("tooltip-remove", this);
    });
  }

  factions: Faction[] = [];
}