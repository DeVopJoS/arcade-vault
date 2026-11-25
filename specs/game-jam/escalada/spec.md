# SPEC JAM — Juego ESCALADA (escalada) integrado en el reproductor con leaderboard

> **Status:** Borrador
> **Game jam:** escalada / ascenso vertical (2026-11-24)
> **Depends on:** SPEC 01 (`GamePlayer`, datos), SPEC 05 (patrón de juego en canvas), SPEC 06 (leaderboard Supabase), SPEC 07 (registro `lib/games/registry.ts`)
> **Date:** 2026-11-24
> **Objective:** Crear desde cero ESCALADA, un saltador vertical infinito donde el personaje rebota solo de plataforma en plataforma y el puntaje es la altura máxima alcanzada en metros, montarlo en `GamePlayer` vía el registro (`escalada`) y que su puntaje llegue al Salón de la Fama.

---

## Por qué existe esta spec

**Interpretación del tema "escalada / ascenso vertical":** el ascenso en estado puro. El jugador solo controla el movimiento horizontal; el salto es automático al tocar una plataforma. Cuanto más sube, más separadas, estrechas y traicioneras son las plataformas. El puntaje es literalmente la altura (1 m = 10 px), un número que cualquiera entiende y compara. Es la interpretación "ARCADE de reflejos" del tema, distinta de MURALLA (SHOOTER: impedir que otros escalen) y CUMBRE (PUZZLE: planificar la ruta de agarres) de la misma jam.

**Origen:** es la sugerencia existente `escalada` del registro compartido (`.claude/agent-memory/game-planner/suggestions.md`, 2026-11-22: "ESCALADA — ARCADE — sugerido — 30/35: saltador vertical infinito, puntaje = altura"; `references/game-suggestions-todo.md`: "ARCADE · neón green · 30/35 · saltador vertical infinito, puntaje = altura · media"). Se respetan id, título, categoría `ARCADE`, color `green` y complejidad media. Esta jam la pasa a `en-spec`.

Concepto basado en el género "saltador vertical infinito"; no recrea ningún juego comercial concreto (ni personajes, ni arte, ni niveles): personaje abstracto neón, plataformas vectoriales, generación procedural propia.

Estado actual:

- `escalada` **no existe** en `GAMES` (`lib/data.ts`) ni en `GAME_CANVASES` (`lib/games/registry.ts`); sin entrada, `GamePlayer` caería en la simulación de puntaje.
- `escalada` **no está** en el CHECK `scores_game_id_chk` → hace falta migración.
- No hay portada: se crea `.cover-escalada` en `app/globals.css` y se amplía `CoverClass`.
- Fuente: **desde cero** (nada en `references/started-games/` ni assets en `references/source-assets/`). Todo vectorial neón.

Antes de escribir código Next: leer la guía relevante en `node_modules/next/dist/docs/` (AGENTS.md; `cacheComponents` activo; Client Components).

> Estado real inspeccionado (2026-11-24): CHECK vigente leído en Supabase = `CHECK ((game_id = ANY (ARRAY['bloque-buster'::text, 'caida'::text, 'serpentina'::text, 'gloton'::text, 'invasores'::text, 'rocas'::text, 'ranaria'::text, 'duelo-pixel'::text])))`. `list_tables(public)` = `scores` (RLS on, 4 filas); `information_schema` confirma las vistas `scores_best` y `game_stats`. `GAMES` = `rocas, caida, bloque-buster, serpentina`. `GAME_CANVASES` = esos cuatro (`hasLives`: `true, false, true, false`). `CATS` = `TODOS, ARCADE, PUZZLE, SHOOTER`. `CoverClass` = `cover-bricks, cover-tetro, cover-snake, cover-glot, cover-invaders, cover-rocas, cover-rana, cover-duelo`. `app/globals.css` tiene `--green: #00ff88`, `.touch-controls/.touch-btn/.touch-cluster/.touch-right/.touch-rot` (+ variantes `.touch-tetris`, `.touch-arkanoid`, `.touch-snake`) dentro de `@media (pointer: coarse)`. Spec de jam previa en `specs/game-jam/abismo/` (no integrada). No hay `supabase/migrations/` en el repo (migraciones solo vía MCP).

---

## Scope

**In:**

- Motor en `lib/games/escalada/` (sin globals; `window`/`document` solo en `start()`).
- Factory `createEscaladaGame(canvas, callbacks, options)` con `start/pause/resume/restart/destroy/setInput`.
- `components/escalada-canvas.tsx` + controles táctiles (botones ← → de mantener + mantener pulsada la mitad izquierda/derecha del canvas), variante `.touch-escalada`.
- Registro: `escalada: { component: EscaladaCanvas, hasLives: false }`. `GamePlayer` no cambia.
- Entrada `escalada` en `GAMES` (categoría `ARCADE`, `cover-escalada`, color `green`); `CoverClass` amplía con `"cover-escalada"`; CSS `.cover-escalada`.
- Migración que amplía `scores_game_id_chk` con `escalada` (lista completa vigente + nuevo id).
- HUD/pausa/FIN/modal de la plataforma; el canvas no dibuja puntaje, nivel, "PAUSA" ni "GAME OVER". Solo dibuja marcas de altitud del mundo cada 50 m (ver Decisiones).

**Reglas:**

_Mundo y cámara_

- Resolución lógica 800×600. Coordenadas de mundo con `y` hacia abajo; el mundo es infinito hacia arriba (`y` negativos).
- Escala: **10 px = 1 m**. Plataforma base: ancho completo (x 0–800) con borde superior en `y = 560`.
- `alturaPx = 560 − minPiesY` (mínimo `y` de los pies alcanzado en la partida); `altura_m = floor(alturaPx / 10)`.
- Cámara: `cameraY` (y de mundo del borde superior de pantalla), inicial `0`. Si `pies.y − cameraY < 240` → `cameraY = pies.y − 240`. La cámara **solo sube**, nunca baja.
- Borde lateral envolvente: si el centro del personaje pasa de `x < 0` → `x += 800`; `x ≥ 800` → `x −= 800`. Cerca del borde (`x < 20` o `x > 780`) se dibuja una segunda copia desplazada ±800 px y la colisión se prueba también con esa copia.

_Personaje_

- Hitbox rectangular 28×36 px (centro `x`, pies en `y`). Pies de colisión: ancho 24 px (`x − 12 … x + 12`).
- Inicio: centro `(400, 560)` sobre la base, `vy = −860` (primer salto automático al arrancar).
- Horizontal: aceleración 2400 px/s² en la dirección pulsada; velocidad máxima 380 px/s; sin entrada, desaceleración 1800 px/s² hasta 0. Pulsar ambas direcciones = sin entrada.
- Vertical: gravedad 1600 px/s²; salto automático `vy = −860` px/s (apex ≈ 231 px ≈ 23 m); velocidad de caída máxima 1100 px/s.
- Resorte: `vy = −1400` px/s (apex ≈ 612 px ≈ 61 m).

_Plataformas_

- Alto 14 px. Ancho `w(n) = max(64, 96 − 4·(n − 1))` (nivel 1: 96 px; nivel 9+: 64 px; nivel ≥ 11: 56 px, ver tabla).
- Aterrizaje (barrido, sin tunneling): solo si `vy > 0`, `piesPrev.y ≤ top` y `pies.y ≥ top`, y los pies solapan horizontalmente `[px, px + w]` (con la copia envolvente si aplica). Al aterrizar: `pies.y = top` y se aplica el efecto del tipo.
- Tipos:
  - **NORMAL** (verde, `--green`): rebote `vy = −860`.
  - **MÓVIL** (cian, `--cyan`): igual que NORMAL, pero se desplaza horizontalmente entre `[0, 800 − w]` rebotando en los extremos a `vMovil(n) = min(160, 70 + 10·(n − 2))` px/s. Aparece desde el nivel 2.
  - **FRÁGIL** (magenta, `--magenta`, trazo discontinuo `[6, 4]`): al aterrizar se rompe **sin rebote** (el personaje sigue cayendo). Nunca es la plataforma principal de una fila (ver generador).
  - **RESORTE** (accesorio amarillo, `--yellow`): resorte de 20×12 px sobre una plataforma NORMAL en `x` aleatoria dentro de la plataforma. Si los pies solapan la caja del resorte → `vy = −1400`; si aterriza en otra parte de esa plataforma → rebote normal.

_Generador procedural (por filas)_

- Se mantiene una lista de filas. Mientras `yFilaMasAlta > cameraY − 120`, se genera otra fila en `yNueva = yFilaMasAlta − gap`, con `gap` uniforme en `[gMin(n), gMax(n)]` según el **nivel actual** `n`.
- Cada fila tiene **una plataforma principal** (NORMAL o MÓVIL; nunca FRÁGIL) cuyo centro está a distancia horizontal envolvente `min(|dx|, 800 − |dx|) ≤ 260` px del centro de la principal anterior (alcanzable con el salto normal incluso con `gap = 200`).
- La principal es MÓVIL con probabilidad `pMovil(n)`; si es NORMAL, lleva resorte con probabilidad 0.07 (nunca dos filas seguidas con resorte).
- Con probabilidad `pFragil(n)`, la fila añade una plataforma **señuelo** FRÁGIL con centro a ≥ 140 px (envolvente) de la principal y `y` desplazada ±20 px.
- Reciclado: se eliminan plataformas, fragmentos y chispas con `y − cameraY > 700`.
- Tabla de parámetros por nivel `n`:

| Nivel    | `gMin`                    | `gMax`                     | `w`                     | `pMovil`                       | `vMovil`                  | `pFragil`                      | `pChispa`                             |
| -------- | ------------------------- | -------------------------- | ----------------------- | ------------------------------ | ------------------------- | ------------------------------ | ------------------------------------- |
| 1        | 60                        | 100                        | 96                      | 0                              | —                         | 0.20                           | 0                                     |
| n (2–10) | `min(130, 60 + 10·(n−1))` | `min(190, 100 + 12·(n−1))` | `max(64, 96 − 4·(n−1))` | `min(0.50, 0.15 + 0.05·(n−2))` | `min(160, 70 + 10·(n−2))` | `min(0.60, 0.20 + 0.05·(n−1))` | n ≥ 3: `min(0.25, 0.08 + 0.03·(n−3))` |
| ≥ 11     | 170                       | 200                        | 56                      | 0.50                           | 160                       | 0.60                           | 0.30                                  |

_Chispas (peligro, desde el nivel 3)_

- Al generar una fila, con probabilidad `pChispa(n)` se crea una chispa a media altura entre esa fila y la anterior (`y = yNueva + gap/2`), siempre que no haya otra chispa a menos de 360 px en `y`.
- Círculo de radio 14 px; se desplaza horizontalmente a 90 px/s (dirección aleatoria) envolviendo los bordes; oscilación vertical senoidal ±10 px, periodo 2 s.
- **Pisarla** (`vy > 0` y pies dentro de los 10 px superiores del círculo) la destruye y rebota (`vy = −860`). No da puntos.
- Cualquier otro contacto (círculo vs. hitbox 28×36) → muerte.

_Puntaje, nivel y fin_

- Puntaje = `altura_m` máxima alcanzada (entero, metros). `onScore` cada vez que `altura_m` aumenta (nunca baja).
- Nivel `n = min(11, 1 + floor(altura_m / 100))` → nivel 2 a 100 m, nivel 11 a 1000 m. `onLevel` solo al cambiar.
- Marcas de altitud: cada 50 m de mundo, línea discontinua tenue a lo ancho con rótulo `50 M`, `100 M`… a la derecha (decoración del mundo, no HUD).
- Fin por caída: `pies.y − cameraY > 640` (el personaje salió por abajo) → 500 ms de animación de caída y `onGameOver(puntaje)`.
- Fin por chispa: flash blanco 120 ms, el personaje queda sin control y cae; 700 ms después `onGameOver(puntaje)`.
- Un solo `onGameOver` por partida. Sin vidas: `hasLives: false`.
- Duración esperada: 1–4 min (≈ 9 m/s de ascenso ideal; dificultad máxima desde 1000 m).

**Controles:**

- Teclado: `←`/`A` izquierda, `→`/`D` derecha (mantener). `preventDefault` solo en flechas. No hay botón de salto (es automático).
- Táctil (`pointer: coarse`): dos botones grandes de mantener (← abajo-izquierda, → abajo-derecha) con `onPointerDown` (+`setPointerCapture`) → `down=true`, `onPointerUp/Cancel` → `down=false`. Además, mantener pulsado sobre la mitad izquierda/derecha del canvas equivale a ←/→ (listeners `pointerdown/pointerup/pointercancel` en el `canvas`, `touch-action: none`).
- Ratón: el mismo mantener-mitad del canvas funciona con clic (útil para probar sin táctil).

**Animaciones (por código, tiempo solo dentro del loop):**

- Personaje: cuerpo vectorial neón verde (rectángulo redondeado 28×36 con visor y dos "ojos" que miran hacia la dirección horizontal); _squash & stretch_: al aterrizar escala `(1.25, 0.75)` → `(1, 1)` en 120 ms (ease-out); en el apex del salto ligero estiramiento `(0.92, 1.08)`.
- Estela: 6 puntos de rastro con alpha decreciente mientras `|vy| > 600`.
- Aterrizaje: anillo expansivo bajo los pies (radio 4→24 px, 200 ms, desvanecido) del color de la plataforma.
- FRÁGIL al romperse: 6 fragmentos que caen con gravedad 1600 px/s² y giran, desvanecidos en 600 ms.
- RESORTE: se comprime a 50 % de alto 80 ms y se estira a 140 % 120 ms al dispararse; estela amarilla del personaje durante el ascenso de resorte.
- Chispa: núcleo pulsante (radio 12→16 px, 0.5 s) + 3 arcos eléctricos en zigzag regenerados cada 80 ms; al pisarla, estallido de 10 partículas.
- Fondo: dos capas de paralaje de líneas verticales tenues ("torre") con factor 0.3 y 0.6 de `cameraY`, más puntos estelares; el tono del fondo pasa de verde oscuro (nivel 1) a violeta (nivel 11) interpolado por nivel.
- Muerte: el personaje pierde color (gris) y gira mientras cae; la pantalla parpadea en rojo tenue una vez.

**Out of scope:**

- Sonido, vibración, música.
- Disparo, enemigos que persiguen, power-ups (jetpack, escudo), monedas o bonificaciones que no sean altura.
- Control por inclinación del dispositivo (giroscopio).
- Pausa por teclado (`P`/`Esc`), persistencia local, récord personal dibujado en el mundo.
- Anti-trampa, Auth, otros juegos, tests, modificar `references/`.

---

## Data model

```ts
// lib/games/escalada/index.ts — interfaz común
export interface EscaladaCallbacks {
  onScore: (score: number) => void; // altura máxima en metros, solo cuando aumenta
  onLives: (lives: number) => void; // no se usa (hasLives:false); se acepta por contrato, no se invoca
  onLevel: (level: number) => void; // 1–11
  onGameOver: (finalScore: number) => void; // caída fuera de pantalla o chispa
}

export type EscaladaAction = "left" | "right";

export interface EscaladaGame {
  start(): void; // registra listeners (teclado, blur, pointer en canvas) y arranca el loop
  pause(): void; // congela loop y limpia entrada
  resume(): void; // reinicia lastTime
  restart(): void; // altura 0, nivel 1, base + filas nuevas, personaje en (400, 560) con salto inicial
  destroy(): void; // idempotente: cancela rAF y quita listeners
  setInput(action: EscaladaAction, down: boolean): void; // teclado, botones y mitades del canvas
}

export function createEscaladaGame(
  canvas: HTMLCanvasElement,
  callbacks: EscaladaCallbacks,
  options?: {
    color?: string; // --green: personaje y plataformas NORMAL
    movingColor?: string; // --cyan
    fragileColor?: string; // --magenta
    springColor?: string; // --yellow
  },
): EscaladaGame;
```

```ts
// lib/games/escalada/entities.ts — tipos principales
export type PlatformKind = "normal" | "moving" | "fragile";

export interface Platform {
  x: number; // borde izquierdo (mundo)
  y: number; // borde superior (mundo)
  w: number;
  kind: PlatformKind;
  vx: number; // 0 salvo "moving"
  spring: { x: number; t: number } | null; // x relativa a la plataforma; t = tiempo de animación
  broken: boolean; // fragile ya rota (deja de colisionar)
  main: boolean; // principal de su fila (nunca fragile)
}

export interface Spark {
  x: number;
  baseY: number;
  vx: number; // ±90
  phase: number; // oscilación senoidal
  dead: boolean;
}

export interface Player {
  x: number; // centro
  y: number; // pies
  prevY: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  squash: number; // tiempo restante de la animación de aterrizaje
  alive: boolean;
}

export interface LevelParams {
  gMin: number;
  gMax: number;
  w: number;
  pMoving: number;
  vMoving: number;
  pFragile: number;
  pSpark: number;
}
```

```ts
// lib/games/registry.ts — solo se añade una línea (+ import)
import EscaladaCanvas from "@/components/escalada-canvas";
escalada: { component: EscaladaCanvas, hasLives: false },
```

```ts
// lib/data.ts — CoverClass amplía con "cover-escalada"; nueva entrada en GAMES
// (best/plays son fallback mock; las cifras reales vienen de game_stats)
{
  id: "escalada", title: "ESCALADA", cat: "ARCADE", cover: "cover-escalada", color: "green",
  short: "Rebota hacia arriba sin mirar atrás: tu altura es tu puntaje.",
  long: "Tu escalador de neón salta solo; tú decides hacia dónde. Sube por plataformas que se mueven, se rompen o te lanzan al cielo con un resorte. Cada cien metros todo se estrecha y aparecen chispas eléctricas. Si caes, se acabó.",
  best: 0, plays: "0",
}
```

```sql
-- Migración (apply_migration, nombre: add_escalada_to_scores_game_id_chk)
-- Lista = CHECK vigente (2026-11-24) + 'escalada'. Si otro juego (de esta jam: muralla, cumbre;
-- o de jams previas: abismo) ya amplió el CHECK, releerlo e incluir también esos ids antes de aplicar.
alter table public.scores drop constraint if exists scores_game_id_chk;
alter table public.scores add constraint scores_game_id_chk
  check (game_id in (
    'bloque-buster', 'caida', 'serpentina', 'gloton', 'invasores',
    'rocas', 'ranaria', 'duelo-pixel', 'escalada'
  ));
```

Estructura de archivos:

```
lib/games/escalada/
  index.ts      // createEscaladaGame, loop, estado, input, cámara, callbacks, fin
  generator.ts  // levelParams(n), genRow(prevMain, n, rng) → plataformas + chispa opcional
  entities.ts   // tipos Player/Platform/Spark/Particle/Fragment, física, aterrizaje barrido, dibujo neón
  utils.ts      // constantes (800×600, 10 px/m, gravedad, saltos), clamp, lerp, easing, wrapDx
components/escalada-canvas.tsx
app/globals.css  // + .cover-escalada, + .touch-escalada
```

Convenciones:

- Resolución lógica fija 800×600 (4:3, igual que `.crt-screen`); escalado por CSS como `snake-canvas.tsx` (`position:absolute; inset:0; width/height 100%; aspect-ratio 4/3; touch-action:none`). Fondo dibujado en canvas (degradado + paralaje), sin imágenes.
- Todo se simula en coordenadas de mundo; el dibujo resta `cameraY`. Solo se dibujan entidades con `0 − 40 ≤ y − cameraY ≤ 640`.
- Estilo neón: relleno `rgba(color,.25)` + trazo del color + `shadowBlur` 12; FRÁGIL con `setLineDash([6, 4])`.
- Colores: `getComputedStyle(canvas)` para `--green`, `--cyan`, `--magenta`, `--yellow`; fallbacks `#00ff88`, `#00f5ff`, `#ff006e`, `#f5ff00`.
- `Math.random` solo tras montar (generación en `start()`/`restart()` y en el loop).
- Callbacks solo al cambiar el valor (`onScore` al aumentar `altura_m`, `onLevel` al cambiar); ambos se emiten una vez al arrancar/reiniciar con `0` y `1`.
- Un solo `onGameOver` por partida (flag `ended`); tras la animación de muerte el loop se detiene.
- `dt` capado a 0.05 s; `resume()` reinicia `lastTime`. Con `dt` capado y caída máxima 1100 px/s el desplazamiento por frame es ≤ 55 px: el aterrizaje barrido (`piesPrev` → `pies`) evita atravesar plataformas de 14 px.
- Entrada: dos booleanos `left/right` (la suma de teclado, botones y mitad del canvas se trata como OR por fuente: se guarda un set de fuentes activas por acción para que soltar una no anule otra). Se limpia en `pause()`, `restart()`, `destroy()` y `blur` de ventana.
- `preventDefault` solo en `ArrowLeft`/`ArrowRight`, mientras el juego está montado; `KeyboardEvent.repeat` se ignora.

---

## Implementation plan

Antes del paso 1: leer `node_modules/next/dist/docs/` (Client Components), el CSS de `.crt-screen`, `.cover-*` y `.touch-*` en `app/globals.css`, y `components/snake-canvas.tsx` + `lib/games/snake/` como modelo (y `components/arkanoid-canvas.tsx` para el puntero sobre el canvas). Invocar `/frontend-design` antes de los pasos 5 y 7.

1. **Utils, entidades y generador.** `utils.ts` (constantes de física y escala, `wrapDx`, clamp/lerp/easing), `entities.ts` (tipos, integración del personaje, aterrizaje barrido con copia envolvente, colisión círculo-rect de chispas, fragmentos/partículas, funciones de dibujo), `generator.ts` (`levelParams(n)` con la tabla, `genRow` con principal alcanzable ≤ 260 px, señuelo FRÁGIL ≥ 140 px, resorte sin repetir fila, chispa con separación 360 px). Funciones puras con `rng` inyectable. Verificar: `npx tsc --noEmit`.
2. **Motor.** `index.ts`: loop rAF con `dt` capado, física, envolvente lateral, cámara que solo sube, generación/reciclado, tipos de plataforma, chispas (pisar/morir), altura/puntaje/nivel, marcas de altitud, animaciones, muerte con retardo y `onGameOver` único, `destroy()` idempotente. Sin HUD. Verificar: `npx tsc --noEmit` y `npm run lint`.
3. **Componente canvas.** `components/escalada-canvas.tsx` (client): `callbacksRef`, juego en `useEffect([])`, `destroy()` en cleanup, colores vía `getComputedStyle`, `ref` con `pause/resume/restart` (`useImperativeHandle`), botones ← → de mantener con `tabIndex={-1}` y `aria-label`. Verificar: `npx tsc --noEmit`.
4. **Registro.** Entrada `escalada` en `GAME_CANVASES` (`hasLives: false`). Verificar: compila; `/juegos/escalada/jugar` aún 404 hasta el paso 5 (sin entrada en `GAMES`); `rocas`, `caida`, `bloque-buster`, `serpentina` igual.
5. **Datos, portada y migración.** `CoverClass` + `.cover-escalada` (degradado `#002a1c → #0a0a18`; tres plataformas verdes escalonadas en diagonal, una magenta discontinua, un resorte amarillo y el personaje con estela hacia arriba; `drop-shadow` verde) + entrada en `GAMES`. Releer el CHECK con `execute_sql` y `apply_migration` con la lista completa vigente + `escalada`. Verificar: `/juegos` (filtro ARCADE), `/juegos/escalada`, `/juegos/escalada/jugar`; `execute_sql` insert de prueba con `game_id='escalada'` pasa y se borra la fila; insert con `rocas` sigue pasando; `get_advisors` (security) sin problemas nuevos.
6. **Pausa, FIN, reinicio y guardado.** PAUSA/REANUDAR/FIN/JUGAR DE NUEVO contra el juego real; HUD con puntaje (metros) y nivel, sin vidas; GUARDAR PUNTUACIÓN crea fila `escalada`. Verificar: fila en `scores` con `execute_sql` (`select … where game_id='escalada'`) y pestaña ESCALADA en `/salon` (antes de guardar: `AÚN SIN CAMPEONES — SÉ EL PRIMERO`).
7. **Estilo y táctil.** Pulir neón del personaje, plataformas, chispas y paralaje; `.touch-escalada` (dos clusters en las esquinas inferiores, botones `clamp(56px, 15vw, 80px)`, `opacity: .55`, color `--green`). Verificar: emulación táctil en DevTools; mantener ← / → y mantener mitades del canvas mueven; sin scroll de página; sin `.touch-controls` visibles con ratón.
8. **Cierre.** `npm run build`, `npm run lint`; entrar/salir de `/juegos/escalada/jugar` varias veces sin listeners duplicados (velocidad horizontal máxima constante 380 px/s, no duplicada); los otros cuatro juegos intactos.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `/juegos/escalada/jugar` muestra el juego real (personaje, plataformas, fondo con paralaje), sin arena decorativa.
- [ ] El personaje salta automáticamente al tocar una plataforma desde arriba (apex ≈ 23 m) y atraviesa las plataformas al subir.
- [ ] `←`/`A` y `→`/`D` lo mueven con inercia (máx. 380 px/s); ninguna tecla hace scroll; salir por un borde lateral lo hace aparecer por el opuesto.
- [ ] La cámara solo sube; el puntaje del HUD es la altura máxima en metros y nunca baja.
- [ ] Plataformas MÓVIL (cian) aparecen desde 100 m y se desplazan; FRÁGIL (magenta discontinua) se rompen sin rebote con animación de fragmentos; RESORTE (amarillo) lanza ≈ 61 m.
- [ ] Siempre existe una ruta de plataformas principales alcanzable (ninguna fila obliga a usar una FRÁGIL ni exige más de 260 px horizontales envolventes).
- [ ] El nivel del HUD sube cada 100 m (nivel 11 a 1000 m) y se nota: plataformas más estrechas y separadas, más móviles y frágiles.
- [ ] Desde 200 m aparecen chispas; pisarlas desde arriba las destruye con rebote; cualquier otro contacto termina la partida.
- [ ] Caer por debajo de la pantalla o tocar una chispa abre el modal FIN DEL JUEGO con la altura correcta, una sola vez.
- [ ] El HUD refleja puntuación y nivel; sin vidas visibles (`hasLives: false`); el canvas no dibuja puntaje, nivel, "PAUSA" ni "GAME OVER" (solo marcas de altitud del mundo cada 50 m).
- [ ] PAUSA congela física, generación y animaciones; REANUDAR continúa sin salto; FIN detiene el juego; JUGAR DE NUEVO deja puntaje 0, nivel 01, personaje sobre la base.
- [ ] GUARDAR PUNTUACIÓN crea fila en `scores` con `game_id = 'escalada'`.
- [ ] El Salón muestra la pestaña ESCALADA; vacía muestra `AÚN SIN CAMPEONES — SÉ EL PRIMERO`; stats reflejan la partida.
- [ ] El CHECK incluye todos los ids previos + `escalada`; insert con `rocas`, `caida`, `bloque-buster`, `serpentina` y `escalada` pasa; `get_advisors` sin problemas nuevos.
- [ ] Sin listeners duplicados al salir y volver.
- [ ] Botones táctiles visibles solo con `pointer: coarse`; mantener pulsado mueve y soltar frena; mantener mitades del canvas también; sin scroll de página.
- [ ] `rocas`, `caida`, `bloque-buster` y `serpentina` siguen funcionando igual.
- [ ] Sin errores de consola ni warnings de hydration (incluido Strict Mode).

---

## Decisiones

- **Sí:** id `escalada`, título ESCALADA, `ARCADE`, `green`: exactamente la sugerencia previa del registro compartido (requisito del usuario para esta jam).
- **Sí:** carpeta `lib/games/escalada/` y `escalada-canvas.tsx` (juego original: carpeta = id).
- **Sí:** juego desde cero, todo vectorial neón; sin assets.
- **Sí:** puntaje = altura máxima en metros, sin bonificaciones. Es lo que define la sugerencia y hace el ranking inmediato de leer. _(Abierta: añadir bonificación por chispa pisada o por cadena de resortes.)_
- **Sí:** salto automático; solo control horizontal. Hace el juego viable con dos botones táctiles.
- **Sí:** borde lateral envolvente. Da salidas creativas y permite garantizar la ruta con ≤ 260 px.
- **Sí:** FRÁGIL nunca es plataforma principal → siempre hay ruta justa; el riesgo es elegir mal.
- **Sí (abierta):** valores de balance (gravedad 1600, salto −860, resorte −1400, tabla por nivel, chispas desde el nivel 3, techo de dificultad en 1000 m). Ajustables tras probar.
- **Sí (abierta):** marcas de altitud "50 M / 100 M" dibujadas en el mundo. Son decoración espacial, no HUD; alternativa: líneas sin rótulo.
- **Sí:** `hasLives: false`; una caída termina la partida.
- **Sí:** nueva portada `.cover-escalada` (no se reutiliza `.cover-snake` aunque sea verde).
- **Sí:** migración del CHECK en el mismo PR (drop + add con lista completa).
- **No:** giroscopio, disparo, power-ups, monedas, sonido, `P`/`Esc`.

---

## Riesgos

| Riesgo                                                            | Mitigación                                                                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Strict Mode duplica listeners/loops                               | `destroy()` idempotente: cancela rAF, quita listeners de teclado, `blur` y pointer del canvas                                                                |
| `window`/`Math.random` rompen SSR                                 | Juego creado en `useEffect`; generación y listeners solo en `start()`                                                                                        |
| Teclas hacen scroll o reactivan botones enfocados                 | `preventDefault` acotado a flechas; `blur()` de botones de la plataforma (ya lo hace `GamePlayer`)                                                           |
| `dt` enorme tras pausa hace atravesar plataformas o caer de golpe | `resume()` reinicia `lastTime`; `dt` capado a 0.05 s; aterrizaje barrido                                                                                     |
| Teclas o punteros "pegados" al perder foco                        | Set de fuentes por acción; limpiar en `pause()`, `restart()`, `destroy()`, `blur` y `pointercancel`                                                          |
| CSS var no sirve en canvas                                        | `getComputedStyle` al crear el juego, con fallbacks hex                                                                                                      |
| Id fuera del CHECK falla el insert                                | Migración en el mismo PR; verificada con insert de prueba                                                                                                    |
| Las 3 specs de la jam (y `abismo`) reescriben el mismo CHECK      | Releer el CHECK justo antes de aplicar; lista = vigente + `escalada` (+ ids de jam ya integrados); drop + add idempotente, el orden de aplicación no importa |
| Fila generada inalcanzable (gap alto + distancia horizontal)      | Gap ≤ 200 < apex 231; distancia envolvente ≤ 260 px entre principales; test manual con nivel forzado en desarrollo                                           |
| Chispa bloquea la única ruta                                      | Chispa a media altura entre filas, separación ≥ 360 px, se mueve (90 px/s) y puede pisarse                                                                   |
| Resorte lanza al jugador por encima de filas sin generar          | Generar hasta `cameraY − 120` cada frame (antes de dibujar); el apex del resorte (612 px) queda dentro del margen al seguir la cámara                        |
| Copia envolvente duplica colisiones en el borde                   | Probar la copia ±800 solo si `x < 20` o `x > 780`; un aterrizaje por frame (el de `top` más alto)                                                            |
| Partidas infinitas de jugadores expertos (> 5 min)                | Techo de dificultad en nivel 11 (w 56, gap 170–200, 60 % frágiles, 30 % chispas); revisar tras pruebas (abierta)                                             |
| Muchas entidades si no se recicla                                 | Reciclar con `y − cameraY > 700`; ~12 filas vivas como máximo                                                                                                |
| `best/plays` mock en `GAMES` no coinciden con reales              | Son solo fallback; la UI ya lee `game_stats`                                                                                                                 |
| DPR alto vuelve borroso el canvas escalado                        | Aceptado; manejar `devicePixelRatio` si se nota                                                                                                              |

---

## Qué **no** está en esta spec

- Sonido, vibración, música.
- Power-ups, monedas, disparo, enemigos que persiguen, bonificaciones de puntaje.
- Control por giroscopio.
- Pausa por teclado (`P`/`Esc`), selector de nivel, persistencia local, línea de récord personal.
- Anti-trampa en puntajes y Auth.
- Los otros juegos de la jam (`muralla`, `cumbre`), `abismo` y ports pendientes (`gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
