// Skins de Bloque Buster (patrón estrategia, port de SKINS de
// references/started-games/03-tetris/game.js). Cada skin trae su paleta, su
// fondo y las funciones que dibujan cada entidad. El motor nunca pinta colores
// propios. Toda función deja el contexto limpio (save/restore).
import type { Rect } from "./entities";
import type { BlockColor } from "./levels";
import { HEIGHT, WIDTH } from "./utils";

export type SkinId = "clasico" | "neon" | "retro";

export interface ArkanoidSkinColors {
  /** Color por tipo de bloque (BlockColor de levels.ts). */
  bricks: Record<BlockColor, string>;
  paddle: string;
  /** Trazo/glow de la pelota. */
  ball: string;
  /** Relleno interior de la pelota. */
  ballCore: string;
  /** Destello del primer paso de la explosión. */
  flash: string;
}

export interface ArkanoidSkin {
  name: string;
  colors: ArkanoidSkinColors;
  /** Fondo del tablero; null = transparente (se ve la pantalla CRT). */
  boardBg: string | null;
  drawBrick(
    ctx: CanvasRenderingContext2D,
    b: Rect,
    color: BlockColor,
    alpha?: number,
  ): void;
  /** Explosión de un bloque; `t` = progreso 0–1 (4 pasos como el original). */
  drawExplosion(
    ctx: CanvasRenderingContext2D,
    e: Rect,
    color: BlockColor,
    t: number,
    alpha?: number,
  ): void;
  drawPaddle(ctx: CanvasRenderingContext2D, p: Rect, alpha?: number): void;
  drawBall(ctx: CanvasRenderingContext2D, b: Rect, alpha?: number): void;
}

/** `#rgb`/`#rrggbb` → `rgba(r,g,b,a)`. Si no es hex devuelve el color tal cual. */
export function hexAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function explosionStep(t: number) {
  const k = Math.min(Math.max(t, 0), 1);
  const step = Math.min(Math.floor(k * 4), 3);
  return { k, step, grow: 2 + step * 3 };
}

// ── CLÁSICO: look original (neón translúcido 0.25, glow, fondo CRT) ────────

const clasico: ArkanoidSkin = {
  name: "CLÁSICO",
  colors: {
    bricks: {
      red: "#ff3b30",
      yellow: "#f5ff00",
      cyan: "#00f5ff",
      magenta: "#d400ff",
      hotpink: "#ff4fa3",
      green: "#00ff88",
      gray: "#b8bcc8",
    },
    paddle: "#00f5ff",
    ball: "#00f5ff",
    ballCore: "#ffffff",
    flash: "#ffffff",
  },
  boardBg: null,
  drawBrick(ctx, b, color, alpha = 1) {
    const hex = this.colors.bricks[color];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = hex;
    ctx.shadowBlur = 10;
    ctx.fillStyle = hexAlpha(hex, 0.25);
    ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.strokeStyle = hex;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    ctx.restore();
  },
  drawExplosion(ctx, e, color, t, alpha = 1) {
    const { k, step, grow } = explosionStep(t);
    const hex = this.colors.bricks[color];
    ctx.save();
    ctx.globalAlpha = (1 - k * 0.85) * alpha;
    ctx.shadowColor = hex;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = hex;
    ctx.fillStyle = step === 0 ? this.colors.flash : hexAlpha(hex, 0.35);
    ctx.lineWidth = 2;
    ctx.fillRect(e.x - grow, e.y - grow, e.w + grow * 2, e.h + grow * 2);
    ctx.strokeRect(e.x - grow, e.y - grow, e.w + grow * 2, e.h + grow * 2);
    ctx.restore();
  },
  drawPaddle(ctx, p, alpha = 1) {
    const color = this.colors.paddle;
    ctx.save();
    ctx.globalAlpha = alpha;
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
  },
  drawBall(ctx, b, alpha = 1) {
    const color = this.colors.ball;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = this.colors.ballCore;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },
};

// ── NEÓN: fondo negro, synthwave, relleno 0.55 + trazo + glow fuerte ───────

const neon: ArkanoidSkin = {
  name: "NEÓN",
  colors: {
    bricks: {
      red: "#ff2a6d",
      yellow: "#f5ff00",
      cyan: "#00f5ff",
      magenta: "#bf00ff",
      hotpink: "#ff006e",
      green: "#39ff14",
      gray: "#c0c8ff",
    },
    paddle: "#ff006e",
    ball: "#f5ff00",
    ballCore: "#f5ff00",
    flash: "#ffffff",
  },
  boardBg: "#000",
  drawBrick(ctx, b, color, alpha = 1) {
    const hex = this.colors.bricks[color];
    const inset = 3;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = hex;
    ctx.shadowBlur = alpha < 0.5 ? 8 : 15;
    ctx.fillStyle = hexAlpha(hex, 0.55);
    ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
    ctx.strokeStyle = hex;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      b.x + inset + 0.75,
      b.y + inset + 0.75,
      b.w - inset * 2 - 1.5,
      b.h - inset * 2 - 1.5,
    );
    ctx.restore();
  },
  drawExplosion(ctx, e, color, t, alpha = 1) {
    const { k, step, grow } = explosionStep(t);
    const hex = this.colors.bricks[color];
    const a = (1 - k * 0.85) * alpha;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = hex;
    ctx.shadowBlur = a < 0.5 ? 10 : 22;
    ctx.strokeStyle = hex;
    ctx.lineWidth = 1.5;
    if (step === 0) {
      ctx.fillStyle = hexAlpha(this.colors.flash, 0.55);
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }
    // Anillo que se expande (sin relleno): onda de choque.
    ctx.strokeRect(e.x - grow, e.y - grow, e.w + grow * 2, e.h + grow * 2);
    ctx.strokeRect(
      e.x - grow * 2,
      e.y - grow * 2,
      e.w + grow * 4,
      e.h + grow * 4,
    );
    ctx.restore();
  },
  drawPaddle(ctx, p, alpha = 1) {
    const color = this.colors.paddle;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = alpha < 0.5 ? 8 : 18;
    ctx.fillStyle = hexAlpha(color, 0.55);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, p.h, p.h / 2);
    ctx.fill();
    ctx.stroke();
    // Filamento central.
    ctx.beginPath();
    ctx.moveTo(p.x + p.h / 2, p.y + p.h / 2);
    ctx.lineTo(p.x + p.w - p.h / 2, p.y + p.h / 2);
    ctx.stroke();
    ctx.restore();
  },
  drawBall(ctx, b, alpha = 1) {
    const color = this.colors.ball;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = alpha < 0.5 ? 10 : 20;
    ctx.fillStyle = hexAlpha(this.colors.ballCore, 0.55);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },
};

// ── RETRO: 8-bit desaturado, fondo #1a1a2e, textura pixel, sin glow ────────

const RETRO_PX = 4; // tamaño del "pixel" de la textura
const RETRO_SHADE = "rgba(0, 0, 0, 0.22)";
const RETRO_EDGE = "rgba(0, 0, 0, 0.35)";
const RETRO_LIGHT = "rgba(255, 255, 255, 0.18)";

/** Rect sólido con líneas oscurecidas cada RETRO_PX px, bisel 8-bit. */
function retroBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = RETRO_SHADE;
  for (let i = RETRO_PX; i < h - RETRO_PX; i += RETRO_PX * 2) {
    ctx.fillRect(x, y + i, w, 1);
  }
  ctx.fillStyle = RETRO_EDGE;
  ctx.fillRect(x, y + h - RETRO_PX, w, RETRO_PX);
  ctx.fillRect(x + w - RETRO_PX, y, RETRO_PX, h);
  ctx.fillStyle = RETRO_LIGHT;
  ctx.fillRect(x, y, w - RETRO_PX, RETRO_PX);
}

const retro: ArkanoidSkin = {
  name: "RETRO",
  colors: {
    bricks: {
      red: "#b05050",
      yellow: "#c8b450",
      cyan: "#5a9aa0",
      magenta: "#8a5a9a",
      hotpink: "#b87088",
      green: "#60a060",
      gray: "#8a8a96",
    },
    paddle: "#c8b8a0",
    ball: "#e8e0c8",
    ballCore: "#e8e0c8",
    flash: "#e8e0c8",
  },
  boardBg: "#1a1a2e",
  drawBrick(ctx, b, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    // Separación de 2 px entre ladrillos (rejilla visible).
    retroBlock(
      ctx,
      b.x + 1,
      b.y + 1,
      b.w - 2,
      b.h - 2,
      this.colors.bricks[color],
    );
    ctx.restore();
  },
  drawExplosion(ctx, e, color, t, alpha = 1) {
    const { k, step } = explosionStep(t);
    const c = step === 0 ? this.colors.flash : this.colors.bricks[color];
    // Fragmentos cuadrados que se separan por pasos (sin glow).
    const spread = step * RETRO_PX * 2;
    const s = RETRO_PX * (step < 2 ? 2 : 1);
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    ctx.save();
    ctx.globalAlpha = (1 - k * 0.7) * alpha;
    ctx.shadowBlur = 0;
    ctx.fillStyle = c;
    for (const fx of [-1, 0, 1]) {
      for (const fy of [-1, 1]) {
        const x = cx + fx * (e.w / 3 + spread) - s / 2;
        const y = cy + fy * (e.h / 4 + spread / 2) - s / 2;
        ctx.fillRect(Math.round(x), Math.round(y), s, s);
      }
    }
    ctx.restore();
  },
  drawPaddle(ctx, p, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    retroBlock(ctx, p.x, p.y, p.w, p.h, this.colors.paddle);
    // Extremos escalonados en otro tono (estilo Vaus 8-bit).
    ctx.fillStyle = this.colors.bricks.red;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), RETRO_PX * 3, p.h);
    ctx.fillRect(
      Math.round(p.x + p.w - RETRO_PX * 3),
      Math.round(p.y),
      RETRO_PX * 3,
      p.h,
    );
    ctx.restore();
  },
  drawBall(ctx, b, alpha = 1) {
    // "Círculo" de píxeles: cruz de bloques RETRO_PX.
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const w = Math.round(b.w);
    const h = Math.round(b.h);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.colors.ball;
    ctx.fillRect(x + RETRO_PX, y, w - RETRO_PX * 2, h);
    ctx.fillRect(x, y + RETRO_PX, w, h - RETRO_PX * 2);
    ctx.fillStyle = RETRO_EDGE;
    ctx.fillRect(x + RETRO_PX, y + h - RETRO_PX, w - RETRO_PX * 2, RETRO_PX);
    ctx.fillStyle = RETRO_LIGHT;
    ctx.fillRect(x + RETRO_PX, y + RETRO_PX, RETRO_PX, RETRO_PX);
    ctx.restore();
  },
};

export const SKINS: Record<SkinId, ArkanoidSkin> = { clasico, neon, retro };

export const DEFAULT_SKIN: SkinId = "clasico";

/** Fondo del tablero: `boardBg` o transparente (clearRect) si es null. */
export function paintBoard(
  ctx: CanvasRenderingContext2D,
  skin: ArkanoidSkin,
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

/** Opciones para el selector de la UI: [fondo, pala, ladrillo] por skin. */
export const SKIN_OPTIONS: readonly {
  id: SkinId;
  name: string;
  swatch: readonly [string, string, string];
}[] = (Object.keys(SKINS) as SkinId[]).map((id) => {
  const sk = SKINS[id];
  return {
    id,
    name: sk.name,
    swatch: [
      sk.boardBg ?? SWATCH_SCREEN,
      sk.colors.paddle,
      sk.colors.bricks.red,
    ] as const,
  };
});
