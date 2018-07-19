// import { ScoringTile as ScoringTileEnum, tiles, Event } from "@gaia-project/engine";
// import { eventDesc } from "../data/event";

// export default class ScoringTile extends PIXI.Graphics {
//   titleText: PIXI.Text;
//   content: PIXI.Text;

//   constructor(public round: number) {
//     super();

//     this.interactive = true;

//     this.on("mouseout", () => {
//       this.emit("tooltip-remove", this);
//     });

//     this.titleText = new PIXI.Text('', {fontSize: 10});
//     this.titleText.position.set(4, 2);
//     this.addChild(this.titleText);

//     this.content = new PIXI.Text('', {fontSize: 12});
//     this.content.position.set(4, 20);
//     this.addChild(this.content);
//   }

//   draw(which: ScoringTileEnum, highlighted = false) {
//     this.clear();
    
//     this.lineStyle(1, highlighted ? 0x22CC44 : 0x444444);
//     this.beginFill(highlighted ? 0xFFFFFF : 0xEEEEEE);
//     this.drawRect(0, 0, 75, 40);
//     this.endFill();

//     this.titleText.text = 'Round ' + (this.round+1);

//     const events = tiles.roundscorings[which];
//     this.content.text = events.join(" / ");

//     this.emit("tooltip-remove", this);
//     this.off("mouseover");
//     this.on("mouseover", () => {
//       this.emit("tooltip", this, eventDesc(new Event(events[0])));
//     });
//   }
// }