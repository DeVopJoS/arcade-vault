// Resolución lógica fija 800×600 (4:3, igual que .crt-screen).
export const WIDTH = 800;
export const HEIGHT = 600;

export const CELL = 40;
export const COLS = WIDTH / CELL; // 20
export const ROWS = HEIGHT / CELL; // 15

export const FRUIT_SCORE = 10;
export const FRUITS_PER_LEVEL = 5;

export const BASE_STEP_MS = 140;
export const STEP_DECREASE_MS = 4;
export const MIN_STEP_MS = 70;
export const MAX_DT = 50; // ms por frame
export const MAX_STEPS_PER_FRAME = 3;

export const SWIPE_THRESHOLD = 24; // px de pantalla

export type Direction = "up" | "down" | "left" | "right";

export const DIR_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const OPPOSITES: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function isOpposite(a: Direction, b: Direction): boolean {
  return OPPOSITES[a] === b;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutCubic(t: number): number {
  const u = 1 - clamp(t, 0, 1);
  return 1 - u * u * u;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = clamp(t, 0, 1) - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

/** Nivel = 1 + floor(frutas / 5). */
export function levelFor(fruitsEaten: number): number {
  return 1 + Math.floor(fruitsEaten / FRUITS_PER_LEVEL);
}

/** Intervalo de paso: 140 ms − 4 ms por fruta, mínimo 70 ms. */
export function stepIntervalFor(fruitsEaten: number): number {
  return Math.max(MIN_STEP_MS, BASE_STEP_MS - STEP_DECREASE_MS * fruitsEaten);
}

/** Dirección de un swipe (dx, dy en px de pantalla), o null si no supera el umbral. */
export function swipeToDirection(dx: number, dy: number): Direction | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** Convierte "#rrggbb" / "#rgb" a rgba(). Si no es hex, devuelve el color tal cual. */
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
