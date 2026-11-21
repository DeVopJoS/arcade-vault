import {
  collideAABB,
  createBall,
  createBlocks,
  createPaddle,
  drawBall,
  drawBlock,
  drawExplosion,
  drawPaddle,
  EXPLOSION_DURATION,
  type Ball,
  type Block,
  type Explosion,
  type Paddle,
} from "./entities";
import { LEVELS, LEVEL_COUNT } from "./levels";
import {
  BASE_BALL_VX,
  BASE_BALL_VY,
  BLOCK_SCORE,
  clamp,
  HEIGHT,
  INITIAL_LIVES,
  MAX_DT,
  MAX_STEP,
  PADDLE_SPEED,
  paddleXFromPointer,
  WIDTH,
} from "./utils";

export interface ArkanoidCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void; // sin vidas o nivel 5 completado
}

export type ArkanoidAction = "left" | "right";

export interface ArkanoidGame {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
  setInput(action: ArkanoidAction, down: boolean): void;
}

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
  options: { color?: string } = {},
): ArkanoidGame {
  const color = options.color || "#00f5ff";
  const ctx = canvas.getContext("2d");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const paddle: Paddle = createPaddle();
  const ball: Ball = createBall();
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];

  let score = 0;
  let lives = INITIAL_LIVES;
  let level = 1;

  let started = false;
  let destroyed = false;
  let paused = false;
  let ended = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;
  const input = { left: false, right: false };

  // ---------- Estado ----------

  function setScore(v: number) {
    if (v === score) return;
    score = v;
    callbacks.onScore(score);
  }
  function setLives(v: number) {
    if (v === lives) return;
    lives = v;
    callbacks.onLives(lives);
  }
  function setLevel(v: number) {
    if (v === level) return;
    level = v;
    callbacks.onLevel(level);
  }

  function placeBall() {
    const speed = LEVELS[level - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    setLevel(n);
    blocks = createBlocks(LEVELS[n - 1]);
    explosions = [];
    placeBall();
  }

  /** Estado inicial de partida. Emite los tres valores una vez. */
  function resetGame() {
    score = 0;
    lives = INITIAL_LIVES;
    level = 1;
    ended = false;
    paddle.x = (WIDTH - paddle.w) / 2;
    blocks = createBlocks(LEVELS[0]);
    explosions = [];
    placeBall();
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

  // ---------- Física ----------

  /** Avanza la pelota un subpaso. Devuelve true si hubo que cortar el frame (vida perdida o nivel nuevo). */
  function stepBall(dt: number): boolean {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Paredes izquierda, derecha y techo
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= WIDTH) {
      ball.x = WIDTH - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    // Paddle: solo bajando, ventana de 8 px bajo la cara superior
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }

    // Bloques: uno por subpaso, invierte vy (como el original)
    for (const block of blocks) {
      if (!block.alive || !collideAABB(ball, block)) continue;
      block.alive = false;
      explosions.push({
        x: block.x,
        y: block.y,
        w: block.w,
        h: block.h,
        color: block.color,
        elapsed: 0,
      });
      setScore(score + BLOCK_SCORE);
      ball.vy = -ball.vy;
      if (blocks.every((b) => !b.alive)) {
        if (level < LEVEL_COUNT) {
          loadLevel(level + 1);
        } else {
          finish();
        }
        return true;
      }
      break;
    }

    // Pelota perdida
    if (ball.y > HEIGHT) {
      const remaining = Math.max(0, lives - 1);
      setLives(remaining);
      if (remaining <= 0) {
        finish();
      } else {
        placeBall();
      }
      return true;
    }
    return false;
  }

  function update(dt: number) {
    if (input.left) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (input.right)
      paddle.x = Math.min(WIDTH - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Subpasos para evitar atravesar bloques a alta velocidad
    const maxV = Math.max(Math.abs(ball.vx), Math.abs(ball.vy));
    const steps = Math.max(1, Math.ceil((maxV * dt) / MAX_STEP));
    const sub = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (stepBall(sub) || ended) break;
    }

    for (const e of explosions) e.elapsed += dt * 1000;
    explosions = explosions.filter((e) => e.elapsed < EXPLOSION_DURATION);
  }

  // ---------- Render ----------

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const b of blocks) if (b.alive) drawBlock(ctx, b, b.color);
    for (const e of explosions) drawExplosion(ctx, e);
    drawPaddle(ctx, paddle, color);
    drawBall(ctx, ball, color);
  }

  // ---------- Loop ----------

  function loop(ts: number) {
    rafId = null;
    if (destroyed || paused || ended) return;
    if (lastTime === null) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, MAX_DT);
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
    input.left = false;
    input.right = false;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    if (paused || ended) return;
    if (e.key === "ArrowLeft") input.left = true;
    else input.right = true;
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") input.left = false;
    else if (e.key === "ArrowRight") input.right = false;
  }
  function onPointerMove(e: PointerEvent) {
    if (paused || ended) return;
    paddle.x = clamp(
      paddleXFromPointer(e.clientX, canvas.getBoundingClientRect()),
      0,
      WIDTH - paddle.w,
    );
  }
  function onBlur() {
    clearInput();
  }

  // ---------- API ----------

  return {
    start() {
      if (started || destroyed) return;
      started = true;
      resetGame();
      draw();
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      canvas.addEventListener("pointermove", onPointerMove);
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
      clearInput();
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
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointermove", onPointerMove);
    },
    setInput(action, down) {
      if (destroyed || paused || ended) {
        if (!down) input[action] = false;
        return;
      }
      input[action] = down;
    },
  };
}
