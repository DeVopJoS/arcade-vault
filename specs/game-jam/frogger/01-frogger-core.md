# SPEC — Ranaria (cruce de carretera y río): integración core del juego

> **Estado:** Aprobado
> **Depende de:** 06-salon-de-la-fama-supabase, 09-juego-snake-serpentina, 10-gamepad-movil
> **Fecha:** 2026-11-26 (rev. adaptada a la arquitectura del repo; original 2026-05-20)
> **Objetivo:** Integrar Ranaria — juego original de cruce de carretera y río dibujado en canvas desde cero — como juego jugable en Arcade Vault con ID de catálogo `ranaria`, conectado al `GamePlayer` vía `lib/games/registry.ts` (score, vidas, nivel, game over, skins y leaderboard en `scores`).

> **Nota de revisión:** la versión original pedía tabla `games` en Supabase, play-page propia `app/games/frogger/play`, componente `FroggerGame.tsx` con props `onScoreChange…` y `av_player_name`. Nada de eso existe en el repo: el catálogo es `lib/data.ts`, las partidas corren en `/juegos/[id]/jugar` con `GamePlayer` + registry, y el guardado de score es `submitScore` (sesión `av_user`). Esta revisión mantiene la mecánica y adapta la integración. El nombre visible pasa a **RANARIA** (id `ranaria`, ya previsto en `references/templates/data.jsx` con `cover-rana`) para que el juego sea original y no una recreación con nombre de un título existente.

---

## Scope

**In:**

- Entrada `ranaria` en `lib/data.ts` (`GAMES`), con `cover-rana` (clase ya existente en `app/globals.css`) y color `green`.
- Lógica en `lib/games/ranaria/` (`utils.ts`, `entities.ts`, `skins.ts`, `index.ts`) siguiendo el patrón de `lib/games/snake/`: motor `createRanariaGame(canvas, callbacks, { skin })` con `start/pause/resume/restart/destroy/setInput/setSkin`.
- Componente `components/ranaria-canvas.tsx` (`"use client"`), mismo patrón que `snake-canvas.tsx` (callbacksRef, `useImperativeHandle` → `GameCanvasHandle`, skin en caliente).
- Registro en `GAME_CANVASES` (`lib/games/registry.ts`) con `hasLives: true`, `skins`, `defaultSkin`. El campo `gamepad` lo agrega `mobile-porter` después (Fase 5 de `/spec-impl-game`).
- Canvas interno 640 × 560 (16 columnas × 14 filas de 40 px), centrado en la pantalla CRT 4:3 con `height: 100%` y `aspect-ratio: 8 / 7` (igual que Caída con 4/5).
- Mapa (fila 0 = arriba):
  - fila 0: 5 bocas destino (cada una ocupa 2 columnas: 1–2, 4–5, 7–8, 10–11, 13–14; el resto es seto = muerte),
  - filas 1–6: río (6 carriles: troncos y tortugas),
  - fila 7: franja segura intermedia,
  - filas 8–12: carretera (5 carriles: coches y camiones),
  - fila 13: base de inicio (segura).
- Entidades de carretera: coches (1 celda) y camiones (2–3 celdas), velocidad y sentido por carril, loop continuo; colisión letal.
- Entidades de río: troncos (2–4 celdas) y grupos de tortugas (2–3 celdas). La rana solo sobrevive en el río encima de un tronco o de tortugas visibles; sobre ellos es arrastrada horizontalmente. Las tortugas tienen ciclo de inmersión por grupo (3 s visibles → 1.5 s bajo el agua, con desfase por grupo); sumergidas no dan apoyo.
- Movimiento de la rana: saltos discretos de 1 celda (40 px) en 4 direcciones con animación de 120 ms; no puede salir por los bordes laterales ni por debajo de la fila 13. Teclado: flechas + WASD (en `window`, como los demás juegos). Un salto por pulsación (se ignora el auto-repeat); como máximo 1 dirección en cola durante la animación.
- Meta: la rana llega a una boca libre de la fila 0 → la boca queda ocupada y la rana reaparece en la base. Boca ocupada o seto → muerte. Las 5 bocas llenas → ronda completada.
- Muerte: (a) vehículo, (b) agua, (c) tortuga que se sumerge bajo la rana, (d) arrastrada fuera de los bordes laterales en el río, (e) temporizador a 0, (f) boca ocupada / seto. Tras morir: parpadeo de 600 ms (sin partículas) y reaparición en la base con el temporizador reiniciado.
- Vidas: 3. Cada muerte emite `onLives(lives)` una vez; al llegar a 0 se emite `onLives(0)` y luego `onGameOver(score)`.
- Puntuación: +10 por cada fila alcanzada por primera vez en el trayecto actual (se reinicia en cada reaparición); +50 al ocupar boca; + bonus `segundos_restantes × 10` al ocupar boca; +200 al completar la ronda.
- Temporizador por trayecto: `max(8, 15 − (level − 1))` segundos.
- Nivel: cada ronda completada sube `level` (+1), emite `onLevel(level)`, reconstruye carriles con velocidades ×1.15 por nivel.
- HUD interno (doble HUD, como los demás juegos): barra de tiempo de 6 px en el borde superior de la fila 0 (verde → amarillo → rojo); score (izquierda), nivel (centro) y vidas como iconos de rana (derecha) en la fila 13, sin tapar la casilla central de inicio.
- Pausa: solo vía `GameCanvasHandle.pause/resume` (botón PAUSA del `GamePlayer`). P / Esc no pausan el canvas.
- 3 skins (`clasico` default, `neon`, `retro`) en `lib/games/ranaria/skins.ts` con el contrato de skins del repo (`SKINS`, `DEFAULT_SKIN`, `SKIN_OPTIONS`, `isSkinId`; el motor no pinta colores propios).
- Guardado de score: el existente del `GamePlayer` (`submitScore` → `scores` con `game_id = 'ranaria'`); aparece en `/juegos/ranaria` y `/salon`.
- Documentación: fila en `references/implemented-games.md` y línea en `CLAUDE.md`.

**Fuera de alcance:**

- Tablas nuevas en Supabase (no existe tabla `games`; no se aplican migraciones).
- Play-page propia: se usa `/juegos/[id]/jugar`.
- Sprites bitmap — todo con primitivas canvas.
- Gamepad / controles táctiles: los añade `mobile-porter` en la Fase 5 (SPEC 10). Este spec solo implementa `setInput` para las 4 direcciones (contrato del handle).
- Animaciones de muerte elaboradas (explosiones, partículas).
- Power-ups (mosca bonus, cocodrilo).
- Supabase Auth / RLS / Realtime.

---

## Data model

### Catálogo (`lib/data.ts`)

```ts
{
  id: "ranaria",
  title: "RANARIA",
  short: "Cruza la carretera y el río sin convertirte en papilla.",
  long: "Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas que se sumergen. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.",
  cat: "ARCADE",
  cover: "cover-rana",
  color: "green",
  best: 0,
  plays: "0",
}
```

### Contrato

Se reutilizan `GameCanvasProps` / `GameCanvasHandle` / `GameEntry` de `lib/games/registry.ts` y `scores` (Supabase) sin cambios. No hay tipos ni tablas nuevas compartidas.

```ts
// lib/games/ranaria/index.ts
export interface RanariaCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
export type RanariaAction = "up" | "down" | "left" | "right";
```

---

## Implementation plan

1. **Catálogo** — añadir la entrada `ranaria` a `GAMES` en `lib/data.ts`.
   Verificación: `/juegos` muestra la card RANARIA con `cover-rana`; `/juegos/ranaria` abre el detalle; `/juegos/ranaria/jugar` corre la simulación genérica (aún sin registry).

2. **Constantes y tipos** — `lib/games/ranaria/utils.ts`:

   ```ts
   export const COLS = 16,
     ROWS = 14,
     CELL = 40;
   export const WIDTH = COLS * CELL; // 640
   export const HEIGHT = ROWS * CELL; // 560
   export const ROW_GOALS = 0,
     ROW_RIVER_TOP = 1,
     ROW_RIVER_BOT = 6,
     ROW_SAFE_MID = 7,
     ROW_ROAD_TOP = 8,
     ROW_ROAD_BOT = 12,
     ROW_START = 13;
   export const GOAL_COLS = [1, 4, 7, 10, 13]; // col izquierda de cada boca (ancho 2)
   export const JUMP_MS = 120,
     DEATH_MS = 600,
     MAX_DT = 50;
   export const TURTLE_UP_MS = 3000,
     TURTLE_DOWN_MS = 1500;
   export const timeLimitFor = (level: number) => Math.max(8, 15 - (level - 1)); // s
   export const speedFactorFor = (level: number) => 1.15 ** (level - 1);
   ```

   Tipos: `Direction`, `Lane { row, kind: "road" | "river", speed, dir: 1 | -1, span, entities }`, `Entity { col, width, type: "car" | "truck" | "log" | "turtle", variant, phase? }`, `Frog { col, row, animating, animT, fromCol, fromRow, targetCol, targetRow, facing }`.

3. **Carriles** — `entities.ts`, `buildLanes(level): Lane[]`:
   - Carretera (filas 8–12): velocidades base 1.5–4 px/frame (a 60 fps) × `speedFactorFor(level)`, sentidos alternos, ≥2 vehículos por carril con huecos ≥2 celdas.
   - Río (filas 1–6): velocidades base 1–3 px/frame × factor; 4 carriles de troncos (2–4 celdas, huecos ≥1) y 2 de tortugas (grupos de 2–3) con desfase de fase por grupo.
   - Loop: cada carril tiene `span = max(COLS + anchoMáx, suma de entidades + huecos)`; al salir por un lado la entidad se reinserta por el opuesto restando/sumando `span`, preservando los huecos.
   - `updateLanes(lanes, dt)`: `entity.col += speed * dir * dt / 16 / CELL` (px/frame → celdas) + avance del ciclo de tortugas.
     Verificación: cada carril con ≥2 entidades y huecos atravesables.

4. **Colisiones y soporte** — en `entities.ts`:
   - `hitsVehicle(frog, lanes)`: en la fila de la rana (carretera), si el centro de la rana (`col + 0.5`) cae en `[e.col, e.col + e.width)` → `true` (con wrap del `span`).
   - `getSupport(frog, lanes)`: entidad del río bajo el centro de la rana, o `null`; tortuga sumergida → `null`.
   - `goalAt(col)`: índice de boca cuyo rango contiene el centro de la rana, o `-1` (seto).

5. **Skins** — `skins.ts`: `clasico` (default), `neon`, `retro`. Cada skin define paleta + funciones de dibujo: fondo por zonas (carretera, río, franjas seguras, bocas/seto), coche, camión, tronco, tortuga (visible/sumergiéndose/sumergida), rana (elipse 28×24 con ojos, patas extendidas en salto), boca ocupada, HUD (texto, iconos de vida, barra de tiempo). Exporta `SKINS`, `DEFAULT_SKIN`, `SKIN_OPTIONS` (swatch `[fondo, rana, acento]`), `isSkinId`. Ningún color hardcodeado fuera de `skins.ts`.

6. **Motor** — `index.ts`, `createRanariaGame(canvas, callbacks, { skin })`, mismo esqueleto que Serpentina:
   - `requestAnimationFrame` con `dt` acotado a `MAX_DT`; `pause()` cancela el loop y redibuja estático; `resume()` lo reanuda; `restart()` reinicia todo y reemite score/vidas/nivel.
   - `update(dt)`: carriles → salto (inicio desde `pendingDir`, avance de `animT`, aterrizaje a los 120 ms con resolución de celda: puntuación por fila nueva, meta, muerte) → arrastre en el río (si no anima) y muerte por borde → re-chequeo de vehículo y soporte (los vehículos/tortugas pueden alcanzar a la rana quieta) → temporizador.
   - Al aterrizar fuera del río la columna se redondea a entero.
   - `completeRound()`: +200, vacía bocas, `level++` + `onLevel`, `buildLanes(level)`, rana a la base (col 7), temporizador reiniciado.
   - `killFrog()`: `lives--`, `onLives(lives)`; si 0 → `onGameOver(score)` y detiene el loop; si no → parpadeo `DEATH_MS` y reaparición.
   - Callbacks solo si el valor cambia (salvo la emisión inicial en reset).
   - Listeners: `keydown`/`blur` en `window`; se quitan en `destroy()`.

7. **Componente + registry** — `components/ranaria-canvas.tsx` (patrón `snake-canvas.tsx`; estilo: `position:absolute; top:0; left:50%; translateX(-50%); height:100%; aspect-ratio: 8/7`), `setInput` filtrando acciones válidas; entrada `ranaria` en `GAME_CANVASES` (`hasLives: true`, `skins`, `defaultSkin`).
   Verificación: `/juegos/ranaria/jugar` corre el juego real; el HUD React refleja score, vidas y nivel; PAUSA/REANUDAR funcionan; el selector de skin cambia el render sin reiniciar.

8. **Docs** — `references/implemented-games.md` (tabla + descripción) y `CLAUDE.md` (specs done / games).

9. **Verificación final** — `npx tsc --noEmit`, `npm run lint`, `npm run build` sin errores. Ninguna ruta existente devuelve 500.

---

## Acceptance criteria

- [ ] La card RANARIA aparece en `/juegos` con `cover-rana`, y `/juegos/ranaria` muestra el detalle.
- [ ] `/juegos/ranaria/jugar` carga sin errores de SSR ni de TypeScript y usa el canvas real (registry).
- [ ] El canvas (640 × 560) se ve centrado en el CRT sin deformarse, con zonas diferenciadas (carretera, río, franjas seguras, bocas).
- [ ] La rana aparece centrada en la fila de inicio al cargar la partida.
- [ ] La rana salta exactamente una celda por pulsación (flechas / WASD) con animación de 120 ms.
- [ ] La rana no puede salir por los bordes laterales ni por debajo de la base.
- [ ] Coches y camiones se mueven en loop por sus carriles y se reintroducen por el lado opuesto.
- [ ] Troncos y tortugas se mueven en loop y arrastran a la rana.
- [ ] Las tortugas alternan visible (3 s) / sumergida (1.5 s).
- [ ] La rana muere por vehículo, agua, tortuga sumergida, borde del río, tiempo agotado y boca ocupada / seto.
- [ ] Al morir se emite `onLives(lives)` y la rana vuelve a la base tras el parpadeo.
- [ ] Boca libre → marcada + 50 + bonus de tiempo.
- [ ] 5 bocas → +200, `level` incrementado, `onLevel(level)`, más velocidad y menos tiempo.
- [ ] `onScore` se dispara en cada cambio de puntuación.
- [ ] HUD interno (score, nivel, vidas-iconos, barra de tiempo) dibujado correctamente.
- [ ] PAUSA congela el juego; REANUDAR lo reanuda; P / Esc no pausan el canvas.
- [ ] Con `lives = 0` se emiten `onLives(0)` y `onGameOver(score)`; aparece el modal del `GamePlayer`.
- [ ] Guardar el score inserta en `scores` con `game_id = 'ranaria'` y aparece en `/juegos/ranaria` y `/salon` al recargar.
- [ ] "JUGAR DE NUEVO" reinicia la partida desde cero.
- [ ] Las 3 skins (`clasico`, `neon`, `retro`) cambian el render en caliente.
- [ ] `tsc`, `lint` y `npm run build` sin errores; ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: Integración vía registry + `GamePlayer`** — como Rocas, Caída, Bloque Buster y Serpentina. Razón: el repo no tiene tabla `games` ni play-pages por juego; HUD React, modal, guardado de score, skins y gamepad ya viven en `GamePlayer`.
- **Sí: Nombre RANARIA, id `ranaria`** — juego original del género "cruce de carretera"; nombre y cover ya previstos en los templates.
- **Sí: Primitivas canvas sin sprites bitmap.**
- **Sí: Cuadrícula discreta de 40 px con salto de 120 ms** — colisiones por filas/celdas; en el río la columna es fraccionaria por el arrastre.
- **Sí: Doble HUD** — HUD del canvas en la fila 13 + barra de tiempo en la fila 0 (el canvas no tiene franja extra para HUD).
- **Sí: 3 vidas, tortugas con ciclo de inmersión, temporizador, 5 bocas.**
- **Sí: Canvas 640 × 560 con `aspect-ratio: 8/7`** centrado en el CRT 4:3.
- **Sí: 3 skins con el contrato existente** — requisito de plataforma (selector de skin en `GamePlayer`, auditoría `skin-designer`).
- **Sí: Puntos por fila nueva por trayecto** (no por ronda) — si fuese por ronda, tras la primera boca los siguientes trayectos no puntuarían avance.
- **No: Movimiento continuo, cocodrilo, mosca, partículas, `CanvasGame` genérico, RLS, Realtime.**
