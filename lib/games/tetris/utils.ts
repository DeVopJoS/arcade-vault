import { BLOCK, COLS, PIECES, PIECE_TYPES, ROWS, type Piece } from "./pieces";

// Resolución lógica fija 480×600: pozo 300×600 en x=40, panel SIGUIENTE a la derecha.
export const WIDTH = 480;
export const HEIGHT = 600;
export const WELL_X = 40;
export const WELL_W = COLS * BLOCK; // 300
export const WELL_H = ROWS * BLOCK; // 600

// Panel "SIGUIENTE": 4×4 celdas de 30 px.
export const NEXT_X = WELL_X + WELL_W + 20; // 360
export const NEXT_Y = 60;
export const NEXT_SIZE = 4 * BLOCK; // 120

/** Traza (sin pintar) las líneas internas de la cuadrícula del pozo. */
export function traceWellGrid(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(WELL_X + c * BLOCK, 0);
    ctx.lineTo(WELL_X + c * BLOCK, WELL_H);
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(WELL_X, r * BLOCK);
    ctx.lineTo(WELL_X + WELL_W, r * BLOCK);
  }
}

/** Pieza aleatoria uniforme entre las 8. Llamar solo tras montar (usa Math.random). */
export function randomPiece(): Piece {
  const type = Math.floor(Math.random() * PIECE_TYPES) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}
