type Partial<T> = {
  [P in keyof T]?: T[P];
};

type HexOrientation = "flat" | "pointy";
type Direction = "N" | "S" | "W" | "E" | "NW" | "NE" | "SW" | "SE";

type PointConstructorArgument = number[] | Partial<Coordinates>;

interface ExtendHexParams {
  size?: number;
  orientation?: HexOrientation;
  origin?: PointConstructorArgument;
}

interface BaseHexParams {
  x?: number;
  y?: number;
  size?: number;
  orientation?: HexOrientation;
}

type HexParams<T> = BaseHexParams & Partial<T>;

export namespace Types {
  export interface Point {
      x: number;
      y: number;
  
      add(p: Point): Point;
      substract(p: Point): Point;
      multiple(p: Point): Point;
      divide(p: Point): Point;
  }

  export class Grid<T={}> extends Array<Hex<T>> {
      includes(p: HexParams<T>): boolean;
      concat(...grids: Grid<T>[]): Grid<T>; 
  
      static isValidHex(val: any): boolean;
  
      get(key: number) : Hex<T>;
      get(key: HexParams<T>);
      set(key: number, hex: Hex<T>);
      set(key: HexParams<T>, hex: Hex<T>);
  
      hexesBetween(hex1: HexParams<T>, hex2: HexParams<T>): Hex<T>[];
      neighborsOf(hex: HexParams<T>, which: number | Direction | Array<number|Direction>);
  }

  class BaseHex<T> {
      // Cartesian coordinates
      x: number;
      y: number;
      // Cubic coordinates
      q: number;
      r: number;
      s: number;
      // Radius
      size: number;
      origin: Point;
      orientation: HexOrientation;
  
      // Methods
      set(hex: Partial<Hex<T>>): void;
      coordinates() : Coordinates;
      cube(): CubeCoordinates;
      cubeToCartesian(cube: CubeCoordinates): Coordinates;
      cartesianToCube(coordinates: Coordinates): CubeCoordinates;
      isPointy(): boolean;
      isFlat(): boolean;
      oppositeCornerDistance(): number;
      oppositeSideDistance(): number;
      width(): number;
      height(): number;
      corners(): [Point, Point, Point, Point, Point, Point];
      center(): Point;
      toPoint(): Point;
      add(hex: Hex<T>): Hex<T>;
      add(point: Point): Hex<T>;
      add(p: PointConstructorArgument): Hex<T>;
      substract(hex: Hex<T>): Hex<T>;
      substract(point: Point): Hex<T>;
      substract(p: PointConstructorArgument): Hex<T>;
      equals(hex: Hex<T>): Hex<T>;
      equals(point: Point): Hex<T>;
      equals(p: PointConstructorArgument): Hex<T>;
      distance(hex: Hex<T>): number;
      round(): Hex<T>;
      lerp(hex: Hex<T>, t: number): Hex<T>;
      nudge(): Hex<T>;
      toString(): string;
  
      // statics
      static thirdCoordinate(x: number, y: number): number;
  }

  export interface Coordinates {
    x: number;
    y: number;
  }
  
  export interface CubeCoordinates {
    q: number;
    r: number;
    s: number;
  }  

  export type Hex<T> = BaseHex<T> & T; 
}

import Point = Types.Point;
import Grid = Types.Grid;
import Hex = Types.Hex;
import Coordinates = Types.Coordinates;
import CubeCoordinates = Types.CubeCoordinates;

type HexConstructor1<T> = (x?: number, y?: number) => Hex<T>;
type HexConstructor2<T> = (params: HexParams<T>) => Hex<T>;
type HexConstructor<T> = HexConstructor1<T> & HexConstructor2<T>;

export function extendHex<T={}>(prototype?: ExtendHexParams & T): HexConstructor<T>;

declare interface GridMaker<T={}> {
  hexagon(params: {radius: number, center?: HexParams<T>}): Grid<T>;
  rectangle(width: number, height: number, start?: HexParams<T>, direction?: Direction): Grid<T>;
  parallelogram(width: number, height: number, start?: HexParams<T>, direction?: Direction): Grid<T>;
  triangle(size: number, start?: HexParams<T>, direction?: 1|5): Grid<T>;
}

type GridConstructor<T={}> = (...args: HexParams<T>[]) => Grid<T>;

export function defineGrid<T={}>(extendHex: HexConstructor<T>): GridMaker<T> & GridConstructor<T>;

declare function PointConstructor(coordinates: Partial<Coordinates>) : Point;
declare function PointConstructor(arr: number[]) : Point;
declare function PointConstructor(x?: number, y?: number) : Point;

export {PointConstructor as Point};
