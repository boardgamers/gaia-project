import { TechTile as TechTileEnum, TechTilePos, tiles, AdvTechTile, Event } from "@gaia-project/engine";
import { eventDesc } from "../data/event";

export default class TechTile extends PIXI.Graphics {
  constructor(public pos: TechTilePos) {
    super();

    this.interactive = true;

    this.on("mouseout", () => {
      this.emit("tooltip-remove", this);
    });
  }

  draw(which: TechTileEnum | AdvTechTile, number: number, highlighted = false) {
    this.clear();
    this.removeChildren();

    if (number === 0) {
      return;
    }
    
    this.lineStyle(2, highlighted ? 0x22CC44 : 0xCCCCCC);
    this.beginFill(0xFFFFFF);
    this.drawPolygon([].concat([0, 0], [47, 0], [57, 10], [57, 35], [0, 35], [0, 0]));
    this.endFill();
    
    const titleText = number > 1 ? `${this.pos} (${number})` : this.pos;
    const text = new PIXI.Text(titleText, {fontSize: 10});
    [text.x, text.y] = [4, 2];
    this.addChild(text);

    const events = tiles.techs[which] || tiles.advancedTechs[which];
    const content = new PIXI.Text(events.join(" / ").replace(/\s/g, ''), {fontSize: 12});
    [content.x, content.y] = [4, 17];
    this.addChild(content);

    if (highlighted) {
      this.cursor = "pointer";
      this.on("click", () => this.emit("techClick", this.pos));
    } else {
      this.cursor = this.defaultCursor;
      this.off("click");
    }

    this.emit("tooltip-remove", this);
    this.off("mouseover");
    this.on("mouseover", () => {
      this.emit("tooltip", this, eventDesc(new Event(events[0])));
    });
  }
}