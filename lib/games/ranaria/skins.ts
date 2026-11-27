// Skins de Ranaria (patrón estrategia, port de SKINS de
// references/started-games/03-tetris/game.js). Cada skin trae su paleta, su
// fondo y las funciones que dibujan cada entidad. El motor nunca pinta colores
// propios. Toda función deja el contexto limpio (save/restore).
//
// Las tres skins comparten la geometría; cambia el modo de pintado:
//   flat  (CLÁSICO) → relleno plano + leve highlight superior
//   neon  (NEÓN)    → relleno alpha 0.55 + trazo + glow del color
//   pixel (RETRO)   → paleta desaturada + textura de líneas cada 4 px, sin glow
import {
  CELL,
  COLS,
  GOAL_COLS,
  GOAL_WIDTH,
  HEIGHT,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_SAFE_MID,
  ROW_START,
  TIME_BAR_H,
  WIDTH,
  withAlpha,
  type Direction,
} from "./utils";

export type SkinId = "clasico" | "neon" | "retro";

type PaintMode = "flat" | "neon" | "pixel";

export interface RanariaSkinColors {
  road: string;
  roadLine: string;
  river: string;
  safe: string;
  hedge: string;
  goal: string;
  goalBorder: string;
  frog: string;
  frogEyes: string;
  frogPupil: string;
  /** Una por variante de coche. */
  cars: readonly [string, string, string];
  /** Una por variante de camión. */
  trucks: readonly [string, string];
  truckCab: string;
  wheel: string;
  window: string;
  log: string;
  logGrain: string;
  turtle: string;
  turtleShell: string;
  hudText: string;
  timeOk: string;
  timeWarn: string;
  timeLow: string;
  timeTrack: string;
  /** Color de highlight (flat) o de textura (pixel). */
  texture: string;
}

export interface HudState {
  score: number;
  level: number;
  lives: number;
  /** Tiempo restante 0–1. */
  timeFrac: number;
}

export interface RanariaSkin {
  name: string;
  colors: RanariaSkinColors;
  /** Fondo base del tablero (las zonas se pintan encima). */
  boardBg: string;
  /** Zonas: bocas/seto, río, franjas seguras, carretera. */
  drawBoard(ctx: CanvasRenderingContext2D): void;
  /** Rana dentro de una boca ocupada (centro en px). */
  drawGoalFrog(ctx: CanvasRenderingContext2D, cx: number, cy: number): void;
  /** Coche o camión; (x, y) = esquina sup. izq. en px; `dir` = sentido. */
  drawVehicle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cells: number,
    kind: "car" | "truck",
    variant: number,
    dir: 1 | -1,
  ): void;
  drawLog(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cells: number,
  ): void;
  /** Grupo de tortugas; `sink` 0 = a flote … 1 = sumergidas. */
  drawTurtles(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cells: number,
    sink: number,
    dir: 1 | -1,
  ): void;
  /** Rana centrada en (cx, cy); `jump` 0 = quieta, (0,1) = en el aire. */
  drawFrog(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    facing: Direction,
    jump: number,
    alpha?: number,
  ): void;
  /** HUD interno: barra de tiempo (fila 0) + score/nivel/vidas (fila 13). */
  drawHud(ctx: CanvasRenderingContext2D, hud: HudState): void;
}

// ---------- Pintado genérico por modo ----------

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Traza con `trace` (sin beginPath) y pinta según el modo. `box` acota el
 * highlight (flat) o la textura (pixel).
 */
function paint(
  ctx: CanvasRenderingContext2D,
  mode: PaintMode,
  c: RanariaSkinColors,
  color: string,
  box: Box,
  trace: (ctx: CanvasRenderingContext2D) => void,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  trace(ctx);
  if (mode === "neon") {
    ctx.shadowColor = color;
    ctx.shadowBlur = alpha < 0.5 ? 6 : 12;
    ctx.fillStyle = withAlpha(color, 0.55);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.clip();
    if (mode === "flat") {
      // Leve highlight en el tercio superior.
      ctx.fillStyle = withAlpha(c.texture, 0.16);
      ctx.fillRect(box.x, box.y, box.w, box.h * 0.35);
    } else {
      // Textura pixel: líneas oscuras cada 4 px.
      ctx.fillStyle = withAlpha(c.texture, 0.28);
      for (let y = Math.floor(box.y); y < box.y + box.h; y += 4) {
        ctx.fillRect(box.x, y, box.w, 1);
      }
    }
  }
  ctx.restore();
}

/** Trazo de línea con glow en neón. */
function line(
  ctx: CanvasRenderingContext2D,
  mode: PaintMode,
  color: string,
  width: number,
  trace: (ctx: CanvasRenderingContext2D) => void,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  if (mode === "neon") {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  trace(ctx);
  ctx.stroke();
  ctx.restore();
}

const FACING_ANGLE: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

// ---------- Fábrica de skins ----------

function makeSkin(
  name: string,
  mode: PaintMode,
  boardBg: string,
  colors: RanariaSkinColors,
): RanariaSkin {
  const c = colors;
  const zoneFill = (color: string) =>
    mode === "neon" ? withAlpha(color, 0.14) : color;

  function rows(
    ctx: CanvasRenderingContext2D,
    from: number,
    to: number,
    color: string,
  ) {
    ctx.fillStyle = zoneFill(color);
    ctx.fillRect(0, from * CELL, WIDTH, (to - from + 1) * CELL);
  }

  function frogShape(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    facing: Direction,
    jump: number,
    scale: number,
    alpha: number,
  ) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(FACING_ANGLE[facing]);
    const s = scale * (1 + 0.15 * Math.sin(Math.PI * jump));
    ctx.scale(s, s);
    // Patas: extendidas durante el salto, recogidas en reposo.
    const ext = jump > 0 ? 1 : 0;
    line(
      ctx,
      mode,
      c.frog,
      4,
      (g) => {
        // delanteras
        g.moveTo(-9, -6);
        g.lineTo(-15 - 2 * ext, -12 - 6 * ext);
        g.moveTo(9, -6);
        g.lineTo(15 + 2 * ext, -12 - 6 * ext);
        // traseras
        g.moveTo(-10, 6);
        g.lineTo(-16 - 2 * ext, 10 + 7 * ext);
        g.moveTo(10, 6);
        g.lineTo(16 + 2 * ext, 10 + 7 * ext);
      },
      alpha,
    );
    // Cuerpo: elipse 28×24.
    paint(
      ctx,
      mode,
      c,
      c.frog,
      { x: -14, y: -12, w: 28, h: 24 },
      (g) => g.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2),
      alpha,
    );
    // Ojos.
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = c.frogEyes;
    ctx.beginPath();
    ctx.arc(-7, -9, 4, 0, Math.PI * 2);
    ctx.arc(7, -9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.frogPupil;
    ctx.beginPath();
    ctx.arc(-7, -10, 2, 0, Math.PI * 2);
    ctx.arc(7, -10, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function text(
    ctx: CanvasRenderingContext2D,
    str: string,
    x: number,
    y: number,
    align: CanvasTextAlign,
  ) {
    ctx.save();
    ctx.font = "bold 16px monospace";
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = c.hudText;
    if (mode === "neon") {
      ctx.shadowColor = c.hudText;
      ctx.shadowBlur = 6;
    }
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  return {
    name,
    colors,
    boardBg,

    drawBoard(ctx) {
      ctx.save();
      ctx.fillStyle = boardBg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      rows(ctx, ROW_GOALS, ROW_GOALS, c.hedge);
      rows(ctx, ROW_RIVER_TOP, ROW_RIVER_BOT, c.river);
      rows(ctx, ROW_SAFE_MID, ROW_SAFE_MID, c.safe);
      rows(ctx, ROW_ROAD_TOP, ROW_ROAD_BOT, c.road);
      rows(ctx, ROW_START, ROW_START, c.safe);
      ctx.restore();

      // Separadores de carril (discontinuos).
      ctx.save();
      ctx.setLineDash([14, 12]);
      line(
        ctx,
        mode,
        c.roadLine,
        2,
        (g) => {
          for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
            g.moveTo(0, r * CELL);
            g.lineTo(WIDTH, r * CELL);
          }
        },
        0.6,
      );
      ctx.restore();

      // Bordes de zona (solo neón: líneas con glow).
      if (mode === "neon") {
        line(ctx, mode, c.river, 2, (g) => {
          for (const r of [ROW_RIVER_TOP, ROW_RIVER_BOT + 1]) {
            g.moveTo(0, r * CELL);
            g.lineTo(WIDTH, r * CELL);
          }
        });
        line(ctx, mode, c.safe, 2, (g) => {
          for (const r of [ROW_ROAD_TOP, ROW_START]) {
            g.moveTo(0, r * CELL);
            g.lineTo(WIDTH, r * CELL);
          }
        });
      }

      // Bocas destino: rectángulo de meta con borde.
      for (const g0 of GOAL_COLS) {
        const x = g0 * CELL + 3;
        const y = ROW_GOALS * CELL + TIME_BAR_H + 2;
        const w = GOAL_WIDTH * CELL - 6;
        const h = CELL - TIME_BAR_H - 2;
        ctx.save();
        ctx.fillStyle = zoneFill(c.goal);
        ctx.fillRect(x, y, w, h);
        ctx.restore();
        line(ctx, mode, c.goalBorder, 2, (g) => g.rect(x, y, w, h));
      }

      // Textura pixel global (retro).
      if (mode === "pixel") {
        ctx.save();
        ctx.fillStyle = withAlpha(c.texture, 0.18);
        for (let y = 0; y < HEIGHT; y += 4) ctx.fillRect(0, y, WIDTH, 1);
        ctx.restore();
      }
    },

    drawGoalFrog(ctx, cx, cy) {
      frogShape(ctx, cx, cy, "down", 0, 0.8, 1);
    },

    drawVehicle(ctx, x, y, cells, kind, variant, dir) {
      const bx = x + 4;
      const by = y + 7;
      const bw = cells * CELL - 8;
      const bh = CELL - 14;
      // Ruedas circulares.
      ctx.save();
      ctx.fillStyle = c.wheel;
      if (mode === "neon") {
        ctx.strokeStyle = c.window;
        ctx.lineWidth = 1;
        ctx.shadowColor = c.window;
        ctx.shadowBlur = 4;
      }
      ctx.beginPath();
      const wheelXs =
        kind === "car"
          ? [bx + 7, bx + bw - 7]
          : [bx + 8, bx + bw / 2, bx + bw - 8];
      for (const wx of wheelXs) {
        ctx.moveTo(wx + 4, by);
        ctx.arc(wx, by, 4, 0, Math.PI * 2);
        ctx.moveTo(wx + 4, by + bh);
        ctx.arc(wx, by + bh, 4, 0, Math.PI * 2);
      }
      ctx.fill();
      if (mode === "neon") ctx.stroke();
      ctx.restore();

      if (kind === "car") {
        const color = c.cars[variant % c.cars.length];
        paint(ctx, mode, c, color, { x: bx, y: by, w: bw, h: bh }, (g) =>
          g.roundRect(bx, by, bw, bh, 6),
        );
        // Parabrisas hacia el frente.
        const wx = dir === 1 ? bx + bw - 12 : bx + 4;
        paint(
          ctx,
          mode,
          c,
          c.window,
          { x: wx, y: by + 4, w: 8, h: bh - 8 },
          (g) => g.roundRect(wx, by + 4, 8, bh - 8, 2),
        );
      } else {
        const color = c.trucks[variant % c.trucks.length];
        const cabW = 14;
        const tx = dir === 1 ? bx : bx + cabW + 2;
        const cx = dir === 1 ? bx + bw - cabW : bx;
        paint(
          ctx,
          mode,
          c,
          color,
          { x: tx, y: by, w: bw - cabW - 2, h: bh },
          (g) => g.roundRect(tx, by, bw - cabW - 2, bh, 3),
        );
        paint(
          ctx,
          mode,
          c,
          c.truckCab,
          { x: cx, y: by + 1, w: cabW, h: bh - 2 },
          (g) => g.roundRect(cx, by + 1, cabW, bh - 2, 4),
        );
        const wx = dir === 1 ? cx + cabW - 6 : cx + 2;
        paint(
          ctx,
          mode,
          c,
          c.window,
          { x: wx, y: by + 5, w: 4, h: bh - 10 },
          (g) => g.rect(wx, by + 5, 4, bh - 10),
        );
      }
    },

    drawLog(ctx, x, y, cells) {
      const lx = x + 2;
      const ly = y + 6;
      const lw = cells * CELL - 4;
      const lh = CELL - 12;
      paint(ctx, mode, c, c.log, { x: lx, y: ly, w: lw, h: lh }, (g) =>
        g.roundRect(lx, ly, lw, lh, 12),
      );
      // Vetas + anillos en los extremos.
      line(ctx, mode, c.logGrain, 2, (g) => {
        g.moveTo(lx + 14, ly + lh * 0.33);
        g.lineTo(lx + lw * 0.55, ly + lh * 0.33);
        g.moveTo(lx + lw * 0.4, ly + lh * 0.68);
        g.lineTo(lx + lw - 14, ly + lh * 0.68);
        g.moveTo(lx + lw - 5 + 4, ly + lh / 2);
        g.ellipse(lx + lw - 5, ly + lh / 2, 4, lh / 2 - 4, 0, 0, Math.PI * 2);
      });
    },

    drawTurtles(ctx, x, y, cells, sink, dir) {
      for (let i = 0; i < cells; i++) {
        const cx = x + i * CELL + CELL / 2;
        const cy = y + CELL / 2;
        if (sink >= 1) {
          // Bajo el agua: solo contorno semitransparente.
          line(
            ctx,
            mode,
            c.turtle,
            1.5,
            (g) => g.arc(cx, cy, 13, 0, Math.PI * 2),
            0.3,
          );
          continue;
        }
        const alpha = 1 - sink * 0.6;
        const r = 15 - sink * 4;
        // Cabeza hacia el sentido de avance.
        paint(
          ctx,
          mode,
          c,
          c.turtle,
          { x: cx - 4, y: cy - 4, w: 8, h: 8 },
          (g) => g.arc(cx + dir * (r + 2), cy, 4, 0, Math.PI * 2),
          alpha,
        );
        paint(
          ctx,
          mode,
          c,
          c.turtle,
          { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r },
          (g) => g.arc(cx, cy, r, 0, Math.PI * 2),
          alpha,
        );
        // Escamas del caparazón.
        line(
          ctx,
          mode,
          c.turtleShell,
          2,
          (g) => {
            g.moveTo(cx + r * 0.55, cy);
            g.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
            for (let k = 0; k < 6; k++) {
              const a = (Math.PI / 3) * k;
              g.moveTo(
                cx + Math.cos(a) * r * 0.55,
                cy + Math.sin(a) * r * 0.55,
              );
              g.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
            }
          },
          alpha,
        );
      }
    },

    drawFrog(ctx, cx, cy, facing, jump, alpha = 1) {
      frogShape(ctx, cx, cy, facing, jump, 1, alpha);
    },

    drawHud(ctx, hud) {
      // Barra de tiempo en el borde superior de la fila 0.
      const frac = Math.max(0, Math.min(1, hud.timeFrac));
      const tColor =
        frac > 0.5 ? c.timeOk : frac > 0.25 ? c.timeWarn : c.timeLow;
      ctx.save();
      ctx.fillStyle = c.timeTrack;
      ctx.fillRect(0, 0, WIDTH, TIME_BAR_H);
      ctx.fillStyle = tColor;
      if (mode === "neon") {
        ctx.shadowColor = tColor;
        ctx.shadowBlur = 8;
      }
      ctx.fillRect(0, 0, WIDTH * frac, TIME_BAR_H);
      ctx.restore();

      // Fila 13: score (izq.), nivel (centro-izq.), vidas (der.); la casilla
      // central de inicio (cols 7–8) queda libre.
      const cy = ROW_START * CELL + CELL / 2;
      text(ctx, String(hud.score).padStart(6, "0"), 10, cy, "left");
      text(ctx, `NIVEL ${hud.level}`, 4 * CELL, cy, "left");
      for (let i = 0; i < hud.lives; i++) {
        const lx = COLS * CELL - 18 - i * 26;
        frogShape(ctx, lx, cy, "up", 0, 0.55, 1);
      }
    },
  };
}

// ── CLÁSICO: arcade de colores planos (carretera negra, río azul) ─────────

const clasico = makeSkin("CLÁSICO", "flat", "#0d0d12", {
  road: "#111118",
  roadLine: "#f5ff00",
  river: "#0b2a5b",
  safe: "#1d4a26",
  hedge: "#3fae4a",
  goal: "#0b3d1a",
  goalBorder: "#ffc832",
  frog: "#39ff6a",
  frogEyes: "#ffffff",
  frogPupil: "#000000",
  cars: ["#ff3b3b", "#ffd23b", "#3b8bff"],
  trucks: ["#9aa0a6", "#c8ccd0"],
  truckCab: "#d9534f",
  wheel: "#1a1a1a",
  window: "#bfe9ff",
  log: "#8b5a2b",
  logGrain: "#5e3a17",
  turtle: "#2fa84f",
  turtleShell: "#145c2b",
  hudText: "#ffffff",
  timeOk: "#39ff6a",
  timeWarn: "#f5ff00",
  timeLow: "#ff3b3b",
  timeTrack: "#000000",
  texture: "#ffffff",
});

// ── NEÓN: fondo negro, synthwave, relleno 0.55 + trazo + glow ─────────────

const neon = makeSkin("NEÓN", "neon", "#000000", {
  road: "#b967ff",
  roadLine: "#ff006e",
  river: "#00f5ff",
  safe: "#00ff88",
  hedge: "#00ff88",
  goal: "#00ff88",
  goalBorder: "#f5ff00",
  frog: "#00ff88",
  frogEyes: "#ffffff",
  frogPupil: "#000000",
  cars: ["#ff006e", "#f5ff00", "#00f5ff"],
  trucks: ["#b967ff", "#ff9f1c"],
  truckCab: "#ff006e",
  wheel: "#000000",
  window: "#00f5ff",
  log: "#ff9f1c",
  logGrain: "#ffd28a",
  turtle: "#00ff88",
  turtleShell: "#00f5ff",
  hudText: "#ffffff",
  timeOk: "#00ff88",
  timeWarn: "#f5ff00",
  timeLow: "#ff006e",
  timeTrack: "#111111",
  texture: "#ffffff",
});

// ── RETRO: paleta desaturada 8-bit, fondo #1a1a2e, textura pixel, sin glow ─

const retro = makeSkin("RETRO", "pixel", "#1a1a2e", {
  road: "#26263a",
  roadLine: "#8a8a5a",
  river: "#2b3f63",
  safe: "#3a4a3a",
  hedge: "#4a6b44",
  goal: "#24331f",
  goalBorder: "#b8a05a",
  frog: "#7fb069",
  frogEyes: "#e8e0c8",
  frogPupil: "#1a1a2e",
  cars: ["#b5544e", "#c9a94d", "#5577a6"],
  trucks: ["#8a8a8a", "#a39e8c"],
  truckCab: "#9c5a54",
  wheel: "#121220",
  window: "#a9c0c8",
  log: "#7a5a3a",
  logGrain: "#4f3a26",
  turtle: "#5f8a55",
  turtleShell: "#3f5f3a",
  hudText: "#e8e0c8",
  timeOk: "#7fb069",
  timeWarn: "#c9a94d",
  timeLow: "#b5544e",
  timeTrack: "#121220",
  texture: "#000000",
});

export const SKINS: Record<SkinId, RanariaSkin> = { clasico, neon, retro };

export const DEFAULT_SKIN: SkinId = "clasico";

export function isSkinId(v: unknown): v is SkinId {
  return typeof v === "string" && Object.hasOwn(SKINS, v);
}

/** Opciones para el selector de la UI: [fondo, rana, acento] por skin. */
export const SKIN_OPTIONS: readonly {
  id: SkinId;
  name: string;
  swatch: readonly [string, string, string];
}[] = (Object.keys(SKINS) as SkinId[]).map((id) => {
  const { name, colors } = SKINS[id];
  return {
    id,
    name,
    swatch: [colors.river, colors.frog, colors.cars[0]] as const,
  };
});
