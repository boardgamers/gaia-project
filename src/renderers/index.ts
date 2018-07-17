import MapRenderer from "./map";
import ResearchRenderer from "./research";
import { CubeCoordinates } from "hexagrid";
import { center } from "../graphics/reposition";
import { ResearchField, TechTilePos } from "@gaia-project/engine";
import ScoringRenderer from "./scoring";

const tooltipArrowHeight = 7;

interface Highlight {
  hexes?: Array<{coord: CubeCoordinates, qic: boolean}>,
  fields?: Array<{field: ResearchField, level: number}>,
  techs?: Array<TechTilePos>
};

export default class Renderer {
  currentTooltipElement: PIXI.Graphics = null;
  app: PIXI.Application;

  data: any;
  highlighted: Highlight;

  map: MapRenderer;
  research: ResearchRenderer;
  scoring: ScoringRenderer;

  constructor(view: HTMLCanvasElement) {
    this.app = new PIXI.Application({transparent: true, antialias: true, view});
    this.app.renderer.resize(view.offsetWidth, view.offsetHeight);
    this.app.renderer.autoResize = true;

    this.map = new MapRenderer();
    this.research = new ResearchRenderer();
    this.scoring = new ScoringRenderer();

    this.app.stage.addChild(this.map);
    this.app.stage.addChild(this.research);
    this.app.stage.addChild(this.scoring);

    $(window).on("resize", () => {
      this.app.renderer.resize(view.offsetWidth, view.offsetHeight);
      this.rerender();
    });

    for (const renderer of [this.research, this.map, this.scoring]) {
      renderer.on("tooltip", this.handleTooltip.bind(this));
      renderer.on("tooltip-remove", this.removeTooltip.bind(this));
    }
  }

  render(data: any, highlighted?: Highlight) {
    this.data = data;
    this.highlighted = highlighted;

    this.rerender();
  }

  rerender() {
    this.scoring.render(this.data);
    this.map.render(this.data.map, this.data.players.map(pl => pl.faction), (this.highlighted||{}).hexes);
    this.research.render(this.data, this.highlighted);

    const chain = (...renderers: PIXI.Graphics[]) => {
      renderers.slice(1).forEach((renderer, i) => {
        const prev = renderers[i];
        const prevBounds = prev.getLocalBounds();
        const bounds = renderer.getLocalBounds();

        renderer.x = prevBounds.x + prevBounds.width + 40 + prev.x - bounds.x;
        renderer.y = prevBounds.y + prev.y - bounds.y;
      });
    }

    // position the map, research board and scoring tiles side by side
    chain(this.map, this.research, this.scoring);

    center(this.app.stage, this.app.screen);
  }

  handleTooltip(elem: PIXI.Graphics, text: string) {
    const elemPos = elem.getGlobalPosition();
    const elemBounds = elem.getLocalBounds();
    const $tooltip = $(".tooltip");
    const $tooltipArrow = $tooltip.find(".arrow");
    const $tooltipInner = $tooltip.find(".tooltip-inner");

    const middleY = elemPos.y + (elemBounds.top + elemBounds.bottom) / 2;

    this.currentTooltipElement = elem;

    $tooltipInner.html(text);
    $tooltip.addClass('tooltip-show');

    const r = $("#map").width() / this.app.screen.width;

    if (elemPos.x < this.app.view.width/2) {
      $tooltip.addClass("bs-tooltip-right");
      $tooltip.removeClass("bs-tooltip-left");

      $tooltip.css({
        top: $(this.app.view).offset().top + middleY - $tooltip.height()/2,
        left: $(this.app.view).offset().left + (elemPos.x + elemBounds.right) * r,
      });
    } else {
      $tooltip.removeClass("bs-tooltip-right");
      $tooltip.addClass("bs-tooltip-left");

      $tooltip.css({
        top: $(this.app.view).offset().top + middleY - $tooltip.height()/2,
        left: $(this.app.view).offset().left - $tooltip.width() + (elemPos.x - 2*tooltipArrowHeight) * r,
      });
    }
  }

  removeTooltip(elem: PIXI.Graphics) {
    if (elem === this.currentTooltipElement) {
      $(".tooltip").removeClass("tooltip-show");
      this.currentTooltipElement = null;
    }
  }
}