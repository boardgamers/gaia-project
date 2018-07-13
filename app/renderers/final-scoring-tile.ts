import { FinalTile, tiles, Event, Player, factions } from "@gaia-project/engine";
import { eventDesc } from "../data/event";
import Token from "./token";
import { AugmentedPlayer } from "../data";

export default class FinalScoringTile extends PIXI.Graphics {
  titleText: PIXI.Text;

  constructor() {
    super();

    this.interactive = true;

    this.on("mouseout", () => {
      this.emit("tooltip-remove", this);
    });

    this.titleText = new PIXI.Text('', {fontSize: 10});
    this.titleText.position.set(4, 2);
    this.addChild(this.titleText);
  }

  draw(which: FinalTile, players: AugmentedPlayer[], highlighted = false) {
    this.clear();
    
    this.lineStyle(1, highlighted ? 0x22CC44 : 0x444444);
    this.beginFill(highlighted ? 0xFFFFFF : 0xEEEEEE);
    this.drawRect(0, 0, 75, 40);
    this.endFill();

    this.titleText.text = which;

    const order = [...players].sort((pl1, pl2) => pl1.progress[which] - pl2.progress[which]);

    order.forEach((player, i) => {
      Token.draw(player.faction, 16 + i * 10, 27, this, 4);
    });

    const tooltips: string[] = order.map(pl => `- ${factions[pl.faction].name}: ${pl.progress[which]}`);

    this.emit("tooltip-remove", this);
    this.off("mouseover");
    this.on("mouseover", () => {
      this.emit("tooltip", this, tooltips.join('<br>'));
    });
  }
}