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

    players = players.filter(player => !!player && player.faction);

    const min = Math.min(...players.map(pl => pl.progress[which]), 0);
    const max = Math.max(...players.map(pl => pl.progress[which]), which == FinalTile.PlanetType ? 9 : 10);

    players.forEach((player, i) => {
      const progress = player.progress[which];
      Token.draw(player.faction, 10 + (progress - min) * 55 / (max - min), 19 + (14 / (players.length-1)) * i, this, 3);
    });

    const tooltips: string[] = players.map(pl => `- ${factions[pl.faction].name}: ${pl.progress[which]}`);

    this.emit("tooltip-remove", this);
    this.off("mouseover");
    this.on("mouseover", () => {
      this.emit("tooltip", this, tooltips.join('<br>'));
    });
  }
}