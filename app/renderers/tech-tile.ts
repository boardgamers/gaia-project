import { TechTile as TechTileEnum, TechTilePos, tiles, AdvTechTile } from "@gaia-project/engine";

export default class TechTile extends PIXI.Graphics {
  constructor(public pos: TechTilePos) {
    super();
  }

  draw(which: TechTileEnum | AdvTechTile, number: number) {
    this.clear();
    this.removeChildren();
    
    this.lineStyle(2, 0xCCCCCC);
    this.beginFill(0xFFFFFF);
    this.drawRect(0, 0, 60, 35);
    this.endFill();
    
    const text = new PIXI.Text(`${this.pos} (${number})`, {fontSize: 10});
    [text.x, text.y] = [4, 2];
    this.addChild(text);

    const events = tiles.techs[which] || tiles.advancedTechs[which];
    const content = new PIXI.Text(events.join(" / ").replace(/\s/g, ''), {fontSize: 12});
    [content.x, content.y] = [4, 17];
    this.addChild(content);
  }
}