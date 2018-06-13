import MapRenderer from "./map";
import ResearchRenderer from "./research";
import { CubeCoordinates } from "hexagrid";
import { center } from "../graphics/reposition";

export default class Renderer {
  app: PIXI.Application;

  data: any;
  zonesOfInterest: CubeCoordinates[];

  map: MapRenderer;
  research: ResearchRenderer;

  constructor(view: HTMLCanvasElement) {
    this.app = new PIXI.Application({transparent: true, antialias: true, view});
    this.app.renderer.resize(view.offsetWidth, view.offsetHeight);
    this.app.renderer.autoResize = true;

    this.map = new MapRenderer();
    this.research = new ResearchRenderer();

    this.app.stage.addChild(this.map.graphics);
    this.app.stage.addChild(this.research.graphics);

    $(window).on("resize", () => {
      this.app.renderer.resize(view.offsetWidth, view.offsetHeight);
      this.rerender();
    });
  }

  render(data: any, zonesOfInterest?: CubeCoordinates[]) {
    this.data = data;
    this.zonesOfInterest = zonesOfInterest;

    this.rerender();
  }

  rerender() {
    this.map.render(this.data.map, this.data.players.map(pl => pl.faction), this.zonesOfInterest);
    this.research.render(this.data.players);

    const bounds = this.map.graphics.getLocalBounds();

    this.research.graphics.x = bounds.x + bounds.width + 80;
    this.research.graphics.y = bounds.y;

    center(this.app.stage, this.app.screen);
  }
}