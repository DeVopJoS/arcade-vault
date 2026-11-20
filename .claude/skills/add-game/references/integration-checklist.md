# Contrato de integración (validado con `rocas`, SPEC 05/06)

## Motor del juego — `lib/games/<id>/`

- Archivos: `index.ts` (factory, loop, estado, input), `entities.ts`, `utils.ts`.
- Sin globals; nada de `window`/`document` fuera de `start()`. `Math.random` solo tras montar (client).
- Interfaz común (ver `lib/games/asteroids/index.ts`):
  ```ts
  interface <Name>Callbacks { onScore(n); onLives(n); onLevel(n); onGameOver(finalScore) }
  interface <Name>Game { start(); pause(); resume(); restart(); destroy(); setInput(action, down) }
  create<Name>Game(canvas, callbacks, options?: { color?: string }): <Name>Game
  ```
- Callbacks solo al cambiar el valor, no por frame. `dt` capado (0.05 s); `resume()` reinicia `lastTime`.
- `destroy()` idempotente (Strict Mode monta dos veces): cancela rAF, quita listeners.
- `preventDefault` solo en teclas del juego (flechas/espacio), solo mientras está montado.
- Canvas con resolución lógica fija, escalado por CSS. HUD, "GAME OVER" y pausa NO se dibujan en canvas.
- Estilo neón: trazos con el color del juego + `shadowBlur`, fondo transparente.

## Componente — `components/<id>-canvas.tsx`

Modelo: `components/asteroids-canvas.tsx`.

- `"use client"`, `ref` con `{ pause, resume, restart }` (`useImperativeHandle`).
- Callbacks en `callbacksRef` para no recrear el juego; juego creado en `useEffect([])`, `destroy()` en cleanup.
- Color: `getComputedStyle(canvas).getPropertyValue("--<color>")` (CSS var no sirve en canvas).
- Controles táctiles: botones con `onPointerDown` (+`setPointerCapture`), `onPointerUp/Cancel`, `tabIndex={-1}`; clases `.touch-controls/.touch-btn` en `app/globals.css` (visibles con `@media (pointer: coarse)`, `touch-action: none`).

## Integración en `components/game-player.tsx`

- HUD, PAUSA/REANUDAR, FIN, modal FIN DEL JUEGO y `submitScore` son de la plataforma.
- Hoy: `isRocas = game.id === "rocas"` y `AsteroidsCanvas` condicional; simulación (`setInterval` de puntaje + efecto de nivel) solo si no hay juego real.
- Objetivo de la spec: registro `lib/games/registry.ts` (`id → componente canvas` con el mismo handle) y lookup en vez de `if` por juego.
- Conexión: `onScore→setScore`, `onLives→setLives`, `onLevel→setLevel`, `onGameOver→(setScore(final); setOver(true))`. PAUSA/FIN llaman `pause()`; REANUDAR `resume()`; JUGAR DE NUEVO `restart()` + reset de estado. Los botones hacen `blur()` para que Espacio no los reactive.

## Datos y leaderboard

- `lib/data.ts`: añadir a `GAMES` (`id`, `title`, `short`, `long`, `cat`, `cover: CoverClass`, `color: NeonColor`, `best`, `plays`). Hoy `GAMES` solo lista `rocas`; `CoverClass` ya prevé 8 portadas (`cover-bricks`, `cover-tetro`, …).
- Supabase `public.scores`: CHECK `scores_game_id_chk` limita `game_id` a una lista cerrada (8 ids de la spec 06: `bloque-buster, caida, serpentina, gloton, invasores, rocas, ranaria, duelo-pixel`). **Un id fuera de la lista falla en el insert** → migración que reemplaza el CHECK (drop + add con la lista completa vigente). Leer el CHECK real antes de redactar el SQL.
- Mapeo de ids de las referencias (propuesto, confirmar con el usuario): `03-tetris → caida`, `04-arkanoid → bloque-buster`.
- Sin código de leaderboard nuevo: `submitScore`, `fetchLeaderboard` (vista `scores_best`), `fetchGameStats` (vista `game_stats`) y `HallOfFame` ya trabajan por `game_id`.
- Tras la migración: `get_advisors` (security) sin problemas nuevos; borrar filas de prueba.

## Reglas transversales

- Texto UI en español, clases CSS existentes, usar `/frontend-design` para UI nueva.
- No modificar `references/started-games/*`.
- Leer `node_modules/next/dist/docs/` antes de código Next (versión con breaking changes; `cacheComponents` activo).
- Verificación estándar: `npx tsc --noEmit`, `npm run lint`, `npm run build`, prueba manual en `/juegos/<id>/jugar` y `/salon`.
