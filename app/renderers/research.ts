import * as PIXI from "pixi.js";
import {GaiaHexData, Planet, ResearchField, Player, AdvTechTilePos, AdvTechTile} from "@gaia-project/engine";
import researchData from "../data/research";
import ResearchTile from "./research-tile";
import { TechTilePos, TechTile as TechTileEnum } from "@gaia-project/engine";
import TechTile from "./tech-tile";

const {
  trackBorder,
  trackHeight,
  trackWidth,
  fullHeight,
  fullWidth
} = researchData;

interface Data {
  players: Player[];
  techTiles: {
    [key in TechTilePos]: {
      tile: TechTileEnum,
      numTiles: number
    }
  },
  advTechTiles: {
    [key in TechTilePos]: {
      tile: AdvTechTile,
      numTiles: number
    }
  }
}

export default class ResearchRenderer extends PIXI.Graphics {
  lastData: Data;
  researchTiles: {
    [key in ResearchField]: ResearchTile[]
  };
  techTiles: {
    [key in TechTilePos]: TechTile
  };
  advTechTiles: {
    [key in AdvTechTilePos]: TechTile
  };

  constructor() {
    super();

    this.researchTiles = {} as any;
    this.techTiles = {} as any;
    this.advTechTiles = {} as any;

    const researchs = Object.values(ResearchField);
    for (let i = 0; i < researchs.length; i++) {
      const research: ResearchField = researchs[i];

      const x = i * trackWidth;

      const arr: ResearchTile[] = this.researchTiles[research] = [];

      for (let j = 0; j < 3; j++) {
        const tile = new ResearchTile(research, j);
        tile.move(x, fullHeight - trackHeight * (1 + j));
        arr.push(tile);
      }
      for (let j = 3; j < 5; j++) {
        const tile = new ResearchTile(research, j);
        tile.move(x, fullHeight - trackHeight * (1 + j) - 17);
        arr.push(tile);
      }

      const tile = new ResearchTile(research, 5);
      tile.move(x, fullHeight - trackHeight * 6 - 60);

      arr.push(tile);

      const techTile = this.techTiles[research] = new TechTile(research as any);
      [techTile.x, techTile.y] = [arr[0].x, arr[0].y + trackHeight + 5];
      
      const advTechTile = this.advTechTiles[`adv-${research}`] = new TechTile(`adv-${research}` as any);
      [advTechTile.x, advTechTile.y] = [arr[5].x, arr[5].y + trackHeight + 4];
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

    // Free tech tiles
    for (let i = 0; i < 3; i++) {
      const pos = [TechTilePos.Free1, TechTilePos.Free2, TechTilePos.Free3][i];

      const techTile = this.techTiles[pos] = new TechTile(pos);
      const researchTile = this.researchTiles[researchs[i*2]][3];

      [techTile.x, techTile.y] = [researchTile.x + trackWidth/2, researchTile.y + trackHeight*0.8];
    }

    for (const techPos of Object.values(TechTilePos)) {
      this.techTiles[techPos].on("techClick", pos => this.emit("techClick", pos));
    }
    for (const techPos of Object.values(AdvTechTilePos)) {
      this.advTechTiles[techPos].on("techClick", pos => this.emit("advTechClick", pos));
    }
    for (const tile of Object.values(this.techTiles).concat(Object.values(this.advTechTiles))) {
      this.addChild(tile);
      tile.on("tooltip", (elem, text) => {
        this.emit("tooltip", elem, text);
      });
      tile.on("tooltip-remove", (elem, text) => {
        this.emit("tooltip-remove", elem, text);
      });
    }
  }

  render(data: Data, highlight?: {fields?: Array<{field: ResearchField, level: number}>, techs?: Array<TechTilePos|AdvTechTilePos>}) {
    if (data !== this.lastData) {
      this.updateInfo(data);
    }
    this.lastData = data;
    this.clear();

    const fields = highlight && highlight.fields || [];
    const techs = highlight && highlight.techs || [];

    for (const tile of this.tilesList()) {
      const highlighted = fields.some(data => data.field === tile.field && data.level === tile.level);

      tile.draw(highlighted);
    }
    
    for (const techTilePos of Object.values(TechTilePos)) {
      const tile: TechTile = this.techTiles[techTilePos];
      const highlighted = techs.includes(techTilePos);

      tile.draw(data.techTiles[techTilePos].tile, data.techTiles[techTilePos].numTiles, highlighted);
    }

    for (const advTechTilePos of Object.values(AdvTechTilePos)) {
      const tile: TechTile = this.advTechTiles[advTechTilePos];
      const highlighted = techs.includes(advTechTilePos);

      tile.draw(data.advTechTiles[advTechTilePos].tile, data.advTechTiles[advTechTilePos].numTiles, highlighted);
    }
  }

  updateInfo(data: Data) {
    const players = data.players.filter(pl => pl.faction);

    for (const tile of this.tilesList()) {
      tile.factions = players.filter(pl => pl.data.research[tile.field] === tile.level).map(pl => pl.faction);
    }
  }

  tilesList() : ResearchTile[] {
    return [].concat(...Object.values(this.researchTiles));
  }
}