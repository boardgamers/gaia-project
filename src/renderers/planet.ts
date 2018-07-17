import planetData from "../data/planets";
import { Planet } from "@gaia-project/engine";

export default class PlanetRenderer extends PIXI.Graphics {
  constructor(planet: Planet, scale: number, border: number) {
    super();

    if (planet && planet !== Planet.Empty && planetData[planet]) {
      const planetInfo = planetData[planet];

      this.beginFill(planetInfo.color);
      this.lineStyle(border, planetInfo.borderColor);
      this.drawCircle(0, 0, planetInfo.radius * scale);
      this.endFill();
    }
  }
}