import { TechTile as TechTileEnum, TechTilePos, tiles, AdvTechTile, Event } from "@gaia-project/engine";
import { eventDesc } from "../data/event";

export default class TechTile extends PIXI.Graphics {
  titleText: PIXI.Text;
  content: PIXI.Text;

  constructor(public pos: TechTilePos) {
    super();

    this.interactive = true;

    this.on("mouseout", () => {
      this.emit("tooltip-remove", this);
    });

    this.titleText = new PIXI.Text('', {fontSize: 10});
    this.titleText.position.set(4, 2);
    this.addChild(this.titleText);

    this.content = new PIXI.Text('', {fontSize: 12});
    this.content.position.set(4, 17);
    this.addChild(this.content);
  }

  draw(which: TechTileEnum | AdvTechTile, number: number, highlighted = false) {
    this.clear();

    if (number === 0) {
      return;
    }
    
    this.lineStyle(2, highlighted ? 0x22CC44 : 0xAAAAAA);
    this.beginFill(0xFFFFFF);
    this.drawPolygon([].concat([0, 0], [47, 0], [57, 10], [57, 35], [0, 35], [0, 0]));
    this.endFill();
    
    this.titleText.text = number > 1 ? `${this.pos} (${number})` : this.pos;
    
    const events = tiles.techs[which] || tiles.advancedTechs[which];
    // The tile with 'mg' has text too long
    this.content.text = events[0].indexOf("mg") === -1 ? events[0] : events[0].replace(/\s/g, '');

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