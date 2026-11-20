import { clearLines, collide, createBoard, merge } from "./board";
import {
  BLOCK,
  COLORS,
  COLS,
  LINE_SCORES,
  ROWS,
  rotateCW,
  type Board,
  type Piece,
} from "./pieces";
import {
  HEIGHT,
  NEXT_SIZE,
  NEXT_X,
  NEXT_Y,
  WELL_H,
  WELL_W,
  WELL_X,
  WIDTH,
  randomPiece,
} from "./utils";

export interface TetrisCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void; // no se invoca: Tetris no tiene vidas
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export type TetrisAction = "left" | "right" | "down" | "rotate" | "drop";

export interface TetrisGame {
  start(): void; // registra listeners y arranca el loop
  pause(): void;
  resume(): void; // reinicia lastTime
  restart(): void; // score 0, nivel 1, tablero vacío
  destroy(): void; // idempotente: cancela rAF, timers y listeners
  setInput(action: TetrisAction, down: boolean): void; // teclado y táctil
}

type GameState = "playing" | "gameover";
type RepeatAction = "left" | "right" | "down";

const KEY_ACTIONS: Record<string, TetrisAction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowUp: "rotate",
  KeyX: "rotate",
  Space: "drop",
};

const PREVENT_DEFAULT_KEYS = Object.keys(KEY_ACTIONS);

const KICKS = [0, -1, 1, -2, 2];
const DAS_DELAY = 170; // ms antes de empezar a repetir
const DAS_RATE = 50; // ms entre repeticiones
const MAX_DT = 50; // ms

function dropInterval(level: number): number {
  return Math.max(100, 1000 - (level - 1) * 90);
}

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
  options?: { color?: string },
): TetrisGame {
  const color = options?.color ?? "#fff";
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  // ── Estado ─────────────────────────────────────────────────────────────────
  let board: Board = createBoard();
  let current: Piece | null = null;
  let next: Piece | null = null;
  let score = 0;
  let lines = 0;
  let level = 1;
  let state: GameState = "playing";
  let dropAccum = 0;

  // Últimos valores notificados: los callbacks solo se llaman si cambian
  let reportedScore = -1;
  let reportedLevel = -1;

  function report(): void {
    if (score !== reportedScore) {
      reportedScore = score;
      callbacks.onScore(score);
    }
    if (level !== reportedLevel) {
      reportedLevel = level;
      callbacks.onLevel(level);
    }
  }

  // ── Reglas ─────────────────────────────────────────────────────────────────
  function ghostY(piece: Piece): number {
    let gy = piece.y;
    while (!collide(board, piece.shape, piece.x, gy + 1)) gy++;
    return gy;
  }

  function spawn(): void {
    current = next ?? randomPiece();
    next = randomPiece();
    if (collide(board, current.shape, current.x, current.y)) {
      state = "gameover";
      clearInput();
      report();
      callbacks.onGameOver(score);
    }
  }

  function lock(): void {
    if (!current) return;
    board = merge(board, current);
    const result = clearLines(board);
    board = result.board;
    if (result.cleared > 0) {
      score += (LINE_SCORES[result.cleared] ?? 0) * level; // nivel previo
      lines += result.cleared;
      level = Math.floor(lines / 10) + 1;
    }
    dropAccum = 0;
    spawn();
    report();
  }

  function tryMove(dx: number): void {
    if (!current || state !== "playing") return;
    if (!collide(board, current.shape, current.x + dx, current.y)) {
      current.x += dx;
    }
  }

  function softDrop(): void {
    if (!current || state !== "playing") return;
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      dropAccum = 0;
      report();
    }
  }

  function hardDrop(): void {
    if (!current || state !== "playing") return;
    const gy = ghostY(current);
    score += 2 * (gy - current.y);
    current.y = gy;
    lock();
  }

  function tryRotate(): void {
    if (!current || state !== "playing") return;
    const rotated = rotateCW(current.shape);
    for (const kick of KICKS) {
      if (!collide(board, rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function initGame(): void {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    state = "playing";
    dropAccum = 0;
    next = randomPiece();
    spawn();
    report();
  }

  // ── Input (auto-repeat propio; ignora KeyboardEvent.repeat) ────────────────
  const held: Record<RepeatAction, boolean> = {
    left: false,
    right: false,
    down: false,
  };
  const repeatTimer: Record<RepeatAction, number> = {
    left: 0,
    right: 0,
    down: 0,
  };
  const oneShotHeld = { rotate: false, drop: false };
  let active = false; // true entre start() y destroy(), y no pausado

  function clearInput(): void {
    held.left = held.right = held.down = false;
    repeatTimer.left = repeatTimer.right = repeatTimer.down = 0;
    oneShotHeld.rotate = oneShotHeld.drop = false;
  }

  function step(action: RepeatAction): void {
    if (action === "left") tryMove(-1);
    else if (action === "right") tryMove(1);
    else softDrop();
  }

  function setInput(action: TetrisAction, down: boolean): void {
    if (action === "rotate" || action === "drop") {
      if (down) {
        if (!active || state !== "playing" || oneShotHeld[action]) return;
        oneShotHeld[action] = true;
        if (action === "rotate") tryRotate();
        else hardDrop();
      } else {
        oneShotHeld[action] = false;
      }
      return;
    }
    if (down) {
      if (!active || state !== "playing" || held[action]) return;
      held[action] = true;
      repeatTimer[action] = -DAS_DELAY; // espera el retardo inicial
      step(action);
    } else {
      held[action] = false;
      repeatTimer[action] = 0;
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    const action = KEY_ACTIONS[e.code];
    if (action) setInput(action, true);
  }

  function onKeyUp(e: KeyboardEvent): void {
    const action = KEY_ACTIONS[e.code];
    if (action) setInput(action, false);
  }

  function onBlur(): void {
    clearInput();
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dtMs: number): void {
    if (state !== "playing" || !current) return;

    // Auto-repeat de ← → ↓
    for (const action of ["left", "right", "down"] as const) {
      if (!held[action]) continue;
      repeatTimer[action] += dtMs;
      while (
        held[action] &&
        state === "playing" &&
        repeatTimer[action] >= DAS_RATE
      ) {
        repeatTimer[action] -= DAS_RATE;
        step(action);
      }
    }
    if (state !== "playing" || !current) return;

    // Gravedad
    dropAccum += dtMs;
    const interval = dropInterval(level);
    while (dropAccum >= interval && state === "playing" && current) {
      dropAccum -= interval;
      if (!collide(board, current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lock();
      }
    }
  }

  // ── Draw (sin HUD ni overlay: los pinta la plataforma) ─────────────────────
  function drawCell(x: number, y: number, type: number, alpha = 1): void {
    if (!ctx) return;
    const c = COLORS[type];
    if (!c) return;
    const pad = 1.5;
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = c;
    ctx.fillRect(x + pad, y + pad, BLOCK - pad * 2, BLOCK - pad * 2);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.shadowColor = c;
    ctx.shadowBlur = alpha < 1 ? 0 : 8;
    ctx.strokeRect(x + pad, y + pad, BLOCK - pad * 2, BLOCK - pad * 2);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function drawWell(): void {
    if (!ctx) return;
    // Cuadrícula
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(WELL_X + c * BLOCK, 0);
      ctx.lineTo(WELL_X + c * BLOCK, WELL_H);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(WELL_X, r * BLOCK);
      ctx.lineTo(WELL_X + WELL_W, r * BLOCK);
    }
    ctx.stroke();
    // Marco
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.strokeRect(WELL_X, 0, WELL_W, WELL_H);
    ctx.shadowBlur = 0;
  }

  function drawNext(): void {
    if (!ctx || !next) return;
    ctx.fillStyle = color;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("SIGUIENTE", NEXT_X, NEXT_Y - 12);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.strokeRect(NEXT_X, NEXT_Y, NEXT_SIZE, NEXT_SIZE);
    ctx.globalAlpha = 1;

    // Centrar la forma (solo celdas ocupadas) dentro del panel 4×4
    const { shape, type } = next;
    let minR = shape.length;
    let maxR = -1;
    let minC = shape[0].length;
    let maxC = -1;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
    const w = (maxC - minC + 1) * BLOCK;
    const h = (maxR - minR + 1) * BLOCK;
    const ox = NEXT_X + (NEXT_SIZE - w) / 2 - minC * BLOCK;
    const oy = NEXT_Y + (NEXT_SIZE - h) / 2 - minR * BLOCK;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) drawCell(ox + c * BLOCK, oy + r * BLOCK, type);
      }
    }
  }

  function draw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawWell();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) drawCell(WELL_X + c * BLOCK, r * BLOCK, board[r][c]);
      }
    }

    if (current && state === "playing") {
      const gy = ghostY(current);
      for (let r = 0; r < current.shape.length; r++) {
        for (let c = 0; c < current.shape[r].length; c++) {
          if (!current.shape[r][c]) continue;
          if (gy + r >= 0) {
            drawCell(
              WELL_X + (current.x + c) * BLOCK,
              (gy + r) * BLOCK,
              current.type,
              0.2,
            );
          }
        }
      }
      for (let r = 0; r < current.shape.length; r++) {
        for (let c = 0; c < current.shape[r].length; c++) {
          if (!current.shape[r][c] || current.y + r < 0) continue;
          drawCell(
            WELL_X + (current.x + c) * BLOCK,
            (current.y + r) * BLOCK,
            current.type,
          );
        }
      }
    }

    drawNext();
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let running = false;
  let destroyed = false;

  function loop(ts: number): void {
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop(): void {
    if (running || destroyed) return;
    running = true;
    active = true;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop(): void {
    running = false;
    active = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  let listening = false;

  return {
    start() {
      if (destroyed) return;
      if (!listening) {
        listening = true;
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", onBlur);
      }
      clearInput();
      initGame();
      draw();
      startLoop();
    },
    pause() {
      stopLoop();
      clearInput();
    },
    resume() {
      startLoop(); // reinicia lastTime: evita un dt enorme tras la pausa
    },
    restart() {
      if (destroyed) return;
      clearInput();
      initGame();
      draw();
      startLoop();
    },
    destroy() {
      destroyed = true;
      stopLoop();
      if (listening) {
        listening = false;
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur);
      }
      clearInput();
    },
    setInput,
  };
}
