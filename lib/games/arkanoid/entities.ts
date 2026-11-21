import {
  BLOCK_H,
  BLOCK_HEX,
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

// ---------- Dibujo neón ----------

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  b: Rect,
  color: BlockColor,
): void {
  const hex = BLOCK_HEX[color];
  ctx.save();
  ctx.shadowColor = hex;
  ctx.shadowBlur = 10;
  ctx.fillStyle = hexAlpha(hex, 0.25);
  ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  ctx.strokeStyle = hex;
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
  ctx.restore();
}

/** Explosión: el bloque se encoge y se desvanece con un destello (4 pasos como el original). */
export function drawExplosion(
  ctx: CanvasRenderingContext2D,
  e: Explosion,
): void {
  const t = Math.min(e.elapsed / EXPLOSION_DURATION, 1);
  const step = Math.min(Math.floor(t * 4), 3);
  const grow = 2 + step * 3;
  const hex = BLOCK_HEX[e.color];
  ctx.save();
  ctx.globalAlpha = 1 - t * 0.85;
  ctx.shadowColor = hex;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = hex;
  ctx.fillStyle = step === 0 ? "#ffffff" : hexAlpha(hex, 0.35);
  ctx.lineWidth = 2;
  ctx.fillRect(e.x - grow, e.y - grow, e.w + grow * 2, e.h + grow * 2);
  ctx.strokeRect(e.x - grow, e.y - grow, e.w + grow * 2, e.h + grow * 2);
  ctx.restore();
}

export function drawPaddle(
  ctx: CanvasRenderingContext2D,
  p: Paddle,
  color: string,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = hexAlpha(color, 0.35);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, p.h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  b: Ball,
  color: string,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** `#rrggbb` → `rgba(r,g,b,a)`. Si no es hex de 6 dígitos devuelve el color tal cual. */
export function hexAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
