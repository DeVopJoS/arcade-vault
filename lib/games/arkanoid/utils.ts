// Resolución lógica fija 800×600 (4:3, igual que .crt-screen).
export const WIDTH = 800;
export const HEIGHT = 600;

export const PADDLE_W = 81;
export const PADDLE_H = 14;
export const PADDLE_Y = 560;
export const PADDLE_SPEED = 400; // px/s

export const BALL_SIZE = 16;
export const BASE_BALL_VX = 200;
export const BASE_BALL_VY = -300;

export const INITIAL_LIVES = 3;
export const BLOCK_SCORE = 10;

export const MAX_DT = 0.05; // s
export const MAX_STEP = 8; // px: desplazamiento máximo de la pelota por subpaso

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Posición x del paddle (esquina izquierda) centrado en un puntero, acotada al canvas. */
export function paddleXFromPointer(
  clientX: number,
  rect: { left: number; width: number },
): number {
  if (rect.width <= 0) return (WIDTH - PADDLE_W) / 2;
  const logicalX = ((clientX - rect.left) * WIDTH) / rect.width;
  return clamp(logicalX - PADDLE_W / 2, 0, WIDTH - PADDLE_W);
}
