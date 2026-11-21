# SPEC 08 — Juego Arkanoid (BLOQUE BUSTER) integrado en el reproductor con leaderboard

> **Status:** Aprobado
> **Depends on:** SPEC 01 (`GamePlayer`, datos), SPEC 05 (patrón de juego en canvas), SPEC 06 (leaderboard Supabase), SPEC 07 (registro `lib/games/registry.ts`)
> **Date:** 2026-11-20
> **Objective:** Portar a TypeScript el Arkanoid de `references/started-games/04-arkanoid/`, montarlo en `GamePlayer` vía el registro (`bloque-buster`) y que su puntaje llegue al Salón de la Fama.

---

## Por qué existe esta spec

Hoy `GAMES` (`lib/data.ts`) lista `rocas` y `caida`; `bloque-buster` no existe en el catálogo, aunque el CHECK `scores_game_id_chk` de Supabase ya lo admite y `CoverClass` ya prevé `cover-bricks`. El registro `lib/games/registry.ts` ya existe (SPEC 07): basta añadir una entrada.

La fuente es un `game.js` de ~270 líneas con globals (`canvas`, `ctx`, `paddle`, `ball`, `blocks`, `lives`, `score`…), listeners en `canvas`/`document`, `new Audio(...)` en carga, `loadSpritesheet` con `Image`/`document.createElement` en carga (riesgo SSR), HUD y overlays dibujados en canvas (PAUSA con selector de nivel, GAME OVER, "¡Completaste el juego!") y `levels.js` con 5 niveles. Hay que quedarse con el motor (paddle, pelota, bloques, colisiones, vidas, niveles, puntaje) y delegar HUD, pausa y fin a la plataforma.

Assets de la fuente: `spritesheet-breakout.png` + `spritesheet.js` (sprites de paddle/pelota/bloques/explosión) y 2 mp3. **Se decide no portarlos** (ver Decisiones): bloques, paddle y pelota se dibujan como vectores neón.

Antes de escribir código Next: leer la guía relevante en `node_modules/next/dist/docs/` (AGENTS.md; `cacheComponents` activo).

> Estado real inspeccionado: CHECK vigente leído en Supabase = `bloque-buster, caida, serpentina, gloton, invasores, rocas, ranaria, duelo-pixel`; vistas `scores_best` y `game_stats` existen; `GAME_CANVASES` tiene `rocas` y `caida`; `app/globals.css` ya tiene `.cover-bricks`, `.touch-controls/.touch-btn` y la variante `.touch-tetris`.

---

## Scope

**In:**

- Port a TypeScript en `lib/games/arkanoid/` (sin globals; `window`/`document` solo en `start()`).
- Factory `createArkanoidGame(canvas, callbacks, options)` con `start/pause/resume/restart/destroy/setInput`.
- `components/arkanoid-canvas.tsx` + controles táctiles (reutiliza `.touch-controls/.touch-btn`).
- Registro: añadir `"bloque-buster": { component: ArkanoidCanvas, hasLives: true }` a `GAME_CANVASES`. `GamePlayer` no cambia.
- Entrada `bloque-buster` en `GAMES` y categoría `ARCADE` en `CATS`.
- Verificar guardado en `scores` con `game_id = 'bloque-buster'` y pestaña del Salón (sin migración: el CHECK ya lo permite).
- HUD/pausa/FIN/modal de la plataforma; el canvas no dibuja puntaje, nivel, vidas, "PAUSA" ni "GAME OVER".
- Reglas del original: resolución lógica 800×600; paddle 81×14 en `y=560`, velocidad 400 px/s; pelota 16×16, velocidad base `vx=200, vy=-300` × `speed` del nivel; 3 vidas; bloques 64×24 en rejilla 10 columnas con origen `(80, 80)`; +10 por bloque; rebote en paredes izq/der/techo; rebote en paddle (`vy = -|vy|`, ventana de 8 px bajo el paddle, `vx` no cambia); colisión AABB con bloques: un bloque por frame, `vy = -vy`; al caer la pelota se pierde 1 vida y se recoloca sobre el paddle con la velocidad del nivel; al vaciar el nivel se carga el siguiente (pelota recolocada); al vaciar el nivel 5 → fin con victoria.
- 5 niveles de `levels.js` (cuadrícula completa, pirámide, ajedrez, huecos, marco + cruz) con `speed` 1.00 / 1.10 / 1.21 / 1.33 / 1.46.
- Controles teclado: `←` `→` mover paddle (400 px/s). Ratón/táctil: el paddle sigue al puntero sobre el canvas (`pointermove`). Táctil además: botones ← →.
- Fin de partida: sin vidas (`onGameOver(score)`) o nivel 5 completado (`onGameOver(score)`); un solo disparo.
- Animación de explosión al romper bloque (4 frames, 150 ms) recreada en vectores (flash/encogimiento del bloque), sin spritesheet.

**Out of scope:**

- Spritesheet y sonidos (`ball-bounce.mp3`, `break-sound.mp3`): no se copian a `public/`; no hay audio.
- Overlay de pausa dibujado en canvas y **selector de salto de nivel** (permitiría saltar niveles y falsear el ranking; la pausa es el botón de la plataforma).
- Tecla `P`/`Esc` para pausar (exigiría callback `onPauseToggle`; spec aparte).
- Mecánicas ausentes en la fuente: power-ups, bloques de varios golpes, ángulo de rebote según el punto del paddle, lanzamiento manual de la pelota, multi-bola, vidas extra.
- Corregir el rebote lateral en bloques (el original siempre invierte `vy`): se mantiene por fidelidad.
- Anti-trampa, Auth, otros juegos, tests, modificar `references/`.

---

## Data model

```ts
// lib/games/arkanoid/index.ts — interfaz común
export interface ArkanoidCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void; // sin vidas o nivel 5 completado
}

export type ArkanoidAction = "left" | "right";

export interface ArkanoidGame {
  start(): void; // registra listeners (teclado, pointermove) y arranca el loop
  pause(): void;
  resume(): void; // reinicia lastTime
  restart(): void; // score 0, 3 vidas, nivel 1
  destroy(): void; // idempotente: cancela rAF y quita listeners
  setInput(action: ArkanoidAction, down: boolean): void; // teclado y táctil
}

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
  options?: { color?: string },
): ArkanoidGame;
```

```ts
// lib/games/registry.ts — solo se añade una línea
import ArkanoidCanvas from "@/components/arkanoid-canvas";
export const GAME_CANVASES: Record<string, GameEntry> = {
  rocas: { component: AsteroidsCanvas, hasLives: true },
  caida: { component: TetrisCanvas, hasLives: false },
  "bloque-buster": { component: ArkanoidCanvas, hasLives: true },
};
```

```ts
// lib/data.ts — nueva entrada (best/plays son fallback mock; las cifras reales vienen de game_stats)
{
  id: "bloque-buster", title: "BLOQUE BUSTER", cat: "ARCADE", cover: "cover-bricks", color: "cyan",
  short: "Rompe la muralla de neón con una sola pelota.",
  long: "Mueve la paleta, mantén la pelota en juego y derriba cada bloque. Cinco niveles con muros distintos y una pelota cada vez más veloz. Tienes tres vidas.",
  best: 0, plays: "0",
}
// CATS: añadir "ARCADE" → ["TODOS", "ARCADE", "PUZZLE", "SHOOTER"]
```

```sql
-- Sin migración. CHECK vigente (leído en Supabase):
-- CHECK ((game_id = ANY (ARRAY['bloque-buster','caida','serpentina','gloton','invasores','rocas','ranaria','duelo-pixel'])))
-- 'bloque-buster' ya está incluido; solo se verifica con un insert de prueba (y se borra la fila).
```

Estructura de archivos:

```
lib/games/arkanoid/
  index.ts      // createArkanoidGame, loop, estado, input, callbacks
  levels.ts     // LEVELS tipados (port de levels.js), constantes de rejilla
  entities.ts   // tipos Paddle/Ball/Block/Explosion, colisiones puras (AABB), dibujo neón
  utils.ts      // dimensiones lógicas (800×600), clamp, mapeo de puntero → x lógico
components/arkanoid-canvas.tsx
```

Convenciones:

- Resolución lógica fija **800×600** (misma proporción 4:3 que `.crt-screen`); escalado por CSS igual que `asteroids-canvas.tsx`. Fondo transparente.
- Estilo neón: bloques con relleno `rgba(color,.25)` + trazo del color + `shadowBlur`; paleta de colores de bloque en `levels.ts` (`red, yellow, cyan, magenta, hotpink, green, gray` → hex de la paleta de la plataforma). `options.color` (`--cyan`) se usa para paddle y pelota.
- Conversión de puntero: `x_lógico = (clientX − rect.left) × (800 / rect.width)`; el paddle se centra en el puntero y se acota a `[0, 800 − w]`. El listener `pointermove` va en el `canvas` (no en `document`) y se retira en `destroy()`.
- Callbacks solo al cambiar el valor (`onScore` por bloque, `onLives` al perder, `onLevel` al cambiar de nivel; los tres se emiten una vez al arrancar/reiniciar). `dt` capado a 50 ms.
- Un solo `onGameOver` por partida (flag `ended`); tras él el loop se detiene.
- `preventDefault` solo en `ArrowLeft`/`ArrowRight`, mientras el juego está montado.
- Sin `Math.random` (el original es determinista); sin `Audio`, `Image` ni `localStorage`.
- `clearInput()` en `pause()`, `restart()`, `destroy()` y `blur` de ventana.

---

## Implementation plan

Antes del paso 1: leer `node_modules/next/dist/docs/` (Client Components), el CSS de `.crt-screen` y `.touch-*` en `app/globals.css`, y `components/asteroids-canvas.tsx` / `components/tetris-canvas.tsx` como modelo. Invocar `/frontend-design` antes de los pasos 5 y 6.

1. **Niveles y entidades.** `levels.ts` (port tipado de `levels.js`: 5 niveles, `speed`, lista `{col,row,color}`), `entities.ts` (tipos, `collideAABB`, dibujo de paddle/pelota/bloque/explosión), `utils.ts`. Funciones puras. Verificar: `npx tsc --noEmit`.
2. **Motor.** `lib/games/arkanoid/index.ts`: estado, loop rAF con `dt` capado, paddle (teclas + puntero), pelota, rebotes, colisión con bloques (uno por frame, `vy` invertido), vidas, `loadLevel`, victoria, explosiones, `onGameOver` único, `destroy()` idempotente. Sin DOM propio ni HUD. Verificar: `tsc` y `npm run lint`.
3. **Componente canvas.** `components/arkanoid-canvas.tsx` (client): `callbacksRef`, juego en `useEffect([])`, `destroy()` en cleanup, color por `getComputedStyle(canvas).getPropertyValue("--cyan")`, `ref` con `pause/resume/restart`. Botones ← → provisionales. Verificar: compila.
4. **Registro + datos.** Añadir la entrada a `GAME_CANVASES`; añadir `bloque-buster` a `GAMES` y `"ARCADE"` a `CATS`. Verificar: `/juegos/bloque-buster`, `/juegos/bloque-buster/jugar`, biblioteca (filtro ARCADE) y pestaña del Salón (estado vacío) cargan; `rocas` y `caida` siguen igual. Comprobar con `execute_sql` que `insert … game_id='bloque-buster'` pasa el CHECK y borrar la fila; `get_advisors` (security) sin problemas nuevos.
5. **Pausa, FIN, reinicio y guardado.** PAUSA/REANUDAR/FIN/JUGAR DE NUEVO contra el juego real; HUD con vidas/nivel; GUARDAR PUNTUACIÓN crea fila `bloque-buster`. Verificar en `scores` y en el Salón.
6. **Estilo y táctil.** Pulir portada `cover-bricks`, neón de bloques/explosión y botones táctiles ← → (variante `.touch-arkanoid` solo si hace falta) más arrastre sobre el canvas. Verificar con emulación táctil.
7. **Cierre.** `npm run build`, `npm run lint`; entrar/salir de `/juegos/bloque-buster/jugar` varias veces y comprobar que no hay listeners duplicados.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `/juegos/bloque-buster/jugar` muestra el juego real (bloques, paddle, pelota), sin arena decorativa.
- [ ] `←` `→` mueven el paddle (400 px/s) sin salirse del canvas; el ratón y el arrastre táctil lo siguen; ninguna tecla hace scroll.
- [ ] La pelota rebota en paredes, techo, paddle y bloques; cada bloque roto suma 10 y desaparece con su animación.
- [ ] Se cargan los 5 niveles con sus patrones (60 / 40 / 30 / 39 / 39 bloques) y la pelota acelera por nivel (×1.00 → ×1.46); el HUD refleja el nivel.
- [ ] Al caer la pelota baja 1 vida (HUD) y se recoloca sobre el paddle; el puntaje y el nivel se conservan.
- [ ] Sin vidas se abre el modal FIN DEL JUEGO con la puntuación correcta, una sola vez.
- [ ] Al romper el último bloque del nivel 5 se abre el modal FIN DEL JUEGO con el puntaje acumulado (≈2080 máx.), una sola vez.
- [ ] El HUD de la plataforma refleja puntuación/vidas/nivel; el canvas no dibuja HUD, "PAUSA", "GAME OVER" ni selector de niveles.
- [ ] PAUSA congela pelota y entrada; REANUDAR continúa sin salto; FIN detiene el juego; JUGAR DE NUEVO deja puntaje 0, 3 vidas, nivel 01, nivel 1 completo.
- [ ] GUARDAR PUNTUACIÓN crea fila en `scores` con `game_id = 'bloque-buster'`.
- [ ] El Salón muestra el puntaje en la pestaña BLOQUE BUSTER; vacío muestra `AÚN SIN CAMPEONES — SÉ EL PRIMERO`; las stats reflejan la partida.
- [ ] Insert con `game_id` previos (`rocas`, `caida`) y `bloque-buster` pasa el CHECK; `get_advisors` sin problemas nuevos.
- [ ] Sin listeners duplicados al salir y volver (un solo paso de paddle por pulsación/frame).
- [ ] `rocas` y `caida` siguen funcionando igual.
- [ ] Controles táctiles visibles solo con `pointer: coarse` y permiten jugar.
- [ ] Sin errores de consola ni warnings de hydration (incluido Strict Mode); sin `Audio`/`Image` creados en carga.
- [ ] `references/started-games/04-arkanoid/` no fue modificado.

---

## Decisiones

- **Sí:** id `bloque-buster` (mapeo del checklist y ya presente en el CHECK). **Sin migración**, solo verificación.
- **Sí:** carpeta `lib/games/arkanoid/` y `arkanoid-canvas.tsx`, nombrados por el juego como `asteroids`/`tetris`; el id de plataforma es `bloque-buster`.
- **Sí:** categoría `ARCADE` (ya existe en `Category`; se añade a `CATS`) y color `cyan`. _(Abierta: el color podría ser `green` o `yellow` si choca con la portada `cover-bricks`.)_
- **Sí (abierta):** dibujar en vectores neón en vez de portar el spritesheet. Mantiene el look de `rocas`/`caida`, evita `Image` en carga (SSR), assets en `public/` y problemas de carga. Alternativa: copiar el PNG a `public/games/arkanoid/` y portar `drawSprite`.
- **Sí (abierta):** sin sonido. Evita autoplay bloqueado y assets; ningún juego de la plataforma tiene audio aún. Alternativa: spec propia de audio.
- **Sí:** fidelidad de físicas (sin ángulo según punto del paddle, `vy` siempre invertido, un bloque por frame, pelota en movimiento al recolocarla). Es el comportamiento del original.
- **Sí:** victoria del nivel 5 termina con `onGameOver(score)`; el modal de la plataforma no distingue victoria de derrota.
- **Sí:** `onLives` se usa y `hasLives: true`; HUD muestra vidas como `rocas`.
- **No:** selector de nivel en pausa (falsea el ranking). **No:** `P`/`Esc`. **No:** power-ups, multi-bola ni sonido.
- **No:** `Math.random`; el juego es determinista.

---

## Riesgos

| Riesgo                                                               | Mitigación                                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Strict Mode duplica listeners/loops                                  | `destroy()` idempotente: cancela rAF y quita listeners (teclado, `pointermove`)           |
| `Image`/`Audio`/`window` en carga rompen SSR                         | No se portan; `window`/`document` solo en `start()`, juego creado en `useEffect`          |
| Teclas hacen scroll o reactivan botones enfocados                    | `preventDefault` acotado a flechas; `blur()` de botones de la plataforma                  |
| `dt` enorme tras pausa mueve la pelota a través de bloques           | `resume()` reinicia `lastTime`; `dt` capado a 50 ms                                       |
| Tunneling a alta velocidad (nivel 5 ≈ 440 px/s, 22 px/frame a 50 ms) | Pelota 16 px y bloques 24 px: con `dt` cap 50 ms puede atravesar; subdividir el paso si ` | v·dt | > 8` px |
| Teclas "pegadas" al perder foco o pausar                             | `clearInput()` en `pause()`, `restart()`, `destroy()` y `blur` de ventana                 |
| CSS var no sirve en canvas                                           | `getComputedStyle` al crear el juego                                                      |
| Puntero en canvas escalado por CSS mapea mal                         | Conversión con `getBoundingClientRect()` y factor `800/rect.width`                        |
| El arrastre táctil hace scroll de la página                          | `touch-action: none` en el canvas y `pointer capture`                                     |
| Pelota recolocada sale al instante sin aviso                         | Fidelidad al original; si se siente injusto, spec propia de "lanzamiento manual"          |
| Refactor del registro rompe `rocas`/`caida`                          | Solo se añade una entrada; probar ambos tras el paso 4                                    |
| Id fuera del CHECK falla el insert                                   | `bloque-buster` ya está en el CHECK; verificado en el paso 4                              |
| `best/plays` mock en `GAMES` no coinciden con reales                 | Son solo fallback; la UI ya lee `game_stats`                                              |
| DPR alto vuelve borroso el canvas escalado                           | Aceptado; manejar `devicePixelRatio` si se nota                                           |

---

## Qué **no** está en esta spec

- Spritesheet, sonido, vibración.
- Selector de nivel, pausa por teclado (`P`/`Esc`), overlays dibujados en canvas.
- Power-ups, bloques resistentes, multi-bola, ángulo de rebote por zona del paddle, lanzamiento manual.
- Anti-trampa en puntajes y Auth.
- Port de otros juegos (`serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
