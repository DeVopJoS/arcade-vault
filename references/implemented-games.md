# Juegos implementados

Fuentes: `lib/data.ts` (catálogo), `lib/games/registry.ts` (registry), Supabase (`scores`). Actualizado: 2026-11-22.

| id              | Título        | Categoría | Spec | Canvas                            | Lógica                 | Vidas | Touch |
| --------------- | ------------- | --------- | ---- | --------------------------------- | ---------------------- | ----- | ----- |
| `rocas`         | ROCAS         | SHOOTER   | 05   | `components/asteroids-canvas.tsx` | `lib/games/asteroids/` | Sí    | —     |
| `caida`         | CAÍDA         | PUZZLE    | 07   | `components/tetris-canvas.tsx`    | `lib/games/tetris/`    | No    | —     |
| `bloque-buster` | BLOQUE BUSTER | ARCADE    | 08   | `components/arkanoid-canvas.tsx`  | `lib/games/arkanoid/`  | Sí    | —     |
| `serpentina`    | SERPENTINA    | ARCADE    | 09   | `components/snake-canvas.tsx`     | `lib/games/snake/`     | No    | D-pad |

## Descripción

- **ROCAS** (Asteroids): nave triangular, dispara y divide asteroides, OVNIs.
- **CAÍDA** (Tetris): pozo 10×20, 8 piezas, velocidad +cada 10 líneas.
- **BLOQUE BUSTER** (Arkanoid): 5 niveles, 3 vidas, pelota cada vez más rápida.
- **SERPENTINA** (Snake): frutas, ritmo sube cada 5 frutas.

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
