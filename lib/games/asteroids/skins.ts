// Skins de Rocas (patrón estrategia, port de SKINS de
// references/started-games/03-tetris/game.js). Cada skin trae su paleta, su
// fondo y las funciones que dibujan cada entidad. El motor nunca pinta colores
// propios. Toda función deja el contexto limpio (save/restore).
import { H, W } from "./utils";

export type SkinId = "clasico" | "neon" | "retro";

export interface AsteroidsSkinColors {
  ship: string;
  flame: string;
  rock: string;
  bullet: string;
  particle: string;
}

export interface AsteroidsSkin {
  name: string;
  colors: AsteroidsSkinColors;
  /** Fondo del tablero; null = transparente (se ve la pantalla CRT). */
  boardBg: string | null;
  /** Textura sobre el fondo (tras pintar boardBg). */
  drawBoard(ctx: CanvasRenderingContext2D): void;
  /** Nave centrada en (x, y) apuntando a `angle`; `flame` = largo extra de la llama (0 = sin llama). */
  drawShip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    flame: number,
    alpha?: number,
  ): void;
  /** Roca: polígono `verts` (relativo al centro) rotado `rot`. */
  drawRock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rot: number,
    verts: readonly (readonly [number, number])[],
    alpha?: number,
  ): void;
  drawBullet(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    alpha?: number,
  ): void;
  /** Chispa de explosión de (x, y) a (tx, ty); `k` = vida restante 0–1. */
  drawParticle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    tx: number,
    ty: number,
    k: number,
  ): void;
}

function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ── Geometría compartida ───────────────────────────────────────────────────

/** Silueta clásica: triángulo con muesca trasera (contexto ya rotado). */
function traceShip(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(20, 0); // nariz
  ctx.lineTo(-12, -9); // ala izquierda
  ctx.lineTo(-7, 0); // muesca trasera
  ctx.lineTo(-12, 9); // ala derecha
  ctx.closePath();
}

function traceFlame(ctx: CanvasRenderingContext2D, flame: number): void {
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(-8 - flame, 0);
  ctx.lineTo(-8, 4);
}

function traceRock(
  ctx: CanvasRenderingContext2D,
  verts: readonly (readonly [number, number])[],
): void {
  ctx.beginPath();
  ctx.moveTo(verts[0][0], verts[0][1]);
  for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i][0], verts[i][1]);
  ctx.closePath();
}

// ── CLÁSICO: look original (trazo amarillo #f5ff00 + glow 8, fondo CRT) ────

const CLASICO_BLUR = 8;

const clasico: AsteroidsSkin = {
  name: "CLÁSICO",
  colors: {
    ship: "#f5ff00",
    flame: "rgba(255, 130, 0, 0.85)",
    rock: "#f5ff00",
    bullet: "#f5ff00",
    particle: "#f5ff00",
  },
  boardBg: null,
  drawBoard() {},
  drawShip(ctx, x, y, angle, flame, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = this.colors.ship;
    ctx.shadowBlur = CLASICO_BLUR;
    ctx.strokeStyle = this.colors.ship;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    traceShip(ctx);
    ctx.stroke();
    if (flame > 0) {
      traceFlame(ctx, flame);
      ctx.strokeStyle = this.colors.flame;
      ctx.stroke();
    }
    ctx.restore();
  },
  drawRock(ctx, x, y, rot, verts, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.shadowColor = this.colors.rock;
    ctx.shadowBlur = CLASICO_BLUR;
    ctx.strokeStyle = this.colors.rock;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    traceRock(ctx, verts);
    ctx.stroke();
    ctx.restore();
  },
  drawBullet(ctx, x, y, radius, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = this.colors.bullet;
    ctx.shadowBlur = CLASICO_BLUR;
    ctx.fillStyle = this.colors.bullet;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  drawParticle(ctx, x, y, tx, ty, k) {
    ctx.save();
    ctx.globalAlpha = Math.max(k, 0);
    ctx.shadowColor = this.colors.particle;
    ctx.shadowBlur = CLASICO_BLUR;
    ctx.strokeStyle = this.colors.particle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();
  },
};

// ── NEÓN: fondo negro, synthwave, relleno 0.55 + trazo + glow por entidad ──

const neon: AsteroidsSkin = {
  name: "NEÓN",
  colors: {
    ship: "#00f5ff",
    flame: "#ff8a00",
    rock: "#ff006e",
    bullet: "#f5ff00",
    particle: "#f5ff00",
  },
  boardBg: "#000",
  drawBoard() {},
  drawShip(ctx, x, y, angle, flame, alpha = 1) {
    const c = this.colors.ship;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.lineJoin = "round";
    if (flame > 0) {
      const f = this.colors.flame;
      ctx.shadowColor = f;
      ctx.shadowBlur = 14;
      traceFlame(ctx, flame);
      ctx.closePath();
      ctx.fillStyle = withAlpha(f, 0.55);
      ctx.fill();
      ctx.strokeStyle = f;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.shadowColor = c;
    ctx.shadowBlur = alpha < 0.5 ? 8 : 15;
    traceShip(ctx);
    ctx.fillStyle = withAlpha(c, 0.55);
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  },
  drawRock(ctx, x, y, rot, verts, alpha = 1) {
    const c = this.colors.rock;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.shadowColor = c;
    ctx.shadowBlur = alpha < 0.5 ? 8 : 15;
    ctx.lineJoin = "round";
    traceRock(ctx, verts);
    ctx.fillStyle = withAlpha(c, 0.55);
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  },
  drawBullet(ctx, x, y, radius, alpha = 1) {
    const c = this.colors.bullet;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = c;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, radius + 1, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(c, 0.55);
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  },
  drawParticle(ctx, x, y, tx, ty, k) {
    const c = this.colors.particle;
    ctx.save();
    ctx.globalAlpha = Math.max(k, 0);
    ctx.shadowColor = c;
    ctx.shadowBlur = k < 0.5 ? 6 : 12;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();
  },
};

// ── RETRO: 8-bit desaturado, fondo #1a1a2e, textura pixel, sin glow ────────

const RETRO_PX = 4; // tamaño del "pixel" de la textura
const RETRO_SHADE = "rgba(0, 0, 0, 0.3)";
const RETRO_SCANLINE = "rgba(0, 0, 0, 0.18)";

/** Relleno sólido + líneas oscurecidas cada RETRO_PX px dentro del path actual. */
function fillPixelTexture(
  ctx: CanvasRenderingContext2D,
  color: string,
  extent: number,
): void {
  ctx.fillStyle = color;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = RETRO_SHADE;
  for (let i = -extent; i < extent; i += RETRO_PX * 2) {
    ctx.fillRect(-extent, i, extent * 2, RETRO_PX);
  }
}

const retro: AsteroidsSkin = {
  name: "RETRO",
  colors: {
    ship: "#a8c8a0",
    flame: "#c87840",
    rock: "#9a8c74",
    bullet: "#d4b840",
    particle: "#d4b840",
  },
  boardBg: "#1a1a2e",
  drawBoard(ctx) {
    // Scanlines tenues cada RETRO_PX px.
    ctx.save();
    ctx.fillStyle = RETRO_SCANLINE;
    for (let y = 0; y < H; y += RETRO_PX * 2) ctx.fillRect(0, y, W, RETRO_PX);
    ctx.restore();
  },
  drawShip(ctx, x, y, angle, flame, alpha = 1) {
    // Rotación cuantizada a 16 direcciones (sprite 8-bit).
    const step = Math.PI / 8;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(Math.round(angle / step) * step);
    if (flame > 0) {
      ctx.fillStyle = this.colors.flame;
      const len = Math.round(flame / RETRO_PX) * RETRO_PX;
      ctx.fillRect(-8 - len, -RETRO_PX / 2, len, RETRO_PX);
      ctx.fillRect(-8 - len / 2, -RETRO_PX, len / 2, RETRO_PX * 2);
    }
    traceShip(ctx);
    fillPixelTexture(ctx, this.colors.ship, 24);
    ctx.restore();
  },
  drawRock(ctx, x, y, rot, verts, alpha = 1) {
    const step = Math.PI / 8;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(Math.round(rot / step) * step);
    traceRock(ctx, verts);
    fillPixelTexture(ctx, this.colors.rock, 56);
    ctx.restore();
  },
  drawBullet(ctx, x, y, _radius, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.colors.bullet;
    ctx.fillRect(
      Math.round(x - RETRO_PX / 2),
      Math.round(y - RETRO_PX / 2),
      RETRO_PX,
      RETRO_PX,
    );
    ctx.restore();
  },
  drawParticle(ctx, x, y, _tx, _ty, k) {
    const s = k > 0.5 ? RETRO_PX : RETRO_PX / 2;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = Math.max(0, Math.min(1, k + 0.2));
    ctx.fillStyle = this.colors.particle;
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    ctx.restore();
  },
};

export const SKINS: Record<SkinId, AsteroidsSkin> = { clasico, neon, retro };

export const DEFAULT_SKIN: SkinId = "clasico";

/** Fondo del tablero: `boardBg` (+ textura) o transparente si es null. */
export function paintBoard(
  ctx: CanvasRenderingContext2D,
  skin: AsteroidsSkin,
): void {
  ctx.clearRect(0, 0, W, H);
  if (!skin.boardBg) return;
  ctx.save();
  ctx.fillStyle = skin.boardBg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  skin.drawBoard(ctx);
}

export function isSkinId(v: unknown): v is SkinId {
  return typeof v === "string" && Object.hasOwn(SKINS, v);
}

/** Fondo de la muestra cuando la skin es transparente (pantalla CRT). */
const SWATCH_SCREEN = "#0a0a0f";

/** Opciones para el selector de la UI: [fondo, nave, roca] por skin. */
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
      sk.colors.ship,
      sk.colors.rock,
    ] as const,
  };
});
