import {
  cellCenter,
  createBurst,
  createSnake,
  DEATH_MS,
  drawEatEffect,
  drawFruit,
  drawGrid,
  drawParticles,
  drawSnake,
  EAT_MS,
  PULSE_MS,
  queueTurn,
  spawnFruit,
  stepSnake,
  updateParticles,
  type EatEffect,
  type Fruit,
  type Particle,
  type Snake,
} from "./entities";
import { FRUIT_SHEET } from "./sprites";
import {
  FRUIT_SCORE,
  HEIGHT,
  levelFor,
  MAX_DT,
  MAX_STEPS_PER_FRAME,
  stepIntervalFor,
  swipeToDirection,
  WIDTH,
  type Direction,
} from "./utils";

export interface SnakeCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void; // no se usa (hasLives:false); se acepta por contrato, no se invoca
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void; // choque o tablero lleno
}

export type SnakeAction = Direction;

export interface SnakeGame {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
  setInput(action: SnakeAction, down: boolean): void;
}

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

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
  options: { color?: string; spriteUrl?: string } = {},
): SnakeGame {
  const color = options.color || "#00ff88";
  const spriteUrl = options.spriteUrl || FRUIT_SHEET;
  const ctx = canvas.getContext("2d");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.touchAction = "none";

  let snake: Snake = createSnake();
  let fruit: Fruit | null = null;
  let eatEffects: EatEffect[] = [];
  let particles: Particle[] = [];
  let img: HTMLImageElement | null = null;

  let score = 0;
  let level = 1;
  let fruitsEaten = 0;
  let accumulator = 0; // ms hacia el siguiente paso
  let pulseAge = PULSE_MS; // ms desde que comió (>= PULSE_MS = sin pulso)
  let deathAge: number | null = null; // ms desde el choque; null = vivo

  let started = false;
  let destroyed = false;
  let paused = false;
  let ended = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let swipeStart: { x: number; y: number; id: number } | null = null;

  // ---------- Estado ----------

  function setScore(v: number) {
    if (v === score) return;
    score = v;
    callbacks.onScore(score);
  }
  function setLevel(v: number) {
    if (v === level) return;
    level = v;
    callbacks.onLevel(level);
  }

  /** Estado inicial de partida. Emite score y nivel una vez. */
  function resetGame() {
    snake = createSnake();
    fruit = spawnFruit(snake.segments, Math.random);
    eatEffects = [];
    particles = [];
    score = 0;
    level = 1;
    fruitsEaten = 0;
    accumulator = 0;
    pulseAge = PULSE_MS;
    deathAge = null;
    ended = false;
    clearInput();
    callbacks.onScore(score);
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

  function doStep() {
    const result = stepSnake(snake, fruit ? fruit.cell : null);
    if (result.collision) {
      deathAge = 0;
      accumulator = 0;
      return;
    }
    if (result.ate && fruit) {
      const c = cellCenter(fruit.cell);
      eatEffects.push({ x: c.x, y: c.y, kind: fruit.kind, age: 0 });
      particles.push(...createBurst(c.x, c.y, Math.random));
      pulseAge = 0;
      fruitsEaten++;
      setScore(score + FRUIT_SCORE);
      setLevel(levelFor(fruitsEaten));
      fruit = spawnFruit(snake.segments, Math.random);
      if (!fruit) {
        // Tablero lleno: victoria.
        finish();
      }
    }
  }

  function update(dt: number) {
    if (fruit) fruit.age += dt;
    for (const e of eatEffects) e.age += dt;
    eatEffects = eatEffects.filter((e) => e.age < EAT_MS);
    particles = updateParticles(particles, dt);
    if (pulseAge < PULSE_MS) pulseAge += dt;

    if (deathAge !== null) {
      deathAge += dt;
      if (deathAge >= DEATH_MS) finish();
      return;
    }

    const interval = stepIntervalFor(fruitsEaten);
    accumulator += dt;
    let steps = 0;
    while (accumulator >= interval && steps < MAX_STEPS_PER_FRAME) {
      accumulator -= interval;
      steps++;
      doStep();
      if (ended || deathAge !== null) return;
    }
    // Tope del acumulador: nunca más de un intervalo pendiente.
    if (accumulator > interval) accumulator = interval;
  }

  // ---------- Render ----------

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawGrid(ctx, color);

    if (fruit) drawFruit(ctx, img, fruit);
    for (const e of eatEffects) drawEatEffect(ctx, img, e);

    const dying = deathAge !== null;
    const progress = dying ? 1 : accumulator / stepIntervalFor(fruitsEaten);
    const pulse = pulseAge < PULSE_MS ? 1 - pulseAge / PULSE_MS : 0;
    // 3 destellos en DEATH_MS: visible/oculto 6 tramos iguales, empezando oculto.
    const visible =
      deathAge === null
        ? true
        : Math.floor((deathAge / DEATH_MS) * 6) % 2 === 1;
    drawSnake(ctx, snake, color, progress, pulse, visible);
    drawParticles(ctx, particles, color);
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

  function clearInput() {
    snake.queued = null;
    swipeStart = null;
  }

  function turn(dir: Direction) {
    if (destroyed || paused || ended || deathAge !== null) return;
    queueTurn(snake, dir);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (ARROW_KEYS.has(e.key)) e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEY_TO_DIR[e.key];
    if (dir) turn(dir);
  }
  function onBlur() {
    clearInput();
  }
  function onPointerDown(e: PointerEvent) {
    if (paused || ended) return;
    swipeStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }
  function onPointerUp(e: PointerEvent) {
    const s = swipeStart;
    swipeStart = null;
    if (!s || s.id !== e.pointerId) return;
    const dir = swipeToDirection(e.clientX - s.x, e.clientY - s.y);
    if (dir) turn(dir);
  }
  function onPointerCancel() {
    swipeStart = null;
  }

  // ---------- API ----------

  return {
    start() {
      if (started || destroyed) return;
      started = true;

      // Image solo aquí (nunca en carga de módulo ni en render). Si falla, hay fallback vectorial.
      const image = new Image();
      image.onload = () => {
        if (destroyed) return;
        img = image;
        if (paused || ended) draw();
      };
      image.onerror = () => {
        img = null;
      };
      image.src = spriteUrl;
      img = image;

      resetGame();
      draw();
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("blur", onBlur);
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerCancel);
      startLoop();
    },
    pause() {
      if (destroyed || paused) return;
      paused = true;
      clearInput();
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
      clearInput();
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
      img = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
    },
    setInput(action, down) {
      if (!down) return; // solo down=true gira
      turn(action);
    },
  };
}
