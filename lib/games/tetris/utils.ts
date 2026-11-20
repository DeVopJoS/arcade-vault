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
