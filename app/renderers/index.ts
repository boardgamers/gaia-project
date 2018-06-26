import MapRenderer from "./map";
import ResearchRenderer from "./research";
import { CubeCoordinates } from "hexagrid";
import { center } from "../graphics/reposition";
import { ResearchField } from "@gaia-project/engine";

interface Highlight {
  hexes?: Array<{coord: CubeCoordinates, qic: boolean}>,
  fields?: Array<{field: ResearchField, level: number}>
};

export default class Renderer {
  app: PIXI.Application;

  data: any;
  highlighted: Highlight;

  map: MapRenderer;
  research: ResearchRenderer;

  constructor(view: HTMLCanvasElement) {
    this.app = new PIXI.Application({transparent: true, antialias: true, view});
    this.app.renderer.resize(view.offsetWidth, view.offsetHeight);
    this.app.renderer.autoResize = true;

    this.map = new MapRenderer();
    this.research = new ResearchRenderer();

    this.app.stage.addChild(this.map);
    this.app.stage.addChild(this.research);

    $(window).on("resize", () => {
      this.app.renderer.resize(view.offsetWidth, view.offsetHeight);
      this.rerender();
    });
  }

  render(data: any, highlighted?: Highlight) {
    this.data = data;
    this.highlighted = highlighted;

    this.rerender();
  }

  rerender() {
    this.map.render(this.data.map, this.data.players.map(pl => pl.faction), (this.highlighted||{}).hexes);
    this.research.render(this.data.players, (this.highlighted||{}).fields);

    const bounds = this.map.getLocalBounds();

    this.research.x = bounds.x + bounds.width + 80;
    this.research.y = bounds.y;

    center(this.app.stage, this.app.screen);
  }
}