import {Rectangle} from "./types";

// This may not work with an object several level below the rectangle, in which
// case use of getBounds(), getGlobalPosition() may be needed
export function center(object: PIXI.DisplayObject, rectangle: Rectangle) {
  const bounds = object.getLocalBounds();

  object.position.x = (rectangle.width - bounds.width)/2 + rectangle.x - bounds.x;
  object.position.y = (rectangle.height - bounds.height)/2 + rectangle.y - bounds.y;
}