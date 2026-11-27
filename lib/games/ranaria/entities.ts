// Ranaria — carriles (carretera y río): construcción y movimiento.
import {
  CELL,
  COLS,
  GOAL_COLS,
  GOAL_WIDTH,
  isRiverRow,
  isRoadRow,
  isSubmerged,
  speedFactorFor,
  TURTLE_CYCLE_MS,
  type Entity,
  type EntityType,
  type Frog,
  type Lane,
  type LaneKind,
} from "./utils";

/** Duración de un frame de referencia (las velocidades son px/frame a 60 fps). */
const FRAME_MS = 1000 / 60;

interface LaneTemplate {
  row: number;
  kind: LaneKind;
  type: EntityType;
  /** Ancho de cada entidad (celdas); se repite en ciclo. */
  widths: readonly number[];
  /** Hueco tras cada entidad (celdas). */
  gap: number;
  /** px/frame a 60 fps en nivel 1. */
  speed: number;
  dir: 1 | -1;
}

// Carretera: 1.5–4 px/frame, sentidos alternos, huecos ≥ 2 celdas.
// Río: 1–3 px/frame; filas 6 y 3 son tortugas (grupos de 2–3), resto troncos.
const TEMPLATES: readonly LaneTemplate[] = [
  // Río
  {
    row: 1,
    kind: "river",
    type: "log",
    widths: [4, 3],
    gap: 2,
    speed: 2,
    dir: -1,
  },
  {
    row: 2,
    kind: "river",
    type: "log",
    widths: [2, 3],
    gap: 2,
    speed: 1,
    dir: 1,
  },
  {
    row: 3,
    kind: "river",
    type: "turtle",
    widths: [2],
    gap: 2,
    speed: 1.8,
    dir: -1,
  },
  {
    row: 4,
    kind: "river",
    type: "log",
    widths: [4],
    gap: 3,
    speed: 2.5,
    dir: 1,
  },
  {
    row: 5,
    kind: "river",
    type: "log",
    widths: [3],
    gap: 3,
    speed: 1.5,
    dir: -1,
  },
  {
    row: 6,
    kind: "river",
    type: "turtle",
    widths: [3],
    gap: 2,
    speed: 1.2,
    dir: 1,
  },
  // Carretera
  {
    row: 8,
    kind: "road",
    type: "truck",
    widths: [3, 2],
    gap: 5,
    speed: 2.5,
    dir: -1,
  },
  { row: 9, kind: "road", type: "car", widths: [1], gap: 6, speed: 4, dir: 1 },
  {
    row: 10,
    kind: "road",
    type: "truck",
    widths: [2],
    gap: 4,
    speed: 1.8,
    dir: -1,
  },
  {
    row: 11,
    kind: "road",
    type: "car",
    widths: [1],
    gap: 4,
    speed: 2.2,
    dir: 1,
  },
  {
    row: 12,
    kind: "road",
    type: "car",
    widths: [1],
    gap: 3,
    speed: 1.5,
    dir: -1,
  },
];

/** Número de variantes visuales por tipo (la skin las interpreta). */
const VARIANTS: Record<EntityType, number> = {
  car: 3,
  truck: 2,
  log: 1,
  turtle: 1,
};

/** Desfase de fase entre grupos de tortugas consecutivos (ms). */
const TURTLE_PHASE_STEP = 1700;

function buildLane(t: LaneTemplate, level: number): Lane {
  const maxW = Math.max(...t.widths);
  const entities: Entity[] = [];
  // Se repite el patrón hasta cubrir la pantalla + el ancho máximo, de modo que
  // el reingreso ocurre siempre fuera de la vista y los huecos se conservan.
  let cursor = 0;
  let i = 0;
  while (cursor < COLS + maxW || i % t.widths.length !== 0) {
    const width = t.widths[i % t.widths.length];
    entities.push({
      col: cursor,
      width,
      type: t.type,
      variant: (i + t.row) % VARIANTS[t.type],
      phase:
        t.type === "turtle"
          ? (i * TURTLE_PHASE_STEP + t.row * 500) % TURTLE_CYCLE_MS
          : undefined,
    });
    cursor += width + t.gap;
    i++;
  }
  const span = cursor;
  // Desfase inicial por fila para que los carriles no arranquen alineados.
  const shift = (t.row * 3) % span;
  for (const e of entities) e.col = wrapCol(e.col + shift, span, maxW);

  return {
    row: t.row,
    kind: t.kind,
    speed: t.speed * speedFactorFor(level),
    dir: t.dir,
    span,
    entities,
  };
}

/** Normaliza `col` al intervalo [-maxW, span - maxW) (siempre fuera de vista en los extremos). */
function wrapCol(col: number, span: number, maxW: number): number {
  const lo = -maxW;
  return lo + ((((col - lo) % span) + span) % span);
}

function maxWidth(lane: Lane): number {
  let m = 0;
  for (const e of lane.entities) if (e.width > m) m = e.width;
  return m;
}

/** Carriles de río y carretera para un nivel (velocidades ×1.15 por nivel). */
export function buildLanes(level: number): Lane[] {
  return TEMPLATES.map((t) => buildLane(t, level));
}

/** Desplazamiento horizontal de un carril en `dt` ms, en celdas (con signo). */
export function laneDelta(lane: Lane, dt: number): number {
  return (lane.speed * lane.dir * dt) / FRAME_MS / CELL;
}

/** Avanza entidades (con loop) y el ciclo de inmersión de las tortugas. */
export function updateLanes(lanes: Lane[], dt: number): void {
  for (const lane of lanes) {
    const delta = laneDelta(lane, dt);
    const maxW = maxWidth(lane);
    for (const e of lane.entities) {
      e.col = wrapCol(e.col + delta, lane.span, maxW);
      if (e.type === "turtle") {
        e.phase = ((e.phase ?? 0) + dt) % TURTLE_CYCLE_MS;
      }
    }
  }
}

export function laneAt(lanes: readonly Lane[], row: number): Lane | null {
  return lanes.find((l) => l.row === row) ?? null;
}

// ---------- Colisiones y soporte ----------
// Se usa el centro de la rana (col + 0.5). Las entidades viven en
// [-maxW, span - maxW), así que la parte visible nunca necesita wrap extra.

function covers(e: Entity, x: number): boolean {
  return x >= e.col && x < e.col + e.width;
}

/** ¿Algún vehículo de la fila de la rana cubre su centro? */
export function hitsVehicle(frog: Frog, lanes: readonly Lane[]): boolean {
  if (!isRoadRow(frog.row)) return false;
  const lane = laneAt(lanes, frog.row);
  if (!lane) return false;
  const x = frog.col + 0.5;
  return lane.entities.some((e) => covers(e, x));
}

/**
 * Tronco o tortuga a flote bajo el centro de la rana en su fila de río, o
 * null (agua o tortuga sumergida = sin apoyo).
 */
export function getSupport(frog: Frog, lanes: readonly Lane[]): Entity | null {
  if (!isRiverRow(frog.row)) return null;
  const lane = laneAt(lanes, frog.row);
  if (!lane) return null;
  const x = frog.col + 0.5;
  const e = lane.entities.find((en) => covers(en, x));
  if (!e || isSubmerged(e)) return null;
  return e;
}

/** Índice de la boca destino que contiene el centro de `col`, o -1 (seto). */
export function goalAt(col: number): number {
  const x = col + 0.5;
  return GOAL_COLS.findIndex((g) => x >= g && x < g + GOAL_WIDTH);
}
