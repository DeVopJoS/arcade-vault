import { Asteroid, Bullet, POINTS, Particle, Ship } from "./entities";
import { H, W, dist, rand } from "./utils";

export interface AsteroidsCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export type AsteroidsAction = "left" | "right" | "thrust" | "fire";

export interface AsteroidsGame {
  start(): void; // registra listeners y arranca el loop
  pause(): void;
  resume(): void;
  restart(): void; // score 0, 3 vidas, nivel 1
  destroy(): void; // cancela rAF y quita listeners
  setInput(action: AsteroidsAction, down: boolean): void; // táctil
}

type GameState = "playing" | "dead" | "gameover";

const KEY_ACTIONS: Record<string, AsteroidsAction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "thrust",
  Space: "fire",
};

const PREVENT_DEFAULT_KEYS = [
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
];

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
  options?: { color?: string },
): AsteroidsGame {
  const color = options?.color ?? "#fff";
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  // ── Input ──────────────────────────────────────────────────────────────────
  const input = { left: false, right: false, thrust: false, fire: false };
  let fireQueued = false;

  function setInput(action: AsteroidsAction, down: boolean): void {
    // El disparo se dispara una vez por pulsación (no por repetición)
    if (action === "fire" && down && !input.fire) fireQueued = true;
    input[action] = down;
  }

  function clearInput(): void {
    input.left = input.right = input.thrust = input.fire = false;
    fireQueued = false;
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
    const action = KEY_ACTIONS[e.code];
    if (action) setInput(action, true);
  }

  function onKeyUp(e: KeyboardEvent): void {
    const action = KEY_ACTIONS[e.code];
    if (action) setInput(action, false);
  }

  // ── Estado ─────────────────────────────────────────────────────────────────
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: GameState = "playing";
  let deadTimer = 0;

  // Últimos valores notificados: los callbacks solo se llaman si cambian
  let reportedScore = -1;
  let reportedLives = -1;
  let reportedLevel = -1;

  function report(): void {
    if (score !== reportedScore) {
      reportedScore = score;
      callbacks.onScore(score);
    }
    if (lives !== reportedLives) {
      reportedLives = lives;
      callbacks.onLives(lives);
    }
    if (level !== reportedLevel) {
      reportedLevel = level;
      callbacks.onLevel(level);
    }
  }

  function spawnAsteroids(count: number): void {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame(): void {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    deadTimer = 0;
    fireQueued = false;
    spawnAsteroids(4);
    report();
  }

  function nextLevel(): void {
    level++;
    bullets = [];
    particles = [];
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8): void {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip(): void {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      state = "gameover";
      report();
      callbacks.onGameOver(score);
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function updateParticles(dt: number): void {
    particles.forEach((p) => p.update(dt));
    particles = particles.filter((p) => !p.dead);
  }

  function update(dt: number): void {
    if (state === "gameover") {
      updateParticles(dt);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      updateParticles(dt);
      asteroids.forEach((a) => a.update(dt));
      fireQueued = false;
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (fireQueued) {
      fireQueued = false;
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt, input);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (state === "playing" && asteroids.length === 0) nextLevel();

    report();
  }

  // ── Draw (sin HUD ni overlay: los pinta la plataforma) ─────────────────────
  function draw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    // Brillo neón compartido por todos los trazos
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    particles.forEach((p) => p.draw(ctx, color));
    asteroids.forEach((a) => a.draw(ctx, color));
    bullets.forEach((b) => b.draw(ctx, color));
    ship.draw(ctx, color);
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let running = false;
  let destroyed = false;

  function loop(ts: number): void {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop(): void {
    if (running || destroyed) return;
    running = true;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop(): void {
    running = false;
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
      }
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
      }
      clearInput();
    },
    setInput,
  };
}
