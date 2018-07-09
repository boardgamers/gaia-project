import MapRenderer from "./map";
import ResearchRenderer from "./research";
import { CubeCoordinates } from "hexagrid";
import { center } from "../graphics/reposition";
import { ResearchField, TechTilePos } from "@gaia-project/engine";

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

    this.research.on("tooltip", this.handleTooltip.bind(this));
    this.map.on("tooltip", this.handleTooltip.bind(this));
    this.research.on("tooltip-remove", this.removeTooltip.bind(this));
    this.map.on("tooltip-remove", this.removeTooltip.bind(this));
  }

  render(data: any, highlighted?: Highlight) {
    this.data = data;
    this.highlighted = highlighted;

    this.rerender();
  }

  rerender() {
    this.map.render(this.data.map, this.data.players.map(pl => pl.faction), (this.highlighted||{}).hexes);
    this.research.render(this.data, this.highlighted);

    const bounds = this.map.getLocalBounds();

    this.research.x = bounds.x + bounds.width + 80;
    this.research.y = bounds.y;

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

    if (elemPos.x < this.app.view.width/2) {
      $tooltip.addClass("bs-tooltip-right");
      $tooltip.removeClass("bs-tooltip-left");

      $tooltip.css({
        top: $(this.app.view).offset().top + middleY - $tooltip.height()/2,
        left: $(this.app.view).offset().left + elemPos.x + elemBounds.right,
      });
    } else {
      $tooltip.removeClass("bs-tooltip-right");
      $tooltip.addClass("bs-tooltip-left");

      $tooltip.css({
        top: $(this.app.view).offset().top + middleY - $tooltip.height()/2,
        left: $(this.app.view).offset().left + elemPos.x - $tooltip.width() - 2*tooltipArrowHeight,
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