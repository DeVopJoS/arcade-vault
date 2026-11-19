export const W = 800;
export const H = 600;

export interface Point {
  x: number;
  y: number;
}

export const wrap = (v: number, max: number): number => ((v % max) + max) % max;

export const dist = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const rand = (min: number, max: number): number =>
  min + Math.random() * (max - min);

export const randInt = (min: number, max: number): number =>
  Math.floor(rand(min, max + 1));
