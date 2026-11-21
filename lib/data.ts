// Mock data compartida (port de references/templates/data.jsx)

export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type CoverClass =
  | "cover-bricks"
  | "cover-tetro"
  | "cover-snake"
  | "cover-glot"
  | "cover-invaders"
  | "cover-rocas"
  | "cover-rana"
  | "cover-duelo";
export type NeonColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: CoverClass;
  color: NeonColor;
  best: number;
  plays: string;
}

export const GAMES: Game[] = [
  {
    id: "rocas",
    title: "ROCAS",
    short: "Pulveriza asteroides en gravedad cero.",
    long: "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.",
    cat: "SHOOTER",
    cover: "cover-rocas",
    color: "yellow",
    best: 41200,
    plays: "15.6K",
  },
  {
    id: "caida",
    title: "CAÍDA",
    short: "Encaja bloques antes de que toquen el techo.",
    long: "Ocho piezas caen sin pausa sobre un pozo de 10×20. Rota, desliza y completa filas para borrarlas. Cada 10 líneas la caída se acelera.",
    cat: "PUZZLE",
    cover: "cover-tetro",
    color: "magenta",
    best: 0,
    plays: "0",
  },
  {
    id: "bloque-buster",
    title: "BLOQUE BUSTER",
    short: "Rompe la muralla de neón con una sola pelota.",
    long: "Mueve la paleta, mantén la pelota en juego y derriba cada bloque. Cinco niveles con muros distintos y una pelota cada vez más veloz. Tienes tres vidas.",
    cat: "ARCADE",
    cover: "cover-bricks",
    color: "cyan",
    best: 0,
    plays: "0",
  },
  {
    id: "serpentina",
    title: "SERPENTINA",
    short: "Come, crece y no te muerdas la cola.",
    long: "Guía a la serpiente por la rejilla, devora frutas y crece sin chocar con las paredes ni contigo misma. Cada cinco frutas el ritmo se acelera.",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
    best: 0,
    plays: "0",
  },
];

export const CATS: ("TODOS" | Category)[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
];

export const PLAYERS: string[] = [
  "PX_KAI",
  "NEONFOX",
  "Z3R0COOL",
  "M00NRYU",
  "VAULT_07",
  "GLITCHA",
  "ATARI_KID",
  "CYBER_LU",
  "MAGENTA88",
  "SCANLINE",
  "BIT_LORD",
  "ARKADYA",
  "DROID_X",
  "RGB_QUEEN",
  "PIXEL_DAD",
  "RETROVIRA",
  "VECTORX",
  "JOY_STK",
];

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/2026"
}

export function seededScores(seed: number, count = 12): ScoreRow[] {
  let s = seed;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const used = new Set<string>();
  const rows: ScoreRow[] = [];
  for (let i = 0; i < count; i++) {
    let name: string;
    do {
      name = PLAYERS[Math.floor(rand() * PLAYERS.length)];
    } while (used.has(name) && used.size < PLAYERS.length);
    used.add(name);
    const base = Math.floor(50000 + rand() * 250000);
    const score = base - i * Math.floor(2000 + rand() * 4000);
    const day = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
    const mon = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
    rows.push({
      rank: i + 1,
      name,
      score: Math.max(score, 1000),
      date: `${day}/${mon}/2026`,
    });
  }
  return rows
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
