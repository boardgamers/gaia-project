import { CubeCoordinatesPartial } from "hexagrid/src/cubecoordinates";

const vSpacing = Math.sqrt(3) / 2;

export function hexCenter (hex: CubeCoordinatesPartial, radius = 1) {
  return {
    x: hex.r * 1.5 * radius,
    y: -(2 * hex.q + hex.r) * vSpacing * radius
  };
}

export function corners (radius = 1) {
  return [
    { x: -radius, y: 0 },
    { x: -radius / 2, y: -vSpacing * radius },
    { x: radius / 2, y: -vSpacing * radius },
    { x: radius, y: 0 },
    { x: radius / 2, y: vSpacing * radius },
    { x: -radius / 2, y: vSpacing * radius }
  ];
}
