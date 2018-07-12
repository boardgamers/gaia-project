import { ScoringTile as ScoringTileEnum, tiles, Event } from "@gaia-project/engine";
import { eventDesc } from "../data/event";
import { roundScorings } from "@gaia-project/engine/src/tiles/scoring";

export default class ScoringTile extends PIXI.Graphics {
  titleText: PIXI.Text;
  content: PIXI.Text;

  constructor(public round: number) {
    super();

    this.interactive = true;

    this.on("mouseout", () => {
      this.emit("tooltip-remove", this);
    });

    this.titleText = new PIXI.Text('Round ' + (round+1), {fontSize: 10});
    this.titleText.position.set(4, 2);
    this.addChild(this.titleText);

    this.content = new PIXI.Text('', {fontSize: 12});
    this.content.position.set(4, 20);
    this.addChild(this.content);
  }

  draw(which: ScoringTileEnum, highlighted = false) {
    this.clear();
    
    this.lineStyle(1, highlighted ? 0x22CC44 : 0x444444);
    this.beginFill(highlighted ? 0xFFFFFF : 0xEEEEEE);
    this.drawRect(0, 0, 60, 40);
    this.endFill();

    const events = roundScorings[which];
    this.content.text = events.join(" / ").replace(/\s/g, '');

    this.emit("tooltip-remove", this);
    this.off("mouseover");
    this.on("mouseover", () => {
      this.emit("tooltip", this, eventDesc(new Event(events[0])));
    });
  }
}