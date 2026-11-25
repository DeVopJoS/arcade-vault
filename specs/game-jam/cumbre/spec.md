# SPEC JAM — Juego CUMBRE (cumbre) integrado en el reproductor con leaderboard

> **Status:** Borrador
> **Game jam:** escalada / ascenso vertical (2026-11-24)
> **Depends on:** SPEC 01 (`GamePlayer`, datos), SPEC 05 (patrón de juego en canvas), SPEC 06 (leaderboard Supabase), SPEC 07 (registro `lib/games/registry.ts`)
> **Date:** 2026-11-24
> **Objective:** Crear desde cero CUMBRE, un puzzle de rutas de escalada en una pared de agarres de neón donde cada movimiento cuesta energía y hay que encadenar largos contra reloj, montarlo en `GamePlayer` vía el registro (`cumbre`) y que su puntaje llegue al Salón de la Fama.

---

## Por qué existe esta spec

**Interpretación del tema "escalada / ascenso vertical":** la escalada como lectura de ruta. Cada pantalla es un "largo" (tramo de pared) de 7×8 agarres; el escalador sube agarre a agarre y cada agarre tiene un coste de energía visible. La energía se arrastra de un largo al siguiente, así que gastar de más ahora te deja sin ruta después. Es la interpretación PUZZLE del tema (planificar, no reflejos), distinta de ESCALADA (ARCADE: rebotar hacia arriba) y MURALLA (SHOOTER: impedir que otros suban) de la misma jam.

Concepto basado en el género "puzzle de rutas por casillas con recurso"; no recrea ningún juego comercial concreto. No solapa con ideas del registro (`circuito`, `cerrojo`, `espejos`, `fusion` son puzzles de otra mecánica).

Estado actual:

- `cumbre` **no existe** en `GAMES` (`lib/data.ts`) ni en `GAME_CANVASES` (`lib/games/registry.ts`); sin entrada, `GamePlayer` caería en la simulación de puntaje.
- `cumbre` **no está** en el CHECK `scores_game_id_chk` → hace falta migración.
- No hay portada: se crea `.cover-cumbre` en `app/globals.css` y se amplía `CoverClass`.
- Fuente: **desde cero** (nada en `references/started-games/` ni assets en `references/source-assets/`). Todo vectorial neón.

Antes de escribir código Next: leer la guía relevante en `node_modules/next/dist/docs/` (AGENTS.md; `cacheComponents` activo; Client Components).

> Estado real inspeccionado (2026-11-24): CHECK vigente leído en Supabase = `CHECK ((game_id = ANY (ARRAY['bloque-buster'::text, 'caida'::text, 'serpentina'::text, 'gloton'::text, 'invasores'::text, 'rocas'::text, 'ranaria'::text, 'duelo-pixel'::text])))`. `list_tables(public)` = `scores` (RLS on, 4 filas); `information_schema` confirma las vistas `scores_best` y `game_stats`. `GAMES` = `rocas, caida, bloque-buster, serpentina` (único PUZZLE: `caida`). `GAME_CANVASES` = esos cuatro. `CATS` = `TODOS, ARCADE, PUZZLE, SHOOTER`. `CoverClass` tiene 8 portadas, ninguna para este juego. `app/globals.css` tiene `--cyan: #00f5ff` y `.touch-controls/.touch-btn/.touch-cluster/.touch-rot` (+ variante `.touch-snake` con D-pad en rejilla 3×2, modelo para el abanico de 5 botones). No hay `supabase/migrations/` en el repo (migraciones solo vía MCP).

---

## Scope

**In:**

- Motor en `lib/games/cumbre/` (sin globals; `window`/`document` solo en `start()`).
- Factory `createCumbreGame(canvas, callbacks, options)` con `start/pause/resume/restart/destroy/setInput`.
- `components/cumbre-canvas.tsx` + controles táctiles (tocar el agarre destino en el canvas + abanico de 5 botones), variante `.touch-cumbre`.
- Registro: `cumbre: { component: CumbreCanvas, hasLives: false }`. `GamePlayer` no cambia.
- Entrada `cumbre` en `GAMES` (categoría `PUZZLE`, `cover-cumbre`, color `cyan`); `CoverClass` amplía con `"cover-cumbre"`; CSS `.cover-cumbre`.
- Migración que amplía `scores_game_id_chk` con `cumbre` (lista completa vigente + nuevo id).
- HUD/pausa/FIN/modal de la plataforma; el canvas no dibuja puntaje, nivel, "PAUSA" ni "GAME OVER". Sí dibuja indicadores propios del juego: barra de energía y barra de tiempo (ver Decisiones).

**Reglas:**

_Pared_

- Resolución lógica 800×600. Pared de 7 columnas × 8 filas; celda 72×64 px; origen `x0 = 148`, `y0 = 60` (pared de 504×512 px, centrada). Fila 0 = arriba, fila 7 = abajo.
- Cada celda está vacía o tiene un agarre (círculo de radio 16 px en el centro de la celda) de un tipo:
  - **BUENO** (verde, `--green`): coste 1.
  - **REGULAR** (amarillo, `--yellow`): coste 2.
  - **MALO** (magenta, `--magenta`): coste 3.
  - **REPOSO** (cian, `--cyan`): coste 0 y **+4 de energía** la primera vez que se pisa; después pasa a BUENO.
- Dentro de cada agarre se dibuja su coste (`1`, `2`, `3`, `+4`) en tipografía mono 14 px.

_Movimiento_

- El escalador ocupa un agarre. Movimientos posibles (5): arriba `(f−1, c)`, arriba-izquierda `(f−1, c−1)`, arriba-derecha `(f−1, c+1)`, izquierda `(f, c−1)`, derecha `(f, c+1)`. **Nunca hacia abajo.**
- El destino debe tener agarre y `energía ≥ coste`. Al moverse: `energía −= coste` (REPOSO: `+4`, tope 40), animación de 180 ms durante la cual la entrada se guarda en un búfer de 1 movimiento.
- Movimiento inválido (vacío, fuera de la pared o sin energía): el agarre destino (si existe) tiembla en rojo 150 ms; no se gasta nada.
- Los destinos válidos se resaltan con un anillo discontinuo pulsante; los que no se pueden pagar, con anillo rojo tenue.

_Largos (niveles)_

- Inicio de largo: el escalador está en la fila 7, columna 3 (largo 1) o en la columna en la que coronó el largo anterior; ese agarre es siempre BUENO.
- Coronar: llegar a cualquier agarre de la fila 0 completa el largo → transición de 600 ms (la pared se desliza hacia abajo y entra la nueva) → largo `n + 1`. Nivel = número de largo; `onLevel` solo al cambiar.
- Al coronar: `energía = min(40, energía + 8)`; `tiempo = min(99, tiempo + max(5, 14 − n))` s (largo 1: +13 s; largo 9 en adelante: +5 s).

_Generador (garantiza solución)_

- Primero se traza la **vía garantizada**: desde la columna de inicio, para cada fila 6…0 se elige la siguiente columna en `{c−1, c, c+1} ∩ [0, 6]` al azar. Sus 7 agarres son BUENOS salvo `k = min(4, floor(n / 2))` elegidos al azar que son REGULARES → coste de la vía = `7 + k` (largo 1: 7; largo 8+: 11).
- El resto de celdas: vacía con probabilidad `pVacio(n) = min(0.55, 0.30 + 0.03·(n − 1))`; si no, tipo según pesos `BUENO max(0.20, 0.45 − 0.03·(n − 1))`, `REGULAR 0.25`, `MALO min(0.45, 0.22 + 0.03·(n − 1))`, `REPOSO 0.08` (normalizados; máximo 2 REPOSO por largo).
- La vía garantizada no se marca visualmente; puede haber rutas más baratas por azar (encontrarlas es el puzzle).

_Energía, tiempo, puntaje y fin_

- Energía inicial 30, máximo 40.
- Tiempo inicial 90 s; corre solo durante el juego (no en pausa ni durante la transición de largo).
- Puntaje: `+10 · n` la primera vez que se alcanza cada fila nueva del largo (filas 6…0, 7 por largo) y `+50 · n` al coronar. `onScore` al cambiar.
- Fin (una de):
  - **Sin tiempo**: el tiempo llega a 0.
  - **Bloqueado**: tras un movimiento, ningún destino válido es pagable (ninguno de los 5 con agarre y `coste ≤ energía`).
- Al terminar: el escalador resbala y cae girando 800 ms (la cuerda se rompe) y luego `onGameOver(score)` una sola vez. Sin vidas: `hasLives: false`.
- Duración esperada: 2–4 min (el tiempo extra por largo baja a 5 s y la vía garantizada cuesta más que la energía que se recupera desde el largo 8).

**Controles:**

- Teclado: `↑`/`W` arriba; `←`/`A` izquierda; `→`/`D` derecha; `Q` arriba-izquierda; `E` arriba-derecha. Un movimiento por pulsación (`KeyboardEvent.repeat` ignorado). `preventDefault` solo en flechas.
- Puntero (ratón y táctil): clic/toque sobre un agarre destino válido mueve allí (radio de toque 30 px alrededor del centro del agarre). Listener `pointerdown` en el `canvas`, `touch-action: none`.
- Táctil (`pointer: coarse`): además, abanico de 5 botones (↖ ↑ ↗ en la fila superior, ← → en la inferior) abajo a la derecha, variante `.touch-cumbre`.

**Animaciones (por código, tiempo solo dentro del loop):**

- Escalador: figura de palitos neón cian con manos y pies sobre agarres; al moverse, la mano adelantada llega primero (0–90 ms) y el cuerpo la sigue (90–180 ms), ease-out.
- Cuerda: línea tenue desde el agarre de inicio del largo hasta el escalador, con leve catenaria.
- Agarres: brillo pulsante (alpha 0.6→1, 1.6 s, fase distinta por celda); REPOSO al usarse emite un anillo cian expansivo y texto `+4` que sube 20 px y se desvanece (500 ms).
- Destinos válidos: anillo discontinuo que gira lentamente (1 vuelta / 3 s).
- Inválido: temblor horizontal ±4 px en 150 ms, tinte rojo.
- Coronar: destello en la fila 0 y transición de 600 ms (pared saliente baja, entrante entra desde arriba).
- Indicadores: barra de energía vertical a la izquierda (`x = 60`, `y = 60`, alto 512, ancho 16) con marcas cada 10; parpadea en magenta con energía ≤ 5. Barra de tiempo horizontal arriba (`y = 24`, de `x = 148` a `x = 652`); se vuelve magenta y parpadea con ≤ 10 s.
- Fin: el escalador cae girando y la cuerda se parte en dos segmentos (800 ms).

**Out of scope:**

- Sonido, vibración, música.
- Movimientos hacia abajo, deshacer, pistas que revelen la vía garantizada, agarres que se desmoronan, clima/viento.
- Modo sin tiempo, selector de largo, pausa por teclado (`P`/`Esc`), persistencia local.
- Anti-trampa, Auth, otros juegos, tests, modificar `references/`.

---

## Data model

```ts
// lib/games/cumbre/index.ts — interfaz común
export interface CumbreCallbacks {
  onScore: (score: number) => void; // filas nuevas y coronar
  onLives: (lives: number) => void; // no se usa (hasLives:false); se acepta por contrato, no se invoca
  onLevel: (level: number) => void; // número de largo
  onGameOver: (finalScore: number) => void; // sin tiempo o bloqueado
}

export type CumbreAction = "up" | "upLeft" | "upRight" | "left" | "right";

export interface CumbreGame {
  start(): void; // registra listeners (teclado, blur, pointerdown en canvas) y arranca el loop
  pause(): void; // congela tiempo y animaciones; vacía el búfer de movimiento
  resume(): void; // reinicia lastTime
  restart(): void; // score 0, largo 1, energía 30, tiempo 90 s, pared nueva
  destroy(): void; // idempotente: cancela rAF y quita listeners
  setInput(action: CumbreAction, down: boolean): void; // teclado y botones (solo down=true mueve)
}

export function createCumbreGame(
  canvas: HTMLCanvasElement,
  callbacks: CumbreCallbacks,
  options?: {
    color?: string; // --cyan: escalador, cuerda, REPOSO, marcos
    goodColor?: string; // --green
    fairColor?: string; // --yellow
    badColor?: string; // --magenta
  },
): CumbreGame;
```

```ts
// lib/games/cumbre/wall.ts — tipos y funciones puras
export type HoldKind = "good" | "fair" | "bad" | "rest";
export type Cell = HoldKind | null; // null = vacía

export const COLS = 7;
export const ROWS = 8;
export const COST: Record<HoldKind, number> = {
  good: 1,
  fair: 2,
  bad: 3,
  rest: 0,
};

export interface Wall {
  cells: Cell[][]; // [fila][columna]
  startCol: number;
}

export function generateWall(
  level: number,
  startCol: number,
  rng: () => number,
): Wall;
export function neighbors(
  row: number,
  col: number,
): { action: CumbreAction; row: number; col: number }[];
export function canAfford(
  wall: Wall,
  row: number,
  col: number,
  energy: number,
): boolean;
export function isStuck(
  wall: Wall,
  row: number,
  col: number,
  energy: number,
): boolean;
```

```ts
// lib/games/registry.ts — solo se añade una línea (+ import)
import CumbreCanvas from "@/components/cumbre-canvas";
cumbre: { component: CumbreCanvas, hasLives: false },
```

```ts
// lib/data.ts — CoverClass amplía con "cover-cumbre"; nueva entrada en GAMES
// (best/plays son fallback mock; las cifras reales vienen de game_stats)
{
  id: "cumbre", title: "CUMBRE", cat: "PUZZLE", cover: "cover-cumbre", color: "cyan",
  short: "Lee la pared, administra tu energía y corona antes del tiempo.",
  long: "Cada largo es una pared de agarres de neón y cada agarre cuesta energía. Elige la ruta más barata hasta la cima, aprovecha los puntos de reposo y guarda fuerzas para el siguiente tramo. El reloj no espera y las paredes se vuelven cada vez más avaras.",
  best: 0, plays: "0",
}
```

```sql
-- Migración (apply_migration, nombre: add_cumbre_to_scores_game_id_chk)
-- Lista = CHECK vigente (2026-11-24) + 'cumbre'. Si otro juego (de esta jam: escalada, muralla;
-- o de jams previas: abismo) ya amplió el CHECK, releerlo e incluir también esos ids antes de aplicar.
alter table public.scores drop constraint if exists scores_game_id_chk;
alter table public.scores add constraint scores_game_id_chk
  check (game_id in (
    'bloque-buster', 'caida', 'serpentina', 'gloton', 'invasores',
    'rocas', 'ranaria', 'duelo-pixel', 'cumbre'
  ));
```

Estructura de archivos:

```
lib/games/cumbre/
  index.ts     // createCumbreGame, loop, estado (energía, tiempo, largo), input (teclas, botones, puntero), callbacks
  wall.ts      // tipos, COST, generateWall (vía garantizada + relleno), neighbors, canAfford, isStuck
  entities.ts  // escalador (pose, tween), cuerda, partículas/textos, dibujo neón de pared, agarres e indicadores
  utils.ts     // constantes (800×600, celda 72×64, origen 148/60), clamp, easing, puntero → celda
components/cumbre-canvas.tsx
app/globals.css  // + .cover-cumbre, + .touch-cumbre
```

Convenciones:

- Resolución lógica fija 800×600 (4:3, igual que `.crt-screen`); escalado por CSS como `snake-canvas.tsx`. Fondo transparente con textura de roca dibujada (líneas diagonales tenues alpha ≤ 0.06).
- Estilo neón: agarres con relleno `rgba(color,.25)` + trazo + `shadowBlur` 10.
- Colores: `getComputedStyle(canvas)` para `--cyan`, `--green`, `--yellow`, `--magenta`; fallbacks `#00f5ff`, `#00ff88`, `#f5ff00`, `#ff006e`.
- Puntero → celda: `x_lógico = (clientX − rect.left) × (800 / rect.width)`, ídem `y` con `600 / rect.height`; se busca el destino válido cuyo centro esté a ≤ 30 px.
- Indicadores en canvas permitidos (son mecánica, no HUD de plataforma): barra de energía, barra de tiempo y costes en los agarres. Nada de puntaje/nivel/vidas/"PAUSA"/"GAME OVER".
- `Math.random` solo tras montar (`generateWall` en `start()`/`restart()`/al coronar, con `rng` inyectable).
- Callbacks solo al cambiar el valor (`onScore` al puntuar, `onLevel` al coronar); ambos se emiten una vez al arrancar/reiniciar con `0` y `1`.
- Un solo `onGameOver` por partida (flag `ended`); tras la animación el loop se detiene.
- `dt` capado a 0.05 s; `resume()` reinicia `lastTime`; el tiempo de juego se descuenta con `dt` dentro del loop (sin `setInterval`).
- Búfer de 1 movimiento durante el tween; se vacía en `pause()`, `restart()`, `destroy()` y `blur` de ventana.
- `preventDefault` solo en flechas, mientras el juego está montado.

---

## Implementation plan

Antes del paso 1: leer `node_modules/next/dist/docs/` (Client Components), el CSS de `.crt-screen`, `.cover-*` y `.touch-*` (en especial `.touch-snake`) en `app/globals.css`, y `components/snake-canvas.tsx` + `lib/games/snake/` como modelo. Invocar `/frontend-design` antes de los pasos 5 y 7.

1. **Pared y utils.** `utils.ts` (constantes, puntero → celda, easing) y `wall.ts` (`generateWall` con vía garantizada de coste `7 + k`, relleno por pesos, tope de 2 REPOSO; `neighbors`, `canAfford`, `isStuck`). Funciones puras con `rng` inyectable. Verificar: `npx tsc --noEmit`; comprobar en desarrollo (script temporal o `console.assert` fuera del build) que 1000 paredes generadas por nivel 1–12 contienen la vía garantizada con coste `7 + min(4, floor(n/2))`.
2. **Motor.** `index.ts` + `entities.ts`: loop rAF con `dt` capado, energía/tiempo, movimientos con validación y tween de 180 ms con búfer, REPOSO, coronar y transición, puntaje por fila/corona, detección de bloqueo y sin tiempo, animación de caída y `onGameOver` único, `destroy()` idempotente. Sin HUD. Verificar: `npx tsc --noEmit` y `npm run lint`.
3. **Componente canvas.** `components/cumbre-canvas.tsx` (client): `callbacksRef`, juego en `useEffect([])`, `destroy()` en cleanup, colores vía `getComputedStyle`, `ref` con `pause/resume/restart`, abanico de 5 botones (`onPointerDown` → `setInput(action, true)`, `tabIndex={-1}`, `aria-label`). Verificar: `npx tsc --noEmit`.
4. **Registro.** Entrada `cumbre` en `GAME_CANVASES` (`hasLives: false`). Verificar: compila; `/juegos/cumbre/jugar` aún 404 hasta el paso 5; los otros cuatro juegos igual.
5. **Datos, portada y migración.** `CoverClass` + `.cover-cumbre` (degradado `#001e2a → #0a0a18`; rejilla de agarres verdes/amarillos/magenta, una ruta de cuerda cian en zigzag hasta un pico triangular arriba; `drop-shadow` cian) + entrada en `GAMES`. Releer el CHECK con `execute_sql` y `apply_migration` con la lista completa vigente + `cumbre`. Verificar: `/juegos` (filtro PUZZLE muestra CAÍDA y CUMBRE), `/juegos/cumbre`, `/juegos/cumbre/jugar`; `execute_sql` insert de prueba con `game_id='cumbre'` pasa y se borra la fila; insert con `rocas` sigue pasando; `get_advisors` (security) sin problemas nuevos.
6. **Pausa, FIN, reinicio y guardado.** PAUSA/REANUDAR/FIN/JUGAR DE NUEVO contra el juego real; HUD con puntaje y nivel (largo), sin vidas; GUARDAR PUNTUACIÓN crea fila `cumbre`. Verificar: fila en `scores` vía `execute_sql` y pestaña CUMBRE en `/salon` (antes de guardar: `AÚN SIN CAMPEONES — SÉ EL PRIMERO`).
7. **Estilo y táctil.** Pulir neón de agarres, escalador, cuerda e indicadores; `.touch-cumbre` (rejilla 3×2: ↖ ↑ ↗ / ← · →, botones `clamp(40px, 10vw, 54px)`, `opacity: .55`, color `--cyan`, abajo a la derecha fuera de la pared). Verificar: emulación táctil en DevTools; tocar agarres y botones mueve; sin scroll de página.
8. **Cierre.** `npm run build`, `npm run lint`; entrar/salir de `/juegos/cumbre/jugar` varias veces sin listeners duplicados (un movimiento por pulsación); los otros cuatro juegos intactos.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `/juegos/cumbre/jugar` muestra el juego real (pared 7×8 de agarres, escalador, barras de energía y tiempo), sin arena decorativa.
- [ ] `↑`/`W`, `←`/`A`, `→`/`D`, `Q`, `E` mueven un agarre por pulsación en la dirección indicada; nunca hacia abajo; ninguna tecla hace scroll.
- [ ] Tocar/clicar un agarre destino válido mueve allí; tocar uno inválido no hace nada (o tiembla).
- [ ] Cada movimiento resta el coste del agarre (1/2/3); REPOSO suma 4 una sola vez (tope 40) y luego vale como BUENO.
- [ ] Sin energía suficiente el movimiento se rechaza con temblor rojo y no gasta nada.
- [ ] Cada fila nueva suma `10 × largo`; coronar suma `50 × largo`, +8 de energía y `max(5, 14 − largo)` s; el nivel del HUD sube con cada largo.
- [ ] Toda pared generada tiene al menos una ruta desde el inicio a la fila 0 con coste `7 + min(4, floor(largo/2))`.
- [ ] Quedarse sin tiempo o sin ningún movimiento pagable abre el modal FIN DEL JUEGO con la puntuación correcta, una sola vez.
- [ ] El HUD refleja puntuación y nivel; sin vidas visibles (`hasLives: false`); el canvas no dibuja puntaje, nivel, "PAUSA" ni "GAME OVER" (solo energía, tiempo y costes).
- [ ] PAUSA congela tiempo y animaciones e ignora la entrada; REANUDAR continúa sin salto de tiempo; FIN detiene el juego; JUGAR DE NUEVO deja puntaje 0, nivel 01, energía 30, tiempo 90 s, pared nueva.
- [ ] GUARDAR PUNTUACIÓN crea fila en `scores` con `game_id = 'cumbre'`.
- [ ] El Salón muestra la pestaña CUMBRE; vacía muestra `AÚN SIN CAMPEONES — SÉ EL PRIMERO`; stats reflejan la partida.
- [ ] El CHECK incluye todos los ids previos + `cumbre`; insert con `rocas`, `caida`, `bloque-buster`, `serpentina` y `cumbre` pasa; `get_advisors` sin problemas nuevos.
- [ ] Sin listeners duplicados al salir y volver (un movimiento por pulsación).
- [ ] El abanico de 5 botones es visible solo con `pointer: coarse`; tocar agarres funciona con o sin él; sin scroll de página.
- [ ] `rocas`, `caida`, `bloque-buster` y `serpentina` siguen funcionando igual.
- [ ] Sin errores de consola ni warnings de hydration (incluido Strict Mode).

---

## Decisiones

- **Sí:** id `cumbre`, carpeta `lib/games/cumbre/`, `cumbre-canvas.tsx` (juego original: carpeta = id).
- **Sí:** categoría `PUZZLE` (acompaña a CAÍDA), color `cyan`. _(Abierta: color.)_
- **Sí:** sin movimientos hacia abajo: refuerza el tema y evita bucles infinitos de exploración.
- **Sí:** energía que se arrastra entre largos: es lo que convierte cada pared en una decisión con consecuencias.
- **Sí:** vía garantizada siempre presente: ninguna pared es imposible por azar; el fin depende de la gestión del jugador.
- **Sí (abierta):** límite de tiempo global (90 s + `max(5, 14 − n)` por largo, tope 99). Mantiene la partida < 5 min y premia leer rápido; alternativa: sin tiempo y solo energía (partidas más largas, menos arcade).
- **Sí (abierta):** balance (energía 30/40, +8 por largo, costes 1/2/3, REPOSO +4, probabilidades de vacío/tipos por nivel, `k = min(4, floor(n/2))`). Ajustables tras probar.
- **Sí (abierta):** barras de energía y tiempo dibujadas en el canvas. El HUD de la plataforma solo tiene puntaje/vidas/nivel; son mecánica, no HUD.
- **Sí:** `hasLives: false`.
- **Sí:** migración del CHECK en el mismo PR (drop + add con lista completa).
- **No:** deshacer, pistas, movimientos hacia abajo, sonido, `P`/`Esc`.

---

## Riesgos

| Riesgo                                                       | Mitigación                                                                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict Mode duplica listeners/loops                          | `destroy()` idempotente: cancela rAF, quita listeners de teclado, `blur` y `pointerdown` del canvas                                          |
| `window`/`Math.random` rompen SSR                            | Juego creado en `useEffect`; `generateWall` y listeners solo tras `start()`                                                                  |
| Teclas hacen scroll o reactivan botones enfocados            | `preventDefault` acotado a flechas; `blur()` de botones de la plataforma                                                                     |
| `dt` enorme tras pausa descuenta tiempo de golpe             | `resume()` reinicia `lastTime`; `dt` capado a 0.05 s                                                                                         |
| Movimientos "pegados" o dobles al perder foco                | Un movimiento por `keydown` sin `repeat`; búfer de 1 vaciado en `pause()`, `restart()`, `destroy()` y `blur`                                 |
| CSS var no sirve en canvas                                   | `getComputedStyle` al crear el juego, con fallbacks hex                                                                                      |
| Id fuera del CHECK falla el insert                           | Migración en el mismo PR; verificada con insert de prueba                                                                                    |
| Las 3 specs de la jam (y `abismo`) reescriben el mismo CHECK | Releer el CHECK justo antes de aplicar; lista = vigente + `cumbre` (+ ids de jam ya integrados); drop + add idempotente, el orden no importa |
| Pared generada sin solución                                  | La vía garantizada se escribe antes del relleno y el relleno nunca la sobrescribe; verificación de 1000 paredes en el paso 1                 |
| Vía garantizada más cara que la energía restante             | Es fin legítimo (gestión del recurso); el bloqueo se detecta y termina con animación clara                                                   |
| Toque ambiguo entre agarres vecinos                          | Solo se consideran destinos válidos (máx. 5) y gana el más cercano a ≤ 30 px                                                                 |
| Abanico táctil tapa la pared                                 | Ubicado abajo a la derecha (x > 652, fuera de la pared) con opacidad .55; validar con `/frontend-design`                                     |
| Texto de coste ilegible en móviles pequeños                  | Mono 14 px lógicos con contraste alto; los colores también codifican el coste                                                                |
| `best/plays` mock en `GAMES` no coinciden con reales         | Son solo fallback; la UI ya lee `game_stats`                                                                                                 |
| DPR alto vuelve borroso el canvas escalado                   | Aceptado; manejar `devicePixelRatio` si se nota                                                                                              |

---

## Qué **no** está en esta spec

- Sonido, vibración, música.
- Deshacer, pistas, agarres que se desmoronan, viento, movimientos hacia abajo.
- Modo sin tiempo, selector de largo, pausa por teclado (`P`/`Esc`), persistencia local.
- Anti-trampa en puntajes y Auth.
- Los otros juegos de la jam (`escalada`, `muralla`), `abismo` y ports pendientes (`gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
