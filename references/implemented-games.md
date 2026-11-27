# Juegos implementados

Fuentes: `lib/data.ts` (catálogo), `lib/games/registry.ts` (registry), Supabase (`scores`). Actualizado: 2026-11-26.

| id              | Título        | Categoría | Spec          | Canvas                            | Lógica                 | Vidas | Touch                     |
| --------------- | ------------- | --------- | ------------- | --------------------------------- | ---------------------- | ----- | ------------------------- |
| `rocas`         | ROCAS         | SHOOTER   | 05            | `components/asteroids-canvas.tsx` | `lib/games/asteroids/` | Sí    | Gamepad                   |
| `caida`         | CAÍDA         | PUZZLE    | 07            | `components/tetris-canvas.tsx`    | `lib/games/tetris/`    | No    | Gamepad                   |
| `bloque-buster` | BLOQUE BUSTER | ARCADE    | 08            | `components/arkanoid-canvas.tsx`  | `lib/games/arkanoid/`  | Sí    | Gamepad                   |
| `serpentina`    | SERPENTINA    | ARCADE    | 09            | `components/snake-canvas.tsx`     | `lib/games/snake/`     | No    | Gamepad                   |
| `ranaria`       | RANARIA       | ARCADE    | GJ-frogger 01 | `components/ranaria-canvas.tsx`   | `lib/games/ranaria/`   | Sí    | Pendiente (mobile-porter) |

Táctil (SPEC 10): `gamepad` declarado en `lib/games/registry.ts` y pintado por `components/gamepad.tsx` bajo el CRT (solo `pointer: coarse`). Mapeo: Rocas ▲ empuje · ◀▶ rotar · A disparo; Caída ▼◀▶ · A rotar · B caída; Bloque Buster ◀▶ (+ arrastre); Serpentina ▲▼◀▶ (+ swipe).

## Descripción

- **ROCAS** (Asteroids): nave triangular, dispara y divide asteroides, OVNIs.
- **CAÍDA** (Tetris): pozo 10×20, 8 piezas, velocidad +cada 10 líneas.
- **BLOQUE BUSTER** (Arkanoid): 5 niveles, 3 vidas, pelota cada vez más rápida.
- **SERPENTINA** (Snake): frutas, ritmo sube cada 5 frutas.
- **RANARIA** (cruce carretera + río, spec `specs/game-jam/frogger/01-frogger-core.md`): rejilla 16×14 (640×560), saltos de 1 celda (120 ms), 5 carriles de tráfico, río con troncos y tortugas que se sumergen, 5 bocas por ronda, 3 vidas, temporizador 15 s (−1 s/nivel, mín. 8), velocidad ×1.15/nivel. Skins `clasico`/`neon`/`retro`.

## Base de datos (Supabase)

- Tabla pública: `scores` (RLS on, 4 filas). No hay tabla de juegos; catálogo es mock en `lib/data.ts`.
- Vistas usadas por código: `scores_best`, `game_stats`.

Estadísticas en `scores` al 2026-11-22:

| game_id         | Partidas | Mejor puntaje |
| --------------- | -------- | ------------- |
| `bloque-buster` | 1        | 840           |
| `caida`         | 2        | 2074          |
| `rocas`         | 1        | 70            |
| `serpentina`    | 0        | —             |
