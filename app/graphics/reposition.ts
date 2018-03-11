import {Rectangle} from "./types";

export function center(object: PIXI.DisplayObject, rectangle: Rectangle) {
  const bounds = object.getBounds();

  object.position.x = (rectangle.width - bounds.width)/2 + rectangle.x;
  object.position.y = (rectangle.height - bounds.height)/2 + rectangle.y;
}