import {
  BLOCK_H,
  BLOCK_W,
  BLOCKS_ORIGIN_X,
  BLOCKS_ORIGIN_Y,
  type BlockColor,
  type Level,
} from "./levels";
import { BALL_SIZE, PADDLE_H, PADDLE_W, PADDLE_Y, WIDTH } from "./utils";

export const EXPLOSION_DURATION = 150; // ms

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Paddle = Rect;

export interface Ball extends Rect {
  vx: number;
  vy: number;
}

export interface Block extends Rect {
  color: BlockColor;
  alive: boolean;
}

export interface Explosion extends Rect {
  color: BlockColor;
  elapsed: number; // ms
}

export function createPaddle(): Paddle {
  return { x: (WIDTH - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
}

export function createBall(): Ball {
  return { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 };
}

export function createBlocks(level: Level): Block[] {
  return level.blocks.map((b) => ({
    x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
    y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
    w: BLOCK_W,
    h: BLOCK_H,
    color: b.color,
    alive: true,
  }));
}

/** Colisión AABB entre dos rectángulos. */
export function collideAABB(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
