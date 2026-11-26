// Ranaria — constantes, tipos y helpers puros.
// Resolución lógica fija 640×560 (16×14 celdas de 40 px, aspect 8:7).

export const COLS = 16;
export const ROWS = 14;
export const CELL = 40;
export const WIDTH = COLS * CELL; // 640
export const HEIGHT = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;

/** Columna izquierda de cada boca destino (cada boca ocupa 2 columnas). */
export const GOAL_COLS: readonly number[] = [1, 4, 7, 10, 13];
export const GOAL_WIDTH = 2;

/** Columna de inicio (centrada: celdas 7–8 son el centro de 16). */
export const START_COL = 7;

export const START_LIVES = 3;

export const JUMP_MS = 120;
export const DEATH_MS = 600;
export const MAX_DT = 50; // ms por frame

export const TURTLE_UP_MS = 3000;
export const TURTLE_DOWN_MS = 1500;
export const TURTLE_CYCLE_MS = TURTLE_UP_MS + TURTLE_DOWN_MS;
/** Último tramo de la fase visible en que la tortuga avisa que se va a hundir. */
export const TURTLE_WARN_MS = 600;

export const ROW_SCORE = 10;
export const GOAL_SCORE = 50;
export const TIME_BONUS_PER_SEC = 10;
export const ROUND_SCORE = 200;

/** Altura de la barra de tiempo (px) en el borde superior de la fila 0. */
export const TIME_BAR_H = 6;

/** Segundos por trayecto: 15 − (nivel − 1), mínimo 8. */
export function timeLimitFor(level: number): number {
  return Math.max(8, 15 - (level - 1));
}

/** Multiplicador de velocidad: ×1.15 por nivel. */
export function speedFactorFor(level: number): number {
  return 1.15 ** (level - 1);
}

export type Direction = "up" | "down" | "left" | "right";

export const DIR_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export type LaneKind = "road" | "river";
export type EntityType = "car" | "truck" | "log" | "turtle";

export interface Entity {
  /** Columna izquierda (fraccionaria). */
  col: number;
  /** Ancho en celdas. */
  width: number;
  type: EntityType;
  /** Variante visual (p. ej. color del coche); la interpreta la skin. */
  variant: number;
  /** Solo tortugas: ms dentro de su ciclo de inmersión. */
  phase?: number;
}

export interface Lane {
  row: number;
  kind: LaneKind;
  /** Velocidad en px/frame a 60 fps (ya escalada por nivel). */
  speed: number;
  dir: 1 | -1;
  /** Longitud del loop en celdas (≥ COLS + ancho máximo). */
  span: number;
  entities: Entity[];
}

export interface Frog {
  col: number;
  row: number;
  animating: boolean;
  /** ms transcurridos del salto actual. */
  animT: number;
  fromCol: number;
  fromRow: number;
  targetCol: number;
  targetRow: number;
  facing: Direction;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function isRiverRow(row: number): boolean {
  return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
}

export function isRoadRow(row: number): boolean {
  return row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
}

/** Tortuga sumergida (sin apoyo) según su fase. */
export function isSubmerged(e: Entity): boolean {
  return e.type === "turtle" && (e.phase ?? 0) >= TURTLE_UP_MS;
}

/**
 * Nivel de inmersión 0–1 para el render: 0 = a flote, 1 = bajo el agua.
 * Sube durante el aviso y baja al emerger.
 */
export function submergeLevel(e: Entity): number {
  if (e.type !== "turtle") return 0;
  const p = e.phase ?? 0;
  if (p >= TURTLE_UP_MS) return 1;
  const warnStart = TURTLE_UP_MS - TURTLE_WARN_MS;
  if (p >= warnStart) return ((p - warnStart) / TURTLE_WARN_MS) * 0.5;
  return 0;
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
