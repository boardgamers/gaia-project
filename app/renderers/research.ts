import * as PIXI from "pixi.js";
import {GaiaHexData, Planet, ResearchField, Player} from "@gaia-project/engine";
import researchData from "../data/research";
import ResearchTile from "./research-tile";

const {
  trackBorder,
  trackHeight,
  trackWidth,
  fullHeight,
  fullWidth
} = researchData;

export default class ResearchRenderer extends PIXI.Graphics {
  lastData: Player[];
  researchTiles: {
    [key in ResearchField]: ResearchTile[]
  };

  constructor() {
    super();

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

    for (const tile of this.tilesList()) {
      this.addChild(tile);
      tile.on("fieldClick", (field, level) => {
        this.emit("fieldClick", field, level);
      });
      tile.on("tooltip", (elem, text) => {
        this.emit("tooltip", elem, text);
      });
      tile.on("tooltip-remove", (elem, text) => {
        this.emit("tooltip-remove", elem, text);
      });
    }
  }

  render(data: Player[], highlight?: Array<{field: ResearchField, level: number}>) {
    if (data !== this.lastData) {
      this.updateInfo(data);
    }
    this.lastData = data;
    this.clear();

    for (const tile of this.tilesList()) {
      const highlighted = highlight && highlight.some(data => data.field === tile.field && data.level === tile.level);

      tile.draw(highlighted);
    }
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
}