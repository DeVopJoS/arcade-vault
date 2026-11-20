# SPEC 07 — Juego Tetris (CAÍDA) integrado en el reproductor con leaderboard

> **Status:** Aprobada
> **Depends on:** SPEC 01 (`GamePlayer`, datos), SPEC 05 (patrón de juego en canvas), SPEC 06 (leaderboard Supabase)
> **Date:** 2026-11-19
> **Objective:** Portar a TypeScript el Tetris de `references/started-games/03-tetris/`, montarlo en `GamePlayer` vía un registro de juegos (`caida`) y que su puntaje llegue al Salón de la Fama.

---

## Por qué existe esta spec

Hoy `GAMES` (`lib/data.ts`) solo lista `rocas`; `caida` no existe en el catálogo, aunque el CHECK `scores_game_id_chk` de Supabase ya lo admite. `GamePlayer` decide el juego real con `isRocas = game.id === "rocas"` (un `if` por juego) y no hay `lib/games/registry.ts`.

La fuente es un `game.js` de ~620 líneas con globals, listeners en `document`, acceso a `localStorage` en carga (skin, tema, records), DOM propio (overlays de pausa/game over, ranking local, selector de nivel inicial, toggle de tema, panel de controles) y `Math.random` sin encapsular. Hay que quedarse solo con el motor (tablero, piezas, rotación, líneas, puntaje, nivel, ghost, next) y delegar HUD, pausa, fin y ranking a la plataforma.

Antes de escribir código Next: leer la guía relevante en `node_modules/next/dist/docs/` (AGENTS.md; `cacheComponents` activo).

---

## Scope

**In:**

- Port a TypeScript en `lib/games/tetris/` (sin globals; `window`/`document` solo en `start()`).
- Factory `createTetrisGame(canvas, callbacks, options)` con `start/pause/resume/restart/destroy/setInput`.
- `components/tetris-canvas.tsx` + controles táctiles (reutiliza `.touch-controls/.touch-btn`).
- Registro `lib/games/registry.ts` (`gameId → { component, hasLives }`); `GamePlayer` reemplaza `isRocas` por lookup y se migra `rocas` al registro.
- Entrada `caida` en `GAMES` y categoría `PUZZLE` en `CATS`.
- Verificar guardado en `scores` con `game_id = 'caida'` y pestaña del Salón (sin migración: el CHECK ya lo permite).
- HUD/pausa/FIN/modal de la plataforma; el canvas no dibuja puntaje, nivel ni "GAME OVER".
- Reglas del original: tablero 10×20, 8 piezas (7 estándar + "N" tuerca `[[8,8,8],[8,0,8],[8,8,8]]`, sorteo uniforme), rotación horaria con wall kicks `[0,-1,1,-2,2]`, soft drop (+1/fila), hard drop (+2/celda), ghost (alpha 0.2), vista previa de la siguiente, puntaje `[0,100,300,500,800] × nivel`, nivel = `floor(líneas/10)+1`, caída `max(100, 1000 − (nivel−1)×90)` ms, fin al colisionar la pieza recién generada.
- Controles teclado: `←` `→` mover, `↑` o `X` rotar, `↓` soft drop, `Espacio` hard drop. Táctil: 5 botones.

**Out of scope:**

- Skins (retro/neon/pastel/pixel), tema claro/oscuro, `localStorage` (`tetris-skin`, `tetris-theme`, `tetris_records`): la plataforma ya tiene estilo y ranking.
- Records locales, input de nombre, overlays del original, selector de nivel inicial (siempre nivel 1), contador de combos.
- Tecla `P`/`Esc` para pausar (la pausa es el botón de la plataforma).
- Sonido, hold piece, 7-bag, SRS, T-spin, anti-trampa, Auth, otros juegos, tests, modificar `references/`.

---

## Data model

```ts
// lib/games/tetris/index.ts — interfaz común
export interface TetrisCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void; // no se invoca: Tetris no tiene vidas
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export type TetrisAction = "left" | "right" | "down" | "rotate" | "drop";

export interface TetrisGame {
  start(): void; // registra listeners y arranca el loop
  pause(): void;
  resume(): void; // reinicia lastTime
  restart(): void; // score 0, nivel 1, tablero vacío
  destroy(): void; // idempotente: cancela rAF, timers y listeners
  setInput(action: TetrisAction, down: boolean): void; // teclado y táctil
}

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
  options?: { color?: string },
): TetrisGame;
```

```ts
// lib/games/registry.ts
import type { ComponentType, Ref } from "react";

export interface GameCanvasHandle {
  pause(): void;
  resume(): void;
  restart(): void;
}
export interface GameCanvasProps {
  ref?: Ref<GameCanvasHandle>;
  onScore: (n: number) => void;
  onLives: (n: number) => void;
  onLevel: (n: number) => void;
  onGameOver: (finalScore: number) => void;
}
export interface GameEntry {
  component: ComponentType<GameCanvasProps>;
  hasLives: boolean;
}

export const GAME_CANVASES: Record<string, GameEntry> = {
  rocas: { component: AsteroidsCanvas, hasLives: true },
  caida: { component: TetrisCanvas, hasLives: false },
};
```

`AsteroidsCanvasHandle` pasa a ser alias de `GameCanvasHandle` (misma forma); `rocas` no cambia de comportamiento.

```ts
// lib/data.ts — nueva entrada (best/plays son el fallback mock existente; las cifras reales vienen de game_stats)
{
  id: "caida", title: "CAÍDA", cat: "PUZZLE", cover: "cover-tetro", color: "magenta",
  short: "Encaja bloques antes de que toquen el techo.",
  long: "Ocho piezas caen sin pausa sobre un pozo de 10×20. Rota, desliza y completa filas para borrarlas. Cada 10 líneas la caída se acelera.",
  best: 0, plays: "0",
}
// CATS: añadir "PUZZLE"
```

```sql
-- Sin migración. CHECK vigente (leído en Supabase):
-- CHECK (game_id = ANY (ARRAY['bloque-buster','caida','serpentina','gloton','invasores','rocas','ranaria','duelo-pixel']))
-- 'caida' ya está incluido; solo se verifica con un insert de prueba (y se borra la fila).
```

Estructura de archivos:

```
lib/games/tetris/
  index.ts      // createTetrisGame, loop, estado, input (DAS), callbacks
  pieces.ts     // PIECES, COLORS, rotateCW, constantes (COLS, ROWS, LINE_SCORES)
  board.ts      // createBoard, collide, merge, clearLines (funciones puras sobre el tablero)
  utils.ts      // dimensiones lógicas, randomPiece
lib/games/registry.ts
components/tetris-canvas.tsx
```

Convenciones:

- Resolución lógica fija **480×600**: pozo 300×600 en `x=40`, panel "SIGUIENTE" de 4×4 celdas (30 px) a la derecha. El pozo ocupa todo el alto. Escalado por CSS (`height:100%`, `aspect-ratio: 4/5`, centrado en `.crt-screen`); sin HUD en canvas, pero la vista previa y su rótulo sí (es parte del tablero de juego).
- Fondo transparente; celdas con relleno `rgba(color, .55)` + trazo del color + `shadowBlur` (look del skin `neon` del original). Paleta de las 8 piezas en `pieces.ts`; el color de `options.color` (`--magenta`) se usa para el marco del pozo y la cuadrícula.
- Callbacks solo al cambiar el valor. `dt` capado a 50 ms; el acumulador de caída trabaja en ms.
- Repetición de `←` `→` `↓`: el motor implementa auto-repeat propio (retardo ~170 ms, cadencia ~50 ms) y **ignora `KeyboardEvent.repeat`**, para que teclado y táctil se comporten igual. `rotate` y `drop` actúan una vez por pulsación.
- `preventDefault` solo en `Space`, flechas y `KeyX`, mientras el juego está montado.
- `Math.random` solo se llama tras montar (dentro de `start()`/`restart()`).

---

## Implementation plan

Antes del paso 1: leer `node_modules/next/dist/docs/` (Client Components), el CSS de `.crt-screen` y `.touch-*` en `app/globals.css`, y `components/asteroids-canvas.tsx` como modelo. Invocar `/frontend-design` antes de los pasos 6 y 7.

1. **Piezas y tablero.** `pieces.ts`, `board.ts`, `utils.ts` tipados, funciones puras (`collide(board, shape, x, y)`, `rotateCW`, `clearLines` devuelve `{board, cleared}`). Verificar: `npx tsc --noEmit`.
2. **Motor.** `lib/games/tetris/index.ts`: estado, loop rAF con acumulador, `tryRotate` con kicks, soft/hard drop, ghost, next, puntaje, nivel, fin de partida (un solo `onGameOver`), input con auto-repeat, `destroy()` idempotente. Sin DOM propio ni HUD. Verificar: `tsc` y `npm run lint`.
3. **Componente canvas.** `components/tetris-canvas.tsx` (client): `callbacksRef`, juego en `useEffect([])`, `destroy()` en cleanup, color por `getComputedStyle(canvas).getPropertyValue("--magenta")`, `ref` con `pause/resume/restart`. Controles táctiles provisionales. Verificar: compila.
4. **Registro + GamePlayer.** Crear `lib/games/registry.ts` (con `rocas` migrado y `caida`). En `game-player.tsx`: `const entry = GAME_CANVASES[game.id]`; sin entrada → simulación y arena actuales; con entrada → `<entry.component …/>` y sin `setInterval`/efecto de nivel simulados. HUD "Vidas" solo si `entry.hasLives`. `restart()` solo restablece vidas si aplica. Verificar: `/juegos/rocas/jugar` idéntico a antes; el resto de ids (si los hubiera) sigue simulado.
5. **Datos.** Añadir `caida` a `GAMES` y `"PUZZLE"` a `CATS`. Verificar: `/juegos/caida`, `/juegos/caida/jugar`, biblioteca (filtro PUZZLE) y pestaña CAÍDA del Salón (estado vacío) cargan. Comprobar con `execute_sql` que `insert … game_id='caida'` pasa el CHECK y borrar la fila; `get_advisors` (security) sin problemas nuevos.
6. **Pausa, FIN, reinicio y guardado.** PAUSA/REANUDAR/FIN/JUGAR DE NUEVO contra el juego real; GUARDAR PUNTUACIÓN crea fila `caida`. Verificar en `scores` y en el Salón.
7. **Estilo y táctil.** Pulir portada `cover-tetro`, neón de las piezas y los 5 botones táctiles (←, →, ↻ rotar, ↓ bajar, ⤓ caída instantánea) con clases `.touch-*` (añadir variantes solo si hacen falta). Verificar con emulación táctil.
8. **Cierre.** `npm run build`, `npm run lint`; entrar/salir de `/juegos/caida/jugar` varias veces y comprobar que no hay listeners ni timers duplicados.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `/juegos/caida/jugar` muestra el Tetris real (pozo 10×20 y siguiente pieza), sin arena decorativa.
- [ ] `←` `→` mueven, `↑`/`X` rotan en sentido horario (con kicks pegado a la pared), `↓` baja, `Espacio` hard drop; ninguna tecla hace scroll.
- [ ] Mantener `←`/`→`/`↓` repite el movimiento una vez al ritmo del auto-repeat (sin dobles pasos).
- [ ] Soft drop suma +1 por fila; hard drop +2 por celda; 1/2/3/4 líneas suman 100/300/500/800 × nivel (nivel previo al borrado).
- [ ] El nivel del HUD sube cada 10 líneas y la caída se acelera (mín. 100 ms).
- [ ] Las 8 piezas (incluida la tuerca N) pueden aparecer, rotar y colisionar correctamente.
- [ ] El ghost aparece a alpha 0.2 donde aterrizará la pieza; la siguiente pieza se ve a la derecha.
- [ ] Al no poder aparecer una pieza se abre el modal FIN DEL JUEGO con la puntuación correcta, una sola vez.
- [ ] El HUD no muestra "Vidas" en `caida` y sí en `rocas`.
- [ ] El canvas no dibuja puntaje, nivel ni "GAME OVER".
- [ ] PAUSA congela caída y entrada; REANUDAR continúa sin salto; FIN detiene el juego; JUGAR DE NUEVO deja puntaje 0, nivel 01, tablero vacío.
- [ ] GUARDAR PUNTUACIÓN crea fila en `scores` con `game_id = 'caida'`.
- [ ] El Salón muestra el puntaje en la pestaña CAÍDA; vacío muestra `AÚN SIN CAMPEONES — SÉ EL PRIMERO`; las stats del juego reflejan la partida.
- [ ] Insert con `game_id` previos (`rocas`) y `caida` pasa el CHECK; `get_advisors` sin problemas nuevos.
- [ ] Sin listeners duplicados al salir y volver (una acción por pulsación).
- [ ] `rocas` sigue funcionando igual tras migrarlo al registro.
- [ ] Controles táctiles visibles solo con `pointer: coarse` y permiten jugar.
- [ ] Sin errores de consola ni warnings de hydration (incluido Strict Mode).
- [ ] `references/started-games/03-tetris/` no fue modificado.

---

## Decisiones

- **Sí:** id `caida` (mapeo propuesto del checklist y ya presente en el CHECK). **Sin migración**, solo verificación.
- **Sí:** crear el registro y migrar `rocas`. Evita un `if` por juego y deja listos los siguientes ports.
- **Sí:** categoría `PUZZLE` y color `magenta` (coherente con `cover-tetro`, morado/magenta).
- **Sí:** estilo del skin `neon` del original; los demás skins y el tema se descartan (la plataforma ya define estilo).
- **Sí:** dibujar la vista previa de la siguiente pieza en el canvas. Es información de juego sin equivalente en el HUD de la plataforma.
- **Sí:** auto-repeat propio en el motor e ignorar `e.repeat`. Hace igual el teclado y el táctil; el original dependía del repeat del SO.
- **Sí:** puntaje y nivel idénticos al original; piezas por `Math.random` uniforme (sin 7-bag).
- **Sí:** pieza N (tuerca, 8ª pieza), fiel al código original. El README anuncia 7 piezas pero `game.js` sortea 8; el usuario eligió fidelidad al código. Forma `[[8,8,8],[8,0,8],[8,8,8]]` con color propio en `COLORS`; `randomPiece` sortea las 8 sin flag `onlyStandard`.
- **No:** `onLives`. Tetris no tiene vidas: el motor nunca lo llama y el HUD oculta "Vidas" vía `hasLives: false`.
- **No:** tecla `P`/`Esc`. Añadirla exigiría un callback `onPauseToggle` y sincronizar con el estado React; spec aparte.
- **No:** selector de nivel inicial, combos, records locales. Sobran con el ranking de Supabase.

---

## Riesgos

| Riesgo                                                        | Mitigación                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Strict Mode duplica listeners/loops/timers de auto-repeat     | `destroy()` idempotente: cancela rAF, timers y quita listeners                                                     |
| `Math.random`/`window`/`localStorage` rompen SSR              | Crear el juego en `useEffect`; no se porta `localStorage`                                                          |
| Teclas hacen scroll o reactivan botones enfocados             | `preventDefault` acotado; `blur()` de botones de la plataforma                                                     |
| `dt` enorme tras pausa dispara varias caídas                  | `resume()` reinicia `lastTime`; `dt` capado a 50 ms                                                                |
| CSS var no sirve en canvas                                    | `getComputedStyle` al crear el juego                                                                               |
| Canvas portrait (4:5) dentro de `.crt-screen` 4:3             | Centrar con `height:100%` y `aspect-ratio:4/5`; revisar overlays de pausa y controles táctiles sobre la zona vacía |
| Botones táctiles tapan el pozo en móvil                       | Clusters laterales fuera del pozo o con baja opacidad; validar con `/frontend-design`                              |
| Teclas mantenidas se quedan "pegadas" al perder foco o pausar | `clearInput()` en `pause()`, `restart()`, `destroy()` y `blur` de ventana                                          |
| Refactor de `GamePlayer` rompe `rocas`                        | Migrar `rocas` al registro en el paso 4 y probar antes de seguir                                                   |
| Id fuera del CHECK falla el insert                            | `caida` ya está en el CHECK; verificado en el paso 5                                                               |
| `best/plays` mock en `GAMES` no coinciden con datos reales    | Son solo fallback; la UI ya lee `game_stats`                                                                       |
| DPR alto vuelve borroso el canvas escalado                    | Aceptado; manejar `devicePixelRatio` si se nota                                                                    |

---

## Qué **no** está en esta spec

- Skins, tema claro/oscuro, records locales, nombre en el juego.
- Hold, 7-bag, SRS, T-spin, combos, nivel inicial configurable.
- Pausa por teclado (`P`/`Esc`).
- Sonido o vibración.
- Anti-trampa en puntajes y Auth.
- Port de otros juegos (`bloque-buster`, etc.).
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
