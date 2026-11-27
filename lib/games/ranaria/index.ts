// Ranaria — motor del juego (canvas 2D, sin dependencias de React).
import {
  buildLanes,
  getSupport,
  goalAt,
  hitsVehicle,
  laneAt,
  laneDelta,
  updateLanes,
} from "./entities";
import { DEFAULT_SKIN, isSkinId, SKINS, type SkinId } from "./skins";
import {
  CELL,
  COLS,
  DEATH_MS,
  DIR_VECTORS,
  GOAL_COLS,
  GOAL_SCORE,
  GOAL_WIDTH,
  HEIGHT,
  isRiverRow,
  isRoadRow,
  JUMP_MS,
  lerp,
  MAX_DT,
  ROUND_SCORE,
  ROW_GOALS,
  ROW_SCORE,
  ROW_START,
  START_COL,
  START_LIVES,
  submergeLevel,
  TIME_BONUS_PER_SEC,
  timeLimitFor,
  WIDTH,
  type Direction,
  type Frog,
  type Lane,
} from "./utils";

export interface RanariaCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export type RanariaAction = Direction;

export interface RanariaGame {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
  setInput(action: RanariaAction, down: boolean): void;
  /** Cambia la skin y redibuja sin reiniciar; key inválida → DEFAULT_SKIN. */
  setSkin(key: string): void;
}

export type { SkinId } from "./skins";
export { DEFAULT_SKIN, SKIN_OPTIONS, SKINS } from "./skins";

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
};
const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/** Parpadeo de muerte: alterna cada 100 ms. */
const BLINK_MS = 100;

function newFrog(): Frog {
  return {
    col: START_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    fromCol: START_COL,
    fromRow: ROW_START,
    targetCol: START_COL,
    targetRow: ROW_START,
    facing: "up",
  };
}

export function createRanariaGame(
  canvas: HTMLCanvasElement,
  callbacks: RanariaCallbacks,
  options: { skin?: string } = {},
): RanariaGame {
  const ctx = canvas.getContext("2d");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  let skinId: SkinId = isSkinId(options.skin) ? options.skin : DEFAULT_SKIN;
  let skin = SKINS[skinId];

  let lanes: Lane[] = buildLanes(1);
  let frog: Frog = newFrog();
  let goals: boolean[] = GOAL_COLS.map(() => false);
  let pendingDir: Direction | null = null;

  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let timeLimit = timeLimitFor(1) * 1000; // ms
  let timeLeft = timeLimit;
  let bestRow = ROW_START; // fila más alta alcanzada en el trayecto actual
  let deathAge: number | null = null; // ms desde la muerte; null = viva

  let started = false;
  let destroyed = false;
  let paused = false;
  let ended = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // ---------- Estado ----------

  function setScore(v: number) {
    if (v === score) return;
    score = v;
    callbacks.onScore(score);
  }

  /** Rana a la base, trayecto y temporizador nuevos. */
  function resetFrog() {
    frog = newFrog();
    bestRow = ROW_START;
    pendingDir = null;
    timeLimit = timeLimitFor(level) * 1000;
    timeLeft = timeLimit;
  }

  /** Estado inicial de partida. Emite score, vidas y nivel una vez. */
  function resetGame() {
    level = 1;
    lanes = buildLanes(level);
    goals = GOAL_COLS.map(() => false);
    score = 0;
    lives = START_LIVES;
    deathAge = null;
    ended = false;
    resetFrog();
    callbacks.onScore(score);
    callbacks.onLives(lives);
    callbacks.onLevel(level);
  }

  function finish() {
    if (ended) return;
    ended = true;
    cancelLoop();
    draw();
    callbacks.onGameOver(score);
  }

  // ---------- Lógica ----------

  function killFrog() {
    if (deathAge !== null || ended) return;
    lives = Math.max(0, lives - 1);
    callbacks.onLives(lives);
    deathAge = 0;
    frog.animating = false;
    pendingDir = null;
  }

  function completeRound() {
    setScore(score + ROUND_SCORE);
    goals = GOAL_COLS.map(() => false);
    level++;
    callbacks.onLevel(level);
    lanes = buildLanes(level);
    resetFrog();
  }

  function startJump(dir: Direction) {
    const v = DIR_VECTORS[dir];
    frog.facing = dir;
    const targetCol = frog.col + v.dx;
    const targetRow = frog.row + v.dy;
    // Sin salir por los bordes laterales, por debajo de la base ni por arriba.
    if (targetCol < 0 || targetCol > COLS - 1) return;
    if (targetRow < ROW_GOALS || targetRow > ROW_START) return;
    frog.animating = true;
    frog.animT = 0;
    frog.fromCol = frog.col;
    frog.fromRow = frog.row;
    frog.targetCol = targetCol;
    frog.targetRow = targetRow;
  }

  /** Fin del salto: puntuación por fila nueva, meta o peligro. */
  function land() {
    frog.animating = false;
    frog.col = frog.targetCol;
    frog.row = frog.targetRow;
    if (!isRiverRow(frog.row)) frog.col = Math.round(frog.col);

    if (frog.row < bestRow) {
      setScore(score + ROW_SCORE * (bestRow - frog.row));
      bestRow = frog.row;
    }

    if (frog.row === ROW_GOALS) {
      const idx = goalAt(frog.col);
      if (idx < 0 || goals[idx]) {
        killFrog(); // seto o boca ocupada
        return;
      }
      goals[idx] = true;
      const bonus = Math.floor(timeLeft / 1000) * TIME_BONUS_PER_SEC;
      setScore(score + GOAL_SCORE + bonus);
      if (goals.every(Boolean)) completeRound();
      else resetFrog();
    }
  }

  /** Peligros con la rana quieta: vehículo, agua/tortuga hundida, borde. */
  function checkHazards(dt: number) {
    if (isRoadRow(frog.row)) {
      if (hitsVehicle(frog, lanes)) killFrog();
      return;
    }
    if (isRiverRow(frog.row)) {
      const support = getSupport(frog, lanes);
      if (!support) {
        killFrog(); // agua o tortuga sumergida
        return;
      }
      const lane = laneAt(lanes, frog.row);
      if (lane) frog.col += laneDelta(lane, dt);
      const cx = frog.col + 0.5;
      if (cx < 0 || cx >= COLS) killFrog(); // arrastrada fuera
    }
  }

  function update(dt: number) {
    updateLanes(lanes, dt);

    if (deathAge !== null) {
      deathAge += dt;
      if (deathAge >= DEATH_MS) {
        deathAge = null;
        if (lives <= 0) finish();
        else resetFrog();
      }
      return;
    }

    if (!frog.animating && pendingDir) {
      const dir = pendingDir;
      pendingDir = null;
      startJump(dir);
    }

    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= JUMP_MS) land();
    }
    if (deathAge !== null) return;

    if (!frog.animating) checkHazards(dt);
    if (deathAge !== null) return;

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      killFrog();
    }
  }

  // ---------- Render ----------

  function draw() {
    if (!ctx) return;
    skin.drawBoard(ctx);

    goals.forEach((filled, i) => {
      if (!filled) return;
      const cx = (GOAL_COLS[i] + GOAL_WIDTH / 2) * CELL;
      skin.drawGoalFrog(ctx, cx, ROW_GOALS * CELL + CELL / 2 + 3);
    });

    for (const lane of lanes) {
      const y = lane.row * CELL;
      for (const e of lane.entities) {
        const x = e.col * CELL;
        if (x >= WIDTH || x + e.width * CELL <= 0) continue;
        if (e.type === "log") skin.drawLog(ctx, x, y, e.width);
        else if (e.type === "turtle")
          skin.drawTurtles(ctx, x, y, e.width, submergeLevel(e), lane.dir);
        else skin.drawVehicle(ctx, x, y, e.width, e.type, e.variant, lane.dir);
      }
    }

    // Rana (interpolada durante el salto; parpadea al morir).
    const t = frog.animating ? Math.min(1, frog.animT / JUMP_MS) : 0;
    const col = frog.animating
      ? lerp(frog.fromCol, frog.targetCol, t)
      : frog.col;
    const row = frog.animating
      ? lerp(frog.fromRow, frog.targetRow, t)
      : frog.row;
    const blinkOn =
      deathAge === null || Math.floor(deathAge / BLINK_MS) % 2 === 0;
    skin.drawFrog(
      ctx,
      (col + 0.5) * CELL,
      (row + 0.5) * CELL,
      frog.facing,
      frog.animating ? t : 0,
      blinkOn ? 1 : 0.15,
    );

    skin.drawHud(ctx, {
      score,
      level,
      lives,
      timeFrac: timeLimit > 0 ? timeLeft / timeLimit : 0,
    });
  }

  // ---------- Loop ----------

  function loop(ts: number) {
    rafId = null;
    if (destroyed || paused || ended) return;
    if (lastTime === null) lastTime = ts;
    const dt = Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    update(dt);
    if (ended) return;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId !== null || destroyed) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function cancelLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // ---------- Entrada ----------

  /** Encola un salto (máx. 1 en cola mientras dura la animación). */
  function queue(dir: Direction) {
    if (destroyed || paused || ended || deathAge !== null) return;
    pendingDir = dir;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (ARROW_KEYS.has(e.key)) e.preventDefault();
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEY_TO_DIR[e.key];
    if (dir) queue(dir);
  }
  function onBlur() {
    pendingDir = null;
  }

  // ---------- API ----------

  return {
    start() {
      if (started || destroyed) return;
      started = true;
      resetGame();
      draw();
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("blur", onBlur);
      startLoop();
    },
    pause() {
      if (destroyed || paused) return;
      paused = true;
      pendingDir = null;
      cancelLoop();
    },
    resume() {
      if (destroyed || !started || !paused) return;
      paused = false;
      if (!ended) startLoop(); // startLoop reinicia lastTime
    },
    restart() {
      if (destroyed || !started) return;
      cancelLoop();
      paused = false;
      resetGame();
      draw();
      startLoop();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelLoop();
      pendingDir = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    },
    setInput(action, down) {
      if (!down) return; // un salto por pulsación
      queue(action);
    },
    setSkin(key) {
      const next = isSkinId(key) ? key : DEFAULT_SKIN;
      if (next === skinId) return;
      skinId = next;
      skin = SKINS[next];
      // Solo render: score/vidas/nivel/estado intactos. Redibuja aunque esté en pausa.
      if (started && !destroyed) draw();
    },
  };
}
