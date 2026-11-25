# SPEC JAM — Juego MURALLA (muralla) integrado en el reproductor con leaderboard

> **Status:** Borrador
> **Game jam:** escalada / ascenso vertical (2026-11-24)
> **Depends on:** SPEC 01 (`GamePlayer`, datos), SPEC 05 (patrón de juego en canvas), SPEC 06 (leaderboard Supabase), SPEC 07 (registro `lib/games/registry.ts`)
> **Date:** 2026-11-24
> **Objective:** Crear desde cero MURALLA, un shooter vertical invertido donde el jugador defiende lo alto de una muralla de neón disparando hacia abajo contra escaladores que suben por 8 cuerdas, montarlo en `GamePlayer` vía el registro (`muralla`) y que su puntaje llegue al Salón de la Fama.

---

## Por qué existe esta spec

**Interpretación del tema "escalada / ascenso vertical":** el ascenso visto desde arriba. Aquí escalan los enemigos; el jugador es el defensor en el parapeto y su trabajo es impedir que lleguen a la cima. El riesgo/recompensa está en la altura: un escalador derribado cerca de la cima vale 5 veces más que uno derribado al pie de la muralla. Es la interpretación SHOOTER del tema, distinta de ESCALADA (ARCADE: subir tú) y CUMBRE (PUZZLE: planificar la ruta) de la misma jam.

Concepto basado en el género "defensa de muralla / tirador fijo"; no recrea ningún juego comercial concreto. Tampoco coincide con la idea `invasion` del registro (nave fija vs. oleadas que bajan): aquí los enemigos **suben** por carriles fijos, el disparo va **hacia abajo** y el puntaje depende de la altura del impacto.

Estado actual:

- `muralla` **no existe** en `GAMES` (`lib/data.ts`) ni en `GAME_CANVASES` (`lib/games/registry.ts`); sin entrada, `GamePlayer` caería en la simulación de puntaje.
- `muralla` **no está** en el CHECK `scores_game_id_chk` → hace falta migración.
- No hay portada: se crea `.cover-muralla` en `app/globals.css` y se amplía `CoverClass`.
- Fuente: **desde cero** (nada en `references/started-games/` ni assets en `references/source-assets/`). Todo vectorial neón.

Antes de escribir código Next: leer la guía relevante en `node_modules/next/dist/docs/` (AGENTS.md; `cacheComponents` activo; Client Components).

> Estado real inspeccionado (2026-11-24): CHECK vigente leído en Supabase = `CHECK ((game_id = ANY (ARRAY['bloque-buster'::text, 'caida'::text, 'serpentina'::text, 'gloton'::text, 'invasores'::text, 'rocas'::text, 'ranaria'::text, 'duelo-pixel'::text])))`. `list_tables(public)` = `scores` (RLS on, 4 filas); `information_schema` confirma las vistas `scores_best` y `game_stats`. `GAMES` = `rocas, caida, bloque-buster, serpentina`. `GAME_CANVASES` = esos cuatro. `CATS` = `TODOS, ARCADE, PUZZLE, SHOOTER`. `CoverClass` tiene 8 portadas (`cover-bricks … cover-duelo`), ninguna para este juego. `app/globals.css` tiene `--magenta: #ff006e`, `.touch-controls/.touch-btn/.touch-cluster/.touch-right/.touch-rot/.touch-fire` (layout de `rocas`: cluster izquierdo de giro + disparo a la derecha) y variantes `.touch-tetris`, `.touch-arkanoid`, `.touch-snake`. No hay `supabase/migrations/` en el repo (migraciones solo vía MCP).

---

## Scope

**In:**

- Motor en `lib/games/muralla/` (sin globals; `window`/`document` solo en `start()`).
- Factory `createMurallaGame(canvas, callbacks, options)` con `start/pause/resume/restart/destroy/setInput`.
- `components/muralla-canvas.tsx` + controles táctiles (← → a la izquierda, DISPARO a la derecha; arrastre sobre el canvas), variante `.touch-muralla`.
- Registro: `muralla: { component: MurallaCanvas, hasLives: true }`. `GamePlayer` no cambia.
- Entrada `muralla` en `GAMES` (categoría `SHOOTER`, `cover-muralla`, color `magenta`); `CoverClass` amplía con `"cover-muralla"`; CSS `.cover-muralla`.
- Migración que amplía `scores_game_id_chk` con `muralla` (lista completa vigente + nuevo id).
- HUD/pausa/FIN/modal de la plataforma; el canvas no dibuja puntaje, vidas, oleada/nivel, "PAUSA" ni "GAME OVER".

**Reglas:**

_Escenario_

- Resolución lógica 800×600, pantalla fija (sin scroll).
- Parapeto (almenas) en la franja `y = 60–100`; cara de la muralla de `y = 100` a `y = 600`.
- 8 cuerdas verticales (carriles) en `x_i = 50 + 100·i` (i = 0…7 → 50, 150, …, 750).

_Defensor_

- Camina sobre el parapeto (pies en `y = 60`), ancho 40 px, `x ∈ [30, 770]`, velocidad 420 px/s (sin inercia).
- Disparo: proyectil "carga" que sale de `(x, 100)` hacia abajo a 620 px/s, radio 8 px.
- Ayuda de puntería: si el defensor está a ≤ 30 px de una cuerda, el proyectil sale en la `x` exacta de esa cuerda; si no, sale en su `x` (y probablemente falla).
- Máximo 3 proyectiles a la vez; enfriamiento 0.25 s. Mantener disparo = autodisparo al ritmo del enfriamiento.
- Un proyectil desaparece al impactar o al pasar `y > 620`.

_Escaladores_

- Aparecen en `y = 640` (fuera de pantalla, abajo) en una cuerda y suben. Hitbox 32×40 px centrada en su cuerda; `y` = borde superior.
- Velocidad base por oleada `w`: `vBase(w) = min(120, 36 · 1.09^(w − 1))` px/s (oleada 1: 36 px/s → 15 s en subir los 540 px).
- Tipos:
  - **TREPADOR** (verde, `--green`): 1 impacto, velocidad `vBase`.
  - **BLINDADO** (cian, `--cyan`, casco): 2 impactos; el primero rompe el casco y lo empuja 30 px hacia abajo; velocidad `0.8 · vBase`. Desde la oleada 2.
  - **SALTADOR** (amarillo, `--yellow`): 1 impacto, velocidad `1.15 · vBase`; al cruzar `y = 350` salta una sola vez a una cuerda adyacente libre (arco de 0.35 s, vulnerable durante el salto). Desde la oleada 3.
- Máximo 2 escaladores por cuerda a la vez y separación vertical mínima de 70 px; si la cuerda elegida está llena se elige otra.
- Colisión proyectil–escalador: `|px − cx| ≤ 24` y solapamiento vertical (círculo r 8 vs. rect 32×40). Un proyectil impacta al primer escalador que toque.

_Puntaje_

- Progreso al impactar: `p = clamp((640 − y) / 540, 0, 1)`.
- Puntos por derribo: `base = 10 · (1 + min(4, floor(p · 5)))` → 10 / 20 / 30 / 40 / 50 según el quinto de la muralla en que esté. TREPADOR ×1, SALTADOR ×1.5 (redondeado), BLINDADO ×2 (solo al derribarlo; romper el casco no puntúa).
- Bonificación de oleada: al terminar una oleada sin perder vidas en ella, `+50 · w` ("muralla intacta").
- `onScore` en cada derribo y bonificación.

_Oleadas, vidas y fin_

- Oleada `w` tiene `min(30, 6 + 2·w)` escaladores; intervalo de aparición `max(0.45, 1.8 · 0.9^(w − 1))` s; la cuerda se sortea excluyendo las 2 últimas usadas.
- Mezcla por oleada: w = 1: 100 % trepador; w = 2: 75 % trepador / 25 % blindado; w = 3–5: 60 / 20 / 20 (trepador / blindado / saltador); w ≥ 6: 45 / 30 / 25.
- La oleada termina cuando todos han aparecido y no queda ninguno vivo; pausa de 2 s (el parapeto destella) y empieza la siguiente. Nivel = oleada; `onLevel` solo al cambiar.
- **Brecha:** si un escalador llega a `y ≤ 100` (cima), se pierde 1 vida, el escalador desaparece con destello sobre el parapeto y la pantalla tiembla 6 px durante 200 ms.
- 3 vidas, sin vidas extra (`hasLives: true`, `onLives` al cambiar).
- Fin: vidas 0 → animación de derrumbe de 600 ms → `onGameOver(score)` una sola vez.
- Duración esperada: 2–5 min (oleada 1 ≈ 30 s; la velocidad y el ritmo crecen hasta saturar hacia la oleada 8–10).

**Controles:**

- Teclado: `←`/`A` y `→`/`D` mover (mantener); `Espacio`, `↓`, `S` o `X` disparar (mantener = autodisparo). `preventDefault` solo en flechas y `Space`; `KeyboardEvent.repeat` se ignora.
- Táctil (`pointer: coarse`): cluster izquierdo con ← → (de mantener), botón DISPARO grande a la derecha (de mantener), reutilizando `.touch-rot`/`.touch-fire`.
- Puntero (ratón y táctil): arrastrar sobre el canvas fija un objetivo `x` y el defensor camina hacia él a 420 px/s; tocar/clic sin arrastrar (< 8 px de movimiento) dispara una vez. Listeners en el `canvas`, `touch-action: none`.

**Animaciones (por código, tiempo solo dentro del loop):**

- Defensor: figura neón magenta (cuerpo trapezoidal + cañón hacia abajo); retroceso de 4 px durante 60 ms al disparar; pasos alternos al caminar.
- Proyectil: esfera magenta con halo y estela de 4 puntos.
- Escaladores: figura de palitos neón con brazos y piernas alternando cada 0.25 s (ciclo de trepar); la cuerda oscila ±2 px bajo su peso.
- Peligro: escaladores en el cuarto superior (`y < 235`) parpadean en rojo (0.3 s).
- Derribo: 8 partículas radiales + el escalador cae girando con gravedad 1200 px/s² hasta salir de pantalla (sin colisión); texto `+NN` que sube 24 px y se desvanece en 500 ms.
- Casco roto: 4 fragmentos cian.
- SALTADOR: arco parabólico entre cuerdas.
- Brecha: destello rojo en el borde de la pantalla 200 ms + temblor.
- Fondo: patrón de ladrillos tenue dibujado en canvas, almenas con trazo magenta, cuerdas con trazo tenue.
- Fin: el parapeto se agrieta y parpadea 600 ms antes de `onGameOver`.

**Out of scope:**

- Sonido, vibración, música.
- Escaladores que disparan, jefes, power-ups (bombas, disparo múltiple), mejoras entre oleadas.
- Selector de oleada inicial, pausa por teclado (`P`/`Esc`), persistencia local.
- Anti-trampa, Auth, otros juegos, tests, modificar `references/`.

---

## Data model

```ts
// lib/games/muralla/index.ts — interfaz común
export interface MurallaCallbacks {
  onScore: (score: number) => void; // derribos y bonificación de oleada
  onLives: (lives: number) => void; // 3 → 0, al haber brecha
  onLevel: (level: number) => void; // número de oleada
  onGameOver: (finalScore: number) => void; // vidas a 0
}

export type MurallaAction = "left" | "right" | "fire";

export interface MurallaGame {
  start(): void; // registra listeners (teclado, blur, pointer en canvas) y arranca el loop
  pause(): void; // congela loop y limpia entrada
  resume(): void; // reinicia lastTime
  restart(): void; // score 0, 3 vidas, oleada 1, sin escaladores ni proyectiles
  destroy(): void; // idempotente: cancela rAF y quita listeners
  setInput(action: MurallaAction, down: boolean): void; // teclado y botones táctiles
}

export function createMurallaGame(
  canvas: HTMLCanvasElement,
  callbacks: MurallaCallbacks,
  options?: {
    color?: string; // --magenta: defensor, proyectiles, almenas
    climberColor?: string; // --green
    armoredColor?: string; // --cyan
    jumperColor?: string; // --yellow
  },
): MurallaGame;
```

```ts
// lib/games/muralla/entities.ts — tipos principales
export type ClimberKind = "climber" | "armored" | "jumper";

export interface Climber {
  lane: number; // 0–7
  x: number; // = 50 + 100·lane salvo durante el salto
  y: number; // borde superior
  speed: number;
  kind: ClimberKind;
  hp: number; // 1, o 2 para armored
  jumped: boolean; // jumper: ya saltó
  jump: { from: number; to: number; t: number } | null;
  dead: boolean;
}

export interface Shot {
  x: number;
  y: number;
}

export interface WaveSpec {
  count: number;
  interval: number; // s
  mix: { climber: number; armored: number; jumper: number };
  speed: number; // vBase
}
```

```ts
// lib/games/registry.ts — solo se añade una línea (+ import)
import MurallaCanvas from "@/components/muralla-canvas";
muralla: { component: MurallaCanvas, hasLives: true },
```

```ts
// lib/data.ts — CoverClass amplía con "cover-muralla"; nueva entrada en GAMES
// (best/plays son fallback mock; las cifras reales vienen de game_stats)
{
  id: "muralla", title: "MURALLA", cat: "SHOOTER", cover: "cover-muralla", color: "magenta",
  short: "Que nadie llegue a la cima: dispara hacia abajo.",
  long: "Defiendes lo alto de una muralla de neón mientras escaladores trepan por ocho cuerdas. Cuanto más cerca de la cima los derribas, más puntos valen, pero si uno llega arriba pierdes una vida. Cascos que aguantan dos golpes, saltadores que cambian de cuerda y oleadas cada vez más rápidas.",
  best: 0, plays: "0",
}
```

```sql
-- Migración (apply_migration, nombre: add_muralla_to_scores_game_id_chk)
-- Lista = CHECK vigente (2026-11-24) + 'muralla'. Si otro juego (de esta jam: escalada, cumbre;
-- o de jams previas: abismo) ya amplió el CHECK, releerlo e incluir también esos ids antes de aplicar.
alter table public.scores drop constraint if exists scores_game_id_chk;
alter table public.scores add constraint scores_game_id_chk
  check (game_id in (
    'bloque-buster', 'caida', 'serpentina', 'gloton', 'invasores',
    'rocas', 'ranaria', 'duelo-pixel', 'muralla'
  ));
```

Estructura de archivos:

```
lib/games/muralla/
  index.ts     // createMurallaGame, loop, estado, input (teclas + puntero), oleadas, vidas, callbacks
  waves.ts     // waveSpec(w), sorteo de tipo y cuerda (excluye 2 últimas, cupo por cuerda)
  entities.ts  // tipos Defender/Climber/Shot/Particle/FloatText, movimiento, colisiones, dibujo neón
  utils.ts     // constantes (800×600, cuerdas, parapeto), clamp, easing, puntos por altura, puntero → x lógico
components/muralla-canvas.tsx
app/globals.css  // + .cover-muralla, + .touch-muralla
```

Convenciones:

- Resolución lógica fija 800×600 (4:3, igual que `.crt-screen`); escalado por CSS como `snake-canvas.tsx`. Fondo de ladrillos dibujado en canvas con alpha ≤ 0.08.
- Estilo neón: relleno `rgba(color,.25)` + trazo + `shadowBlur` 12.
- Colores: `getComputedStyle(canvas)` para `--magenta`, `--green`, `--cyan`, `--yellow`; fallbacks `#ff006e`, `#00ff88`, `#00f5ff`, `#f5ff00`.
- Puntero: `x_lógico = (clientX − rect.left) × (800 / rect.width)` (como `arkanoid`); listeners `pointerdown/pointermove/pointerup/pointercancel` en el `canvas`, retirados en `destroy()`.
- `Math.random` solo tras montar (sorteos en el loop / `restart()`).
- Callbacks solo al cambiar el valor (`onScore` por derribo/bonificación, `onLives` por brecha, `onLevel` por oleada); los tres se emiten una vez al arrancar/reiniciar con `0`, `3`, `1`.
- Un solo `onGameOver` por partida (flag `ended`); tras la animación el loop se detiene.
- `dt` capado a 0.05 s; `resume()` reinicia `lastTime`. El temporizador de aparición y la pausa entre oleadas solo avanzan dentro del loop (sin `setTimeout`).
- Entrada: set de acciones activas; se limpia en `pause()`, `restart()`, `destroy()` y `blur` de ventana.
- `preventDefault` solo en flechas y `Space`, mientras el juego está montado.

---

## Implementation plan

Antes del paso 1: leer `node_modules/next/dist/docs/` (Client Components), el CSS de `.crt-screen`, `.cover-*` y `.touch-*` en `app/globals.css`, `components/asteroids-canvas.tsx` (layout táctil giro + disparo) y `components/arkanoid-canvas.tsx` + `lib/games/arkanoid/` (puntero sobre canvas) como modelo. Invocar `/frontend-design` antes de los pasos 5 y 7.

1. **Utils, entidades y oleadas.** `utils.ts` (constantes, puntos por altura, conversión de puntero), `entities.ts` (tipos, movimiento del defensor y escaladores, salto entre cuerdas, colisión círculo-rect, partículas/textos, dibujo), `waves.ts` (`waveSpec(w)` con las fórmulas, sorteo de tipo y cuerda con cupo). Funciones puras con `rng` inyectable. Verificar: `npx tsc --noEmit`.
2. **Motor.** `index.ts`: loop rAF con `dt` capado, defensor (teclas + objetivo de puntero), disparo con ayuda de puntería, cupo 3 y enfriamiento, aparición por oleada, colisiones, puntaje por altura y tipo, brecha/vidas, bonificación de oleada, pausa entre oleadas, animaciones, `onGameOver` único, `destroy()` idempotente. Sin HUD. Verificar: `npx tsc --noEmit` y `npm run lint`.
3. **Componente canvas.** `components/muralla-canvas.tsx` (client): `callbacksRef`, juego en `useEffect([])`, `destroy()` en cleanup, colores vía `getComputedStyle`, `ref` con `pause/resume/restart`, botones ← → y DISPARO de mantener (`tabIndex={-1}`, `aria-label`). Verificar: `npx tsc --noEmit`.
4. **Registro.** Entrada `muralla` en `GAME_CANVASES` (`hasLives: true`). Verificar: compila; `/juegos/muralla/jugar` aún 404 hasta el paso 5; los otros cuatro juegos igual.
5. **Datos, portada y migración.** `CoverClass` + `.cover-muralla` (degradado `#2a0016 → #0a0a18`; almenas magenta arriba, 3 cuerdas tenues y 2 figuras escalando en verde/amarillo; `drop-shadow` magenta) + entrada en `GAMES`. Releer el CHECK con `execute_sql` y `apply_migration` con la lista completa vigente + `muralla`. Verificar: `/juegos` (filtro SHOOTER muestra ROCAS y MURALLA), `/juegos/muralla`, `/juegos/muralla/jugar`; `execute_sql` insert de prueba con `game_id='muralla'` pasa y se borra la fila; insert con `rocas` sigue pasando; `get_advisors` (security) sin problemas nuevos.
6. **Pausa, FIN, reinicio y guardado.** PAUSA/REANUDAR/FIN/JUGAR DE NUEVO contra el juego real; HUD con puntaje, vidas y nivel (oleada); GUARDAR PUNTUACIÓN crea fila `muralla`. Verificar: fila en `scores` vía `execute_sql` y pestaña MURALLA en `/salon` (antes de guardar: `AÚN SIN CAMPEONES — SÉ EL PRIMERO`).
7. **Estilo y táctil.** Pulir neón y animaciones; `.touch-muralla` (← → `clamp(48px, 12vw, 64px)` a la izquierda, DISPARO `clamp(64px, 18vw, 92px)` a la derecha, color `--magenta`, `opacity: .6`). Verificar: emulación táctil en DevTools; arrastre mueve, toque dispara; sin scroll de página.
8. **Cierre.** `npm run build`, `npm run lint`; entrar/salir de `/juegos/muralla/jugar` varias veces sin listeners duplicados (un disparo por pulsación, cadencia máx. 4/s); los otros cuatro juegos intactos.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `/juegos/muralla/jugar` muestra el juego real (parapeto, 8 cuerdas, defensor, escaladores), sin arena decorativa.
- [ ] `←`/`A` y `→`/`D` mueven al defensor a 420 px/s dentro de `[30, 770]`; ninguna tecla hace scroll.
- [ ] `Espacio`/`↓`/`S`/`X` disparan hacia abajo; mantener autodispara cada 0.25 s; nunca hay más de 3 proyectiles; a ≤ 30 px de una cuerda el disparo sale alineado con ella.
- [ ] Los escaladores suben a la velocidad de su oleada (36 px/s en la 1); BLINDADO aguanta 2 impactos; SALTADOR cambia de cuerda una vez al cruzar la mitad.
- [ ] Los puntos por derribo son 10–50 según la altura (×1.5 saltador, ×2 blindado) y se ve el texto `+NN`.
- [ ] Terminar una oleada sin brechas suma `50 × oleada`; el nivel del HUD sube con cada oleada.
- [ ] Un escalador que llega a la cima resta 1 vida (HUD) con destello y temblor.
- [ ] Con 0 vidas se abre el modal FIN DEL JUEGO con la puntuación correcta, una sola vez.
- [ ] El HUD refleja puntuación, vidas y nivel (`hasLives: true`); el canvas no dibuja puntaje, vidas, nivel, "PAUSA" ni "GAME OVER".
- [ ] PAUSA congela escaladores, proyectiles, temporizadores y animaciones; REANUDAR continúa sin salto; FIN detiene el juego; JUGAR DE NUEVO deja puntaje 0, 3 vidas, nivel 01, muralla vacía.
- [ ] GUARDAR PUNTUACIÓN crea fila en `scores` con `game_id = 'muralla'`.
- [ ] El Salón muestra la pestaña MURALLA; vacía muestra `AÚN SIN CAMPEONES — SÉ EL PRIMERO`; stats reflejan la partida.
- [ ] El CHECK incluye todos los ids previos + `muralla`; insert con `rocas`, `caida`, `bloque-buster`, `serpentina` y `muralla` pasa; `get_advisors` sin problemas nuevos.
- [ ] Sin listeners duplicados al salir y volver.
- [ ] Controles táctiles visibles solo con `pointer: coarse`; botones de mantener funcionan; arrastrar mueve y tocar dispara; sin scroll de página.
- [ ] `rocas`, `caida`, `bloque-buster` y `serpentina` siguen funcionando igual.
- [ ] Sin errores de consola ni warnings de hydration (incluido Strict Mode).

---

## Decisiones

- **Sí:** id `muralla`, carpeta `lib/games/muralla/`, `muralla-canvas.tsx` (juego original: carpeta = id).
- **Sí:** categoría `SHOOTER` (acompaña a ROCAS), color `magenta` (ROCAS ya usa `yellow`). _(Abierta: color.)_
- **Sí:** puntos crecientes con la altura del impacto: núcleo de riesgo/recompensa y diferencia clara con un tirador fijo clásico.
- **Sí:** ayuda de puntería de 30 px hacia la cuerda: hace el juego viable en táctil sin quitar la necesidad de colocarse.
- **Sí (abierta):** balance (`vBase = 36·1.09^(w−1)` máx. 120, `6 + 2w` escaladores, intervalo `1.8·0.9^(w−1)` mín. 0.45, cupo 3 proyectiles, enfriamiento 0.25 s, mezcla de tipos por oleada). Ajustables tras probar.
- **Sí (abierta):** 3 vidas sin vidas extra. Alternativa: +1 vida cada 5 oleadas intactas.
- **Sí:** `hasLives: true`; `onLives` al haber brecha.
- **Sí:** sin texto "OLEADA N" en canvas (el nivel lo muestra el HUD); la transición se marca con destello del parapeto.
- **Sí:** migración del CHECK en el mismo PR (drop + add con lista completa).
- **No:** escaladores que disparan, jefes, power-ups, sonido, `P`/`Esc`.

---

## Riesgos

| Riesgo                                                        | Mitigación                                                                                                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict Mode duplica listeners/loops                           | `destroy()` idempotente: cancela rAF, quita listeners de teclado, `blur` y pointer del canvas                                                 |
| `window`/`Math.random` rompen SSR                             | Juego creado en `useEffect`; sorteos y listeners solo tras `start()`                                                                          |
| Teclas hacen scroll o reactivan botones enfocados             | `preventDefault` acotado a flechas y `Space`; `blur()` de botones de la plataforma                                                            |
| `dt` enorme tras pausa: escaladores saltan a la cima de golpe | `resume()` reinicia `lastTime`; `dt` capado a 0.05 s; temporizadores solo en el loop                                                          |
| Teclas "pegadas" al perder foco                               | Limpiar entrada en `pause()`, `restart()`, `destroy()`, `blur` y `pointercancel`                                                              |
| CSS var no sirve en canvas                                    | `getComputedStyle` al crear el juego, con fallbacks hex                                                                                       |
| Id fuera del CHECK falla el insert                            | Migración en el mismo PR; verificada con insert de prueba                                                                                     |
| Las 3 specs de la jam (y `abismo`) reescriben el mismo CHECK  | Releer el CHECK justo antes de aplicar; lista = vigente + `muralla` (+ ids de jam ya integrados); drop + add idempotente, el orden no importa |
| Puntero mal mapeado con canvas escalado                       | `getBoundingClientRect()` y factor `800/rect.width`                                                                                           |
| Toque para disparar dispara también al arrastrar              | Disparo por toque solo si el movimiento total < 8 px y duración < 250 ms                                                                      |
| Tunneling del proyectil (620 px/s → 31 px/frame) contra 40 px | Hitbox 40 px > 31 px; si se sube la velocidad, subdividir el paso                                                                             |
| Saltador cae sobre una cuerda llena                           | Solo salta a cuerda adyacente con hueco ≥ 70 px; si no hay, no salta                                                                          |
| Oleadas imposibles por saturación                             | Cupo de 2 por cuerda, máx. 30 por oleada y velocidad máx. 120 px/s (≥ 4.5 s en subir)                                                         |
| `best/plays` mock en `GAMES` no coinciden con reales          | Son solo fallback; la UI ya lee `game_stats`                                                                                                  |
| DPR alto vuelve borroso el canvas escalado                    | Aceptado; manejar `devicePixelRatio` si se nota                                                                                               |

---

## Qué **no** está en esta spec

- Sonido, vibración, música.
- Jefes, enemigos que disparan, power-ups, mejoras entre oleadas, vidas extra.
- Pausa por teclado (`P`/`Esc`), selector de oleada, persistencia local.
- Anti-trampa en puntajes y Auth.
- Los otros juegos de la jam (`escalada`, `cumbre`), `abismo` y ports pendientes (`gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
