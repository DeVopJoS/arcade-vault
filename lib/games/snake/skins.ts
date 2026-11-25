// Skins de Serpentina (patrón estrategia, port de SKINS de
// references/started-games/03-tetris/game.js). Cada skin trae su paleta, su
// fondo y las funciones que dibujan cada entidad. El motor nunca pinta colores
// propios. Toda función deja el contexto limpio (save/restore).
import type { SpriteRect } from "./sprites";
import {
  CELL,
  COLS,
  DIR_VECTORS,
  HEIGHT,
  ROWS,
  traceGrid,
  WIDTH,
  withAlpha,
  type Direction,
} from "./utils";

export type SkinId = "clasico" | "neon" | "retro";

export interface SnakeSkinColors {
  body: string;
  head: string;
  eyes: string;
  grid: string;
  particle: string;
  /** Glow alrededor del sprite de fruta; null = sin glow. */
  fruitGlow: string | null;
  /** Fruta vectorial si el sprite no cargó. */
  fallback: string;
}

export interface SnakeSkin {
  name: string;
  colors: SnakeSkinColors;
  /** Fondo del tablero; null = transparente (se ve la pantalla CRT). */
  boardBg: string | null;
  drawGrid(ctx: CanvasRenderingContext2D): void;
  /** Segmento centrado en (cx, cy) de lado `size`. */
  drawSegment(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    isHead: boolean,
    alpha?: number,
  ): void;
  /** Ojos; el contexto ya está trasladado al centro de la cabeza. */
  drawEyes(
    ctx: CanvasRenderingContext2D,
    dir: Direction,
    size: number,
    alpha?: number,
  ): void;
  /**
   * Fruta; el contexto ya está trasladado/escalado al centro. `img` = hoja de
   * sprites cargada o null (fallback vectorial). `w`/`h` = tamaño destino.
   */
  drawFruit(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    rect: SpriteRect,
    w: number,
    h: number,
    alpha?: number,
  ): void;
  /** Partícula de la explosión al comer; `k` = vida restante 0–1. */
  drawParticle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    k: number,
  ): void;
}

function eyeOffsets(dir: Direction, size: number) {
  const v = DIR_VECTORS[dir];
  const fwd = size * 0.18;
  const side = size * 0.22;
  return [-1, 1].map((s) => ({
    x: v.dx * fwd + -v.dy * side * s,
    y: v.dy * fwd + v.dx * side * s,
  }));
}

// ── CLÁSICO: look original (neón verde, cuerpo translúcido, glow) ──────────

const clasico: SnakeSkin = {
  name: "CLÁSICO",
  colors: {
    body: "#00ff88",
    head: "#00ff88",
    eyes: "#fff",
    grid: "#00ff88",
    particle: "#00ff88",
    fruitGlow: "rgba(255, 255, 255, 0.55)",
    fallback: "#ff006e",
  },
  boardBg: null,
  drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = withAlpha(this.colors.grid, 0.06);
    ctx.lineWidth = 1;
    traceGrid(ctx);
    ctx.stroke();
    ctx.restore();
  },
  drawSegment(ctx, cx, cy, size, isHead, alpha = 1) {
    const color = isHead ? this.colors.head : this.colors.body;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.fillStyle = withAlpha(color, 0.25);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(cx - size / 2, cy - size / 2, size, size, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },
  drawEyes(ctx, dir, size, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.colors.eyes;
    ctx.shadowBlur = 0;
    for (const e of eyeOffsets(dir, size)) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  drawFruit(ctx, img, rect, w, h, alpha = 1) {
    drawSpriteOrFallback(ctx, this, img, rect, w, h, alpha, 10);
  },
  drawParticle(ctx, x, y, k) {
    ctx.save();
    ctx.shadowColor = this.colors.particle;
    ctx.shadowBlur = 8;
    ctx.fillStyle = withAlpha(this.colors.particle, k);
    ctx.beginPath();
    ctx.arc(x, y, 1 + 2.5 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};

// ── NEÓN: fondo negro, synthwave cian/magenta, relleno 0.55 + trazo + glow ──

const neon: SnakeSkin = {
  name: "NEÓN",
  colors: {
    body: "#00f5ff",
    head: "#ff006e",
    eyes: "#f5ff00",
    grid: "#ff006e",
    particle: "#f5ff00",
    fruitGlow: "#00f5ff",
    fallback: "#ff006e",
  },
  boardBg: "#000",
  drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = withAlpha(this.colors.grid, 0.16);
    ctx.lineWidth = 1;
    ctx.shadowColor = this.colors.grid;
    ctx.shadowBlur = 4;
    traceGrid(ctx);
    ctx.stroke();
    ctx.restore();
  },
  drawSegment(ctx, cx, cy, size, isHead, alpha = 1) {
    const color = isHead ? this.colors.head : this.colors.body;
    const inset = 3;
    const s = size - inset;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = alpha < 0.5 ? 8 : 15;
    ctx.fillStyle = withAlpha(color, 0.55);
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - s / 2 + 0.75, cy - s / 2 + 0.75, s - 1.5, s - 1.5);
    ctx.restore();
  },
  drawEyes(ctx, dir, size, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.colors.eyes;
    ctx.shadowColor = this.colors.eyes;
    ctx.shadowBlur = 6;
    for (const e of eyeOffsets(dir, size)) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, size * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  drawFruit(ctx, img, rect, w, h, alpha = 1) {
    drawSpriteOrFallback(
      ctx,
      this,
      img,
      rect,
      w,
      h,
      alpha,
      alpha < 0.5 ? 8 : 16,
    );
  },
  drawParticle(ctx, x, y, k) {
    ctx.save();
    ctx.shadowColor = this.colors.particle;
    ctx.shadowBlur = 12;
    ctx.fillStyle = withAlpha(this.colors.particle, k);
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + 2.5 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};

// ── RETRO: 8-bit desaturado, fondo #1a1a2e, textura pixel, sin glow ────────

const RETRO_PX = 4; // tamaño del "pixel" de la textura
const RETRO_FRUIT_H = 12; // alto del sprite pixelado antes de escalar

const retro: SnakeSkin = {
  name: "RETRO",
  colors: {
    body: "#60a060",
    head: "#8cc084",
    eyes: "#e8e0c8",
    grid: "#34345a",
    particle: "#d4b840",
    fruitGlow: null,
    fallback: "#c05060",
  },
  boardBg: "#1a1a2e",
  drawGrid(ctx) {
    // Rejilla de puntos en las esquinas de cada celda.
    ctx.save();
    ctx.fillStyle = this.colors.grid;
    for (let x = 0; x <= COLS; x++) {
      for (let y = 0; y <= ROWS; y++) {
        ctx.fillRect(x * CELL - 1, y * CELL - 1, 2, 2);
      }
    }
    ctx.restore();
  },
  drawSegment(ctx, cx, cy, size, isHead, alpha = 1) {
    const color = isHead ? this.colors.head : this.colors.body;
    const s = Math.round(size / RETRO_PX) * RETRO_PX;
    const x = Math.round(cx - s / 2);
    const y = Math.round(cy - s / 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);
    // Textura: líneas oscurecidas cada RETRO_PX px + borde inferior/derecho.
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    for (let i = RETRO_PX; i < s; i += RETRO_PX * 2) {
      ctx.fillRect(x, y + i, s, RETRO_PX);
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(x, y + s - RETRO_PX, s, RETRO_PX);
    ctx.fillRect(x + s - RETRO_PX, y, RETRO_PX, s);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(x, y, s - RETRO_PX, RETRO_PX);
    ctx.restore();
  },
  drawEyes(ctx, dir, size, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.colors.eyes;
    for (const e of eyeOffsets(dir, size)) {
      ctx.fillRect(
        Math.round(e.x - RETRO_PX / 2),
        Math.round(e.y - RETRO_PX / 2),
        RETRO_PX,
        RETRO_PX,
      );
    }
    ctx.restore();
  },
  drawFruit(ctx, img, rect, w, h, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    const px = img ? pixelSprite(img, rect) : null;
    if (px) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(px, -w / 2, -h / 2, w, h);
    } else {
      // Fallback: rombo de bloques.
      ctx.fillStyle = this.colors.fallback;
      ctx.fillRect(-8, -12, 16, 24);
      ctx.fillRect(-12, -8, 24, 16);
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(-8, -12, 8, 4);
    }
    ctx.restore();
  },
  drawParticle(ctx, x, y, k) {
    const s = k > 0.5 ? RETRO_PX : RETRO_PX / 2;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = Math.max(0, Math.min(1, k + 0.2));
    ctx.fillStyle = this.colors.particle;
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    ctx.restore();
  },
};

// ── Helpers de sprites ─────────────────────────────────────────────────────

function drawSpriteOrFallback(
  ctx: CanvasRenderingContext2D,
  skin: SnakeSkin,
  img: HTMLImageElement | null,
  rect: SpriteRect,
  w: number,
  h: number,
  alpha: number,
  blur: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (img) {
    ctx.imageSmoothingEnabled = true;
    if (skin.colors.fruitGlow) {
      ctx.shadowColor = skin.colors.fruitGlow;
      ctx.shadowBlur = blur;
    }
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -w / 2, -h / 2, w, h);
  } else {
    const c = skin.colors.fallback;
    ctx.fillStyle = withAlpha(c, 0.35);
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.shadowColor = c;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Sprites reducidos a baja resolución y desaturados (cache por imagen + rect).
const pixelCache = new WeakMap<
  HTMLImageElement,
  Map<number, HTMLCanvasElement>
>();

function pixelSprite(
  img: HTMLImageElement,
  rect: SpriteRect,
): HTMLCanvasElement | null {
  let byRect = pixelCache.get(img);
  if (!byRect) {
    byRect = new Map();
    pixelCache.set(img, byRect);
  }
  const cached = byRect.get(rect.x);
  if (cached) return cached;

  const h = RETRO_FRUIT_H;
  const w = Math.max(1, Math.round((rect.w / rect.h) * h));
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const c = off.getContext("2d");
  if (!c) return null;
  c.imageSmoothingEnabled = true;
  c.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  // Desatura ~50% y recorta al contorno del sprite.
  c.globalCompositeOperation = "saturation";
  c.globalAlpha = 0.5;
  c.fillStyle = "hsl(0, 0%, 50%)";
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = "destination-in";
  c.globalAlpha = 1;
  c.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  byRect.set(rect.x, off);
  return off;
}

export const SKINS: Record<SkinId, SnakeSkin> = { clasico, neon, retro };

export const DEFAULT_SKIN: SkinId = "clasico";

/** Fondo del tablero: `boardBg` o transparente (clearRect) si es null. */
export function paintBoard(
  ctx: CanvasRenderingContext2D,
  skin: SnakeSkin,
): void {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  if (!skin.boardBg) return;
  ctx.save();
  ctx.fillStyle = skin.boardBg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
}

export function isSkinId(v: unknown): v is SkinId {
  return typeof v === "string" && Object.hasOwn(SKINS, v);
}

/** Fondo de la muestra cuando la skin es transparente (pantalla CRT). */
const SWATCH_SCREEN = "#0a0a0f";

/** Opciones para el selector de la UI: [fondo, cuerpo, cabeza] por skin. */
export const SKIN_OPTIONS: readonly {
  id: SkinId;
  name: string;
  swatch: readonly [string, string, string];
}[] = (Object.keys(SKINS) as SkinId[]).map((id) => {
  const { name, boardBg, colors } = SKINS[id];
  return {
    id,
    name,
    swatch: [boardBg ?? SWATCH_SCREEN, colors.body, colors.head] as const,
  };
});
