// Skins de Caída (patrón estrategia, port tipado de SKINS de
// references/started-games/03-tetris/game.js). Cada skin trae su paleta, su
// fondo y las funciones que dibujan cada elemento. El motor nunca pinta
// colores propios. Toda función deja el contexto limpio (save/restore).
import { BLOCK, COLS, ROWS } from "./pieces";
import { HEIGHT, traceWellGrid, WELL_H, WELL_W, WELL_X, WIDTH } from "./utils";

export type SkinId = "clasico" | "neon" | "retro";

export interface TetrisSkin {
  name: string;
  /** Paleta indexada por tipo de pieza (1..8); el 0 es celda vacía. */
  colors: readonly (string | null)[];
  /** Color de marco/rejilla/panel. */
  accent: string;
  /** Color del texto en canvas (contraste ≥ 4.5:1 vs fondo). */
  text: string;
  /** Fondo del canvas; null = transparente (se ve la pantalla CRT). */
  boardBg: string | null;
  /** Bloque en píxeles (x, y) de lado `size`; alpha < 1 = pieza fantasma. */
  drawBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ): void;
  /** Rejilla + marco del pozo. */
  drawWell(ctx: CanvasRenderingContext2D): void;
  /** Etiqueta y recuadro del panel SIGUIENTE. */
  drawNextPanel(
    ctx: CanvasRenderingContext2D,
    label: string,
    x: number,
    y: number,
    size: number,
  ): void;
}

/** "#rrggbb" | "#rgb" → rgba(r, g, b, a). */
function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Color oscurecido `amount` por canal, con alpha. */
function darken(hex: string, amount: number, a: number): string {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.max(0, v - amount));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const LABEL_FONT = "12px monospace";

function setLabelFont(ctx: CanvasRenderingContext2D, font = LABEL_FONT) {
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// ── CLÁSICO: look original del port (relleno 0.55 + trazo + glow magenta) ──

const CLASICO_ACCENT = "#ff006e"; // antes var(--magenta)

const clasico: TetrisSkin = {
  name: "CLÁSICO",
  colors: [
    null,
    "#4dd0e1", // I - cyan
    "#ffd54f", // O - yellow
    "#ba68c8", // T - purple
    "#81c784", // S - green
    "#e57373", // Z - red
    "#90caf9", // J - pale blue
    "#ffb74d", // L - orange
    "#9e9e9e", // N - tuerca (gris metálico)
  ],
  accent: CLASICO_ACCENT,
  text: CLASICO_ACCENT,
  boardBg: null,
  drawBlock(ctx, x, y, colorIndex, size, alpha = 1) {
    const c = this.colors[colorIndex];
    if (!c) return;
    const pad = 1.5;
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = c;
    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.shadowColor = c;
    ctx.shadowBlur = alpha < 1 ? 0 : 8;
    ctx.strokeRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
    ctx.restore();
  },
  drawWell(ctx) {
    ctx.save();
    ctx.strokeStyle = this.accent;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 1;
    traceWellGrid(ctx);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.shadowColor = this.accent;
    ctx.shadowBlur = 8;
    ctx.strokeRect(WELL_X, 0, WELL_W, WELL_H);
    ctx.restore();
  },
  drawNextPanel(ctx, label, x, y, size) {
    ctx.save();
    ctx.fillStyle = this.text;
    setLabelFont(ctx);
    ctx.fillText(label, x, y - 12);
    ctx.strokeStyle = this.accent;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
    ctx.restore();
  },
};

// ── NEÓN: fondo negro, saturados, relleno 0.55 + trazo + glow por color ────

const neon: TetrisSkin = {
  name: "NEÓN",
  colors: [
    null,
    "#00ffff",
    "#ffff00",
    "#ff00ff",
    "#00ff00",
    "#ff0040",
    "#00aaff",
    "#ff8000",
    "#8000ff",
  ],
  accent: "#00ffff",
  text: "#00ffff",
  boardBg: "#000",
  drawBlock(ctx, x, y, colorIndex, size, alpha = 1) {
    const c = this.colors[colorIndex];
    if (!c) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = c;
    ctx.shadowBlur = alpha < 0.5 ? 8 : 15;
    ctx.fillStyle = withAlpha(c, 0.55);
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1.75, y + 1.75, size - 3.5, size - 3.5);
    ctx.restore();
  },
  drawWell(ctx) {
    ctx.save();
    ctx.strokeStyle = withAlpha(this.accent, 0.1);
    ctx.lineWidth = 1;
    traceWellGrid(ctx);
    ctx.stroke();
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = this.accent;
    ctx.shadowBlur = 15;
    ctx.strokeRect(WELL_X, 0, WELL_W, WELL_H);
    ctx.restore();
  },
  drawNextPanel(ctx, label, x, y, size) {
    ctx.save();
    ctx.fillStyle = this.text;
    ctx.shadowColor = this.text;
    ctx.shadowBlur = 8;
    setLabelFont(ctx);
    ctx.fillText(label, x, y - 12);
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = this.accent;
    ctx.shadowBlur = 10;
    ctx.strokeRect(x, y, size, size);
    ctx.restore();
  },
};

// ── RETRO: 8-bit desaturado, fondo #1a1a2e, textura pixel, sin glow ────────

const RETRO_PX = 4; // paso de la textura pixel

const retro: TetrisSkin = {
  name: "RETRO",
  colors: [
    null,
    "#3ab8c8",
    "#d4b840",
    "#9a50a8",
    "#60a060",
    "#c05060",
    "#7090d8",
    "#d08030",
    "#808080",
  ],
  accent: "#4a4a78",
  text: "#e8e0c8",
  boardBg: "#1a1a2e",
  drawBlock(ctx, x, y, colorIndex, size, alpha = 1) {
    const c = this.colors[colorIndex];
    if (!c) return;
    const bx = Math.round(x) + 1;
    const by = Math.round(y) + 1;
    const bw = size - 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    ctx.fillStyle = c;
    ctx.fillRect(bx, by, bw, bw);
    // Textura: líneas de 1 px oscurecidas cada RETRO_PX px (rejilla pixel).
    ctx.fillStyle = darken(c, 60, 0.7);
    for (let i = RETRO_PX; i < bw; i += RETRO_PX) {
      ctx.fillRect(bx + i, by, 1, bw);
      ctx.fillRect(bx, by + i, bw, 1);
    }
    ctx.restore();
  },
  drawWell(ctx) {
    ctx.save();
    ctx.shadowBlur = 0;
    // Rejilla de puntos en las esquinas de cada celda.
    ctx.fillStyle = this.accent;
    for (let c = 1; c < COLS; c++) {
      for (let r = 1; r < ROWS; r++) {
        ctx.fillRect(WELL_X + c * BLOCK - 1, r * BLOCK - 1, 2, 2);
      }
    }
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(WELL_X, 0, WELL_W, WELL_H);
    ctx.restore();
  },
  drawNextPanel(ctx, label, x, y, size) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.text;
    setLabelFont(ctx, "bold 12px monospace");
    ctx.fillText(label, x, y - 12);
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);
    ctx.restore();
  },
};

export const SKINS: Record<SkinId, TetrisSkin> = { clasico, neon, retro };

export const DEFAULT_SKIN: SkinId = "clasico";

/** Fondo del canvas: `boardBg` o transparente (clearRect) si es null. */
export function paintBoard(
  ctx: CanvasRenderingContext2D,
  skin: TetrisSkin,
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

/** Opciones para el selector de la UI: [fondo, pieza I, acento] por skin. */
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
      sk.colors[1] ?? sk.accent,
      sk.accent,
    ] as const,
  };
});
