import { FRUITS, type FruitName, type SpriteRect } from "./sprites";
import {
  CELL,
  COLS,
  DIR_VECTORS,
  HEIGHT,
  ROWS,
  WIDTH,
  clamp,
  easeOutBack,
  easeOutCubic,
  isOpposite,
  lerp,
  withAlpha,
  type Direction,
} from "./utils";

export interface Cell {
  x: number;
  y: number;
}

export interface Snake {
  /** Cabeza primero. */
  segments: Cell[];
  /** Posiciones previas (mismo largo que `segments`) para interpolar entre pasos. */
  prev: Cell[];
  /** Última dirección aplicada en un paso. */
  dir: Direction;
  /** Giro en buffer (máx. 1 por paso). */
  queued: Direction | null;
  /** Segmentos pendientes de crecer. */
  grow: number;
}

export interface Fruit {
  cell: Cell;
  kind: FruitName;
  /** ms desde que apareció (animación de aparición y flotado). */
  age: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number; // px/s
  vy: number;
  life: number; // ms restantes
  maxLife: number;
}

export interface EatEffect {
  x: number; // centro, px
  y: number;
  kind: FruitName;
  age: number; // ms
}

export type Collision = "wall" | "self" | null;

export const FRUIT_NAMES = Object.keys(FRUITS) as FruitName[];

export const SPAWN_MS = 180;
export const EAT_MS = 250;
export const PULSE_MS = 160;
export const DEATH_MS = 450;
export const FLOAT_PERIOD_MS = 1200;
export const FLOAT_AMPLITUDE = 3;
const FRUIT_H = 34;
const FRUIT_MAX_W = 40;
const PARTICLE_COUNT = 6;
const PARTICLE_LIFE = 400;
const FALLBACK_COLOR = "#ff006e"; // magenta

// ── Estado y lógica pura ────────────────────────────────────────────────────

export function createSnake(): Snake {
  const y = Math.floor(ROWS / 2);
  const segments: Cell[] = [
    { x: 5, y },
    { x: 4, y },
    { x: 3, y },
  ];
  return {
    segments,
    prev: segments.map((c) => ({ ...c })),
    dir: "right",
    queued: null,
    grow: 0,
  };
}

/**
 * Encola un giro (1 por paso). Se ignora si es igual o contrario a la última
 * dirección aplicada, o si ya hay uno en el buffer.
 */
export function queueTurn(snake: Snake, dir: Direction): void {
  if (snake.queued) return;
  if (dir === snake.dir || isOpposite(dir, snake.dir)) return;
  snake.queued = dir;
}

/**
 * Avanza un paso. En colisión la serpiente no se mueve (solo consume el giro).
 * `ate` indica si la cabeza cayó en `fruitCell`.
 */
export function stepSnake(
  snake: Snake,
  fruitCell: Cell | null,
): { collision: Collision; ate: boolean } {
  const dir = snake.queued ?? snake.dir;
  snake.queued = null;
  snake.dir = dir;
  const v = DIR_VECTORS[dir];
  const head = snake.segments[0];
  const next: Cell = { x: head.x + v.dx, y: head.y + v.dy };

  if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
    return { collision: "wall", ate: false };
  }

  const ate = !!fruitCell && next.x === fruitCell.x && next.y === fruitCell.y;
  const growing = ate || snake.grow > 0;

  // Si no crece, la cola se libera en este paso: no cuenta como colisión.
  const bodyLimit = growing ? snake.segments.length : snake.segments.length - 1;
  for (let i = 0; i < bodyLimit; i++) {
    const s = snake.segments[i];
    if (s.x === next.x && s.y === next.y) {
      return { collision: "self", ate: false };
    }
  }

  const old = snake.segments;
  // prev[i] = posición anterior del segmento i (la cabeza nueva parte de la vieja).
  snake.prev = old.map((c) => ({ ...c }));
  snake.segments = [next, ...old];
  if (growing) {
    // El segmento nuevo (cola) nace en la cola vieja.
    snake.prev.push({ ...old[old.length - 1] });
    if (snake.grow > 0) snake.grow--;
  } else {
    snake.segments.pop();
  }
  return { collision: null, ate };
}

/** Celda aleatoria libre (no sobre la serpiente) o null si el tablero está lleno. */
export function pickFreeCell(segments: Cell[], rng: () => number): Cell | null {
  const taken = new Set(segments.map((c) => c.y * COLS + c.x));
  const free: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!taken.has(y * COLS + x)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rng() * free.length)];
}

export function spawnFruit(segments: Cell[], rng: () => number): Fruit | null {
  const cell = pickFreeCell(segments, rng);
  if (!cell) return null;
  const kind = FRUIT_NAMES[Math.floor(rng() * FRUIT_NAMES.length)];
  return { cell, kind, age: 0 };
}

export function cellCenter(cell: Cell): { x: number; y: number } {
  return { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 };
}

export function createBurst(
  x: number,
  y: number,
  rng: () => number,
): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const a = (Math.PI * 2 * i) / PARTICLE_COUNT + rng() * 0.5;
    const speed = 90 + rng() * 80;
    out.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: PARTICLE_LIFE,
      maxLife: PARTICLE_LIFE,
    });
  }
  return out;
}

/** Actualiza partículas in-place (dt en ms) y devuelve solo las vivas. */
export function updateParticles(particles: Particle[], dt: number): Particle[] {
  const s = dt / 1000;
  const alive: Particle[] = [];
  for (const p of particles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * s;
    p.y += p.vy * s;
    alive.push(p);
  }
  return alive;
}

// ── Dibujo ──────────────────────────────────────────────────────────────────

export function drawGrid(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.save();
  ctx.strokeStyle = withAlpha(color, 0.06);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x++) {
    ctx.moveTo(x * CELL + 0.5, 0);
    ctx.lineTo(x * CELL + 0.5, HEIGHT);
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.moveTo(0, y * CELL + 0.5);
    ctx.lineTo(WIDTH, y * CELL + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function fitSprite(rect: SpriteRect): { w: number; h: number } {
  const ratio = rect.w / rect.h;
  let h = FRUIT_H;
  let w = h * ratio;
  if (w > FRUIT_MAX_W) {
    w = FRUIT_MAX_W;
    h = w / ratio;
  }
  return { w, h };
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  kind: FruitName,
  cx: number,
  cy: number,
  scale: number,
  alpha: number,
): void {
  if (scale <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (img && img.complete && img.naturalWidth > 0) {
    const r = FRUITS[kind];
    const { w, h } = fitSprite(r);
    ctx.imageSmoothingEnabled = true;
    ctx.shadowColor = "rgba(255, 255, 255, 0.55)";
    ctx.shadowBlur = 10;
    ctx.drawImage(img, r.x, r.y, r.w, r.h, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = withAlpha(FALLBACK_COLOR, 0.35);
    ctx.strokeStyle = FALLBACK_COLOR;
    ctx.lineWidth = 2;
    ctx.shadowColor = FALLBACK_COLOR;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Fruta con aparición (escala 0→1, ease-out-back) y flotado senoidal. */
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  fruit: Fruit,
): void {
  const { x, y } = cellCenter(fruit.cell);
  const scale = easeOutBack(fruit.age / SPAWN_MS);
  const bob =
    Math.sin((fruit.age / FLOAT_PERIOD_MS) * Math.PI * 2) * FLOAT_AMPLITUDE;
  drawSprite(ctx, img, fruit.kind, x, y + bob, scale, 1);
}

/** Fruta comida: se encoge y sube mientras se desvanece (250 ms). */
export function drawEatEffect(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  fx: EatEffect,
): void {
  const t = clamp(fx.age / EAT_MS, 0, 1);
  const e = easeOutCubic(t);
  drawSprite(ctx, img, fx.kind, fx.x, fx.y - 18 * e, 1 - e, 1 - t);
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  color: string,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  for (const p of particles) {
    const k = p.life / p.maxLife;
    ctx.fillStyle = withAlpha(color, k);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1 + 2.5 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  dir: Direction,
  size: number,
): void {
  const v = DIR_VECTORS[dir];
  const fwd = size * 0.18;
  const side = size * 0.22;
  const r = size * 0.09;
  ctx.fillStyle = "#fff";
  ctx.shadowBlur = 0;
  for (const s of [-1, 1]) {
    const ex = v.dx * fwd + -v.dy * side * s;
    const ey = v.dy * fwd + v.dx * side * s;
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Serpiente neón. `progress` (0–1) interpola entre `prev` y `segments`;
 * `pulse` (0–1, 1 = recién comió) agranda la cabeza hasta 1.15;
 * `visible=false` oculta el cuerpo (parpadeo de muerte).
 */
export function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: Snake,
  color: string,
  progress: number,
  pulse: number,
  visible: boolean,
): void {
  if (!visible) return;
  const size = CELL - 6;
  const p = clamp(progress, 0, 1);
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = withAlpha(color, 0.25);
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.lineJoin = "round";

  for (let i = snake.segments.length - 1; i >= 0; i--) {
    const cur = snake.segments[i];
    const prv = snake.prev[i] ?? cur;
    const cx = lerp(prv.x, cur.x, p) * CELL + CELL / 2;
    const cy = lerp(prv.y, cur.y, p) * CELL + CELL / 2;
    const isHead = i === 0;
    const s = size * (isHead ? 1 + 0.15 * clamp(pulse, 0, 1) : 1);
    ctx.beginPath();
    ctx.roundRect(cx - s / 2, cy - s / 2, s, s, 8);
    ctx.fill();
    ctx.stroke();
    if (isHead) {
      ctx.save();
      ctx.translate(cx, cy);
      drawEyes(ctx, snake.dir, s);
      ctx.restore();
    }
  }
  ctx.restore();
}
