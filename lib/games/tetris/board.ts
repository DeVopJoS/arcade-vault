import { COLS, ROWS, type Board, type Piece, type Shape } from "./pieces";

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

/** true si `shape` en (x, y) sale del pozo o pisa una celda ocupada. */
export function collide(
  board: Board,
  shape: Shape,
  x: number,
  y: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

/** Devuelve un tablero nuevo con la pieza fijada (no muta el original). */
export function merge(board: Board, piece: Piece): Board {
  const next = board.map((row) => [...row]);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      const v = piece.shape[r][c];
      if (!v) continue;
      const by = piece.y + r;
      const bx = piece.x + c;
      if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) next[by][bx] = v;
    }
  }
  return next;
}

/** Elimina filas completas. Devuelve tablero nuevo y número de filas borradas. */
export function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter((row) => row.some((v) => v === 0));
  const cleared = ROWS - kept.length;
  if (cleared === 0) return { board, cleared: 0 };
  const empty = Array.from({ length: cleared }, () =>
    new Array<number>(COLS).fill(0),
  );
  return { board: [...empty, ...kept], cleared };
}
