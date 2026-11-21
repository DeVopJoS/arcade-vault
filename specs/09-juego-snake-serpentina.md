# SPEC 09 — Juego Snake (SERPENTINA) integrado en el reproductor con leaderboard

> **Status:** Aprobado
> **Depends on:** SPEC 01 (`GamePlayer`, datos), SPEC 05 (patrón de juego en canvas), SPEC 06 (leaderboard Supabase), SPEC 07 (registro `lib/games/registry.ts`)
> **Date:** 2026-11-20
> **Objective:** Crear Snake desde cero en TypeScript con frutas animadas del spritesheet de `references/source-assets/snake-assets/`, montarlo en `GamePlayer` vía el registro (`serpentina`) y que su puntaje llegue al Salón de la Fama.

---

## Por qué existe esta spec

`serpentina` no existe en `GAMES` (`lib/data.ts`), aunque el CHECK `scores_game_id_chk` ya lo admite y `CoverClass` ya prevé `cover-snake` (CSS existente en `app/globals.css`). El registro `GAME_CANVASES` ya existe (SPEC 07/08: `rocas`, `caida`, `bloque-buster`): basta añadir una entrada.

No hay juego fuente: **se crea desde cero**. Solo hay assets en `references/source-assets/snake-assets/`:

- `fruits.png`: hoja 3790×442 RGBA (585 KB), fondo transparente.
- `sprites.js`: `window.SPRITE_ATLAS` con 22 frutas (`banana, orange, grape, garlic, eggplant, strawberry, cherry, carrot, mushroom, broccoli, watermelon, pepper, kiwi, lemon, peach, peanut, apple, tomato, berries, grapes2, pineapple, melon`), cada una `{x,y,w,h}` en la fila `y=136..296` (alto 160, ancho 110–170). Usa `window` y una ruta `snake-assets/fruits.png`: **no se importa tal cual**; se porta a un módulo TS sin globals.

Es un único PNG estático por fruta (no hay frames): las "animaciones" se generan por código (flotado, aparición, estallido al comer).

Antes de escribir código Next: leer la guía relevante en `node_modules/next/dist/docs/` (AGENTS.md; `cacheComponents` activo; assets en `public/`).

> Estado real inspeccionado (Supabase): CHECK vigente = `bloque-buster, caida, serpentina, gloton, invasores, rocas, ranaria, duelo-pixel`; `serpentina` ya incluido → **sin migración**. `GAMES` = `rocas, caida, bloque-buster`. `GAME_CANVASES` = esos tres. `.cover-snake` y `.touch-controls/.touch-btn` (+ variantes `.touch-tetris`, `.touch-arkanoid`) existen. No hay `supabase/migrations/` en el repo (migraciones solo vía MCP).

---

## Scope

**In:**

- Motor en `lib/games/snake/` (sin globals; `window`/`document`/`Image` solo en `start()`).
- Factory `createSnakeGame(canvas, callbacks, options)` con `start/pause/resume/restart/destroy/setInput`.
- `components/snake-canvas.tsx` + controles táctiles (D-pad, reutiliza `.touch-*`) + swipe sobre el canvas.
- Asset: copiar `fruits.png` a `public/games/snake/fruits.png`; atlas tipado en `lib/games/snake/sprites.ts` (port de `sprites.js`, sin `window`). `references/source-assets/` no se modifica.
- Registro: `serpentina: { component: SnakeCanvas, hasLives: false }`. `GamePlayer` no cambia.
- Entrada `serpentina` en `GAMES` (categoría `ARCADE`, `cover-snake`, color `green`).
- Verificar guardado con `game_id = 'serpentina'` y pestaña del Salón (sin migración).
- HUD/pausa/FIN/modal de la plataforma; el canvas no dibuja puntaje, nivel, "PAUSA" ni "GAME OVER".

**Reglas (propuestas, ver Decisiones abiertas):**

- Resolución lógica 800×600; rejilla 20×15 con celdas de 40 px.
- Serpiente inicial: 3 segmentos en el centro-izquierda, moviéndose a la derecha.
- Movimiento por pasos discretos: intervalo inicial 140 ms, −4 ms por fruta comida, mínimo 70 ms. `dt` acumulado con tope 50 ms por frame.
- Una fruta a la vez, aleatoria entre las 22 del atlas, en celda libre (no sobre la serpiente).
- Comer fruta: +10 puntos, la serpiente crece 1 segmento, aparece otra fruta.
- Nivel = `1 + floor(frutas / 5)`; sube la velocidad con la fórmula anterior; `onLevel` solo al cambiar.
- Fin: choque con pared o con el propio cuerpo (muerte inmediata, una sola vida), o tablero lleno (victoria). `onGameOver(score)` único.
- Sin vidas: `hasLives: false` → el HUD las oculta como en `caida`.
- Giro: buffer de entrada de 1 giro por paso; se ignora el giro de 180°.

**Controles:**

- Teclado: flechas y `WASD` (`preventDefault` solo en flechas).
- Táctil: D-pad de 4 botones (`pointer: coarse`) + swipe sobre el canvas (umbral 24 px).

**Animaciones (todas por código, `Date`/`performance.now` solo dentro del loop):**

- Fruta: flotado senoidal vertical (±3 px, 1.2 s) + halo neón; aparición con escala 0→1 (180 ms, ease-out-back).
- Comer: la fruta se encoge y sube mientras se desvanece (250 ms) + 6 partículas neón radiales; cabeza hace un "pulso" breve (escala 1.15).
- Serpiente: segmentos vectoriales neón (relleno `rgba(green,.25)` + trazo + `shadowBlur`), cabeza con ojos orientados a la dirección; cuerpo interpolado entre pasos para movimiento fluido.
- Muerte: parpadeo del cuerpo (3 destellos, 450 ms) antes de emitir `onGameOver`.

**Out of scope:**

- Sonido, vibración, power-ups, obstáculos, modo sin paredes (wrap), frutas con valores distintos, vidas, multijugador, IA.
- Persistencia local (`localStorage`), selector de nivel, pausa por teclado (`P`/`Esc`).
- Anti-trampa, Auth, otros juegos, tests, modificar `references/`.

---

## Data model

```ts
// lib/games/snake/index.ts — interfaz común
export interface SnakeCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void; // no se usa (hasLives:false); se acepta por contrato, no se invoca
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void; // choque o tablero lleno
}

export type SnakeAction = "up" | "down" | "left" | "right";

export interface SnakeGame {
  start(): void; // carga fruits.png, registra listeners (teclado, pointer/swipe) y arranca el loop
  pause(): void;
  resume(): void; // reinicia lastTime
  restart(): void; // score 0, nivel 1, serpiente inicial
  destroy(): void; // idempotente: cancela rAF y quita listeners; anula onload de Image
  setInput(action: SnakeAction, down: boolean): void; // teclado y D-pad (solo down=true gira)
}

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
  options?: { color?: string; spriteUrl?: string },
): SnakeGame;
```

```ts
// lib/games/snake/sprites.ts — port tipado de sprites.js (sin window)
export const FRUIT_SHEET = "/games/snake/fruits.png";
export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const FRUITS = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  // ... las 22 entradas de sprites.js, valores idénticos
} as const satisfies Record<string, SpriteRect>;
export type FruitName = keyof typeof FRUITS;
```

```ts
// lib/games/registry.ts — solo se añade una línea
import SnakeCanvas from "@/components/snake-canvas";
serpentina: { component: SnakeCanvas, hasLives: false },
```

```ts
// lib/data.ts — nueva entrada (best/plays son fallback mock; las cifras reales vienen de game_stats)
{
  id: "serpentina", title: "SERPENTINA", cat: "ARCADE", cover: "cover-snake", color: "green",
  short: "Come, crece y no te muerdas la cola.",
  long: "Guía a la serpiente por la rejilla, devora frutas y crece sin chocar con las paredes ni contigo misma. Cada cinco frutas el ritmo se acelera.",
  best: 0, plays: "0",
}
```

```sql
-- Sin migración. CHECK vigente (leído en Supabase):
-- CHECK ((game_id = ANY (ARRAY['bloque-buster','caida','serpentina','gloton','invasores','rocas','ranaria','duelo-pixel'])))
-- 'serpentina' ya está incluido; solo se verifica con un insert de prueba (y se borra la fila).
```

Estructura de archivos:

```
lib/games/snake/
  index.ts     // createSnakeGame, loop, estado, input, callbacks
  entities.ts  // tipos Snake/Fruit/Particle, avance de paso, colisiones, spawn, dibujo neón
  sprites.ts   // atlas tipado + FRUIT_SHEET
  utils.ts     // constantes (800×600, 40px, 20×15), clamp, easing, swipe → dirección
components/snake-canvas.tsx
public/games/snake/fruits.png   // copia de references/source-assets/snake-assets/fruits.png
```

Convenciones:

- Resolución lógica fija 800×600 (4:3, igual que `.crt-screen`); escalado por CSS como `asteroids-canvas.tsx`. Fondo transparente; rejilla tenue opcional (líneas `rgba(green,.06)`).
- Dibujo de fruta con `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)` conservando proporción dentro de la celda (alto ~34 px, ancho proporcional ≤ 40). `imageSmoothingEnabled = true`.
- `Image` se crea **en `start()`**; si aún no cargó (o falla) se dibuja un círculo neón magenta como fallback y el juego sigue. Callback `onload` anulado en `destroy()`.
- `Math.random` solo tras montar (client), vía spawn de fruta/partículas.
- Callbacks solo al cambiar el valor (`onScore` al comer, `onLevel` al cambiar; ambos emitidos una vez al arrancar/reiniciar).
- Un solo `onGameOver` por partida (flag `ended`); tras él el loop se detiene.
- `clearInput()`/limpiar buffer de giros en `pause()`, `restart()`, `destroy()` y `blur` de ventana.
- `preventDefault` solo en flechas, mientras el juego está montado.
- Swipe: listeners `pointerdown/pointerup` en el `canvas` (no `document`), retirados en `destroy()`; `touch-action: none` en el canvas.

---

## Implementation plan

Antes del paso 1: leer `node_modules/next/dist/docs/` (Client Components, assets estáticos), el CSS de `.crt-screen` y `.touch-*` en `app/globals.css`, y `components/arkanoid-canvas.tsx` / `components/tetris-canvas.tsx` como modelo. Invocar `/frontend-design` antes de los pasos 5 y 6.

1. **Assets y atlas.** Copiar `fruits.png` a `public/games/snake/`; crear `sprites.ts` con las 22 frutas. Verificar: `npx tsc --noEmit`; `/games/snake/fruits.png` sirve el archivo.
2. **Utils y entidades.** `utils.ts`, `entities.ts` (estado de serpiente, avance por paso, colisión pared/cuerpo, spawn en celda libre, dibujo neón, partículas, easing). Funciones puras donde sea posible. Verificar: `npx tsc --noEmit`.
3. **Motor.** `index.ts`: loop rAF con `dt` capado, acumulador de pasos, buffer de giros, crecimiento, puntaje/nivel/velocidad, animaciones (flotado, aparición, estallido, muerte), carga de `Image` en `start()`, `onGameOver` único, `destroy()` idempotente. Sin HUD. Verificar: `tsc` y `npm run lint`.
4. **Componente canvas.** `components/snake-canvas.tsx` (client): `callbacksRef`, juego en `useEffect([])`, `destroy()` en cleanup, color por `getComputedStyle(canvas).getPropertyValue("--green")`, `ref` con `pause/resume/restart`, D-pad provisional. Verificar: compila.
5. **Registro + datos.** Entrada en `GAME_CANVASES` y en `GAMES`. Verificar: `/juegos/serpentina`, `/juegos/serpentina/jugar`, biblioteca (filtro ARCADE) y pestaña del Salón (estado vacío); `rocas`, `caida`, `bloque-buster` siguen igual. `execute_sql`: insert `game_id='serpentina'` pasa el CHECK y borrar la fila; `get_advisors` (security) sin problemas nuevos.
6. **Pausa, FIN, reinicio y guardado.** PAUSA/REANUDAR/FIN/JUGAR DE NUEVO contra el juego real; HUD con puntaje/nivel (sin vidas); GUARDAR PUNTUACIÓN crea fila `serpentina`. Verificar en `scores` y en el Salón.
7. **Estilo y táctil.** Pulir portada `.cover-snake` si hace falta, neón de la serpiente y D-pad (variante `.touch-snake` solo si hace falta) + swipe. Verificar con emulación táctil.
8. **Cierre.** `npm run build`, `npm run lint`; entrar/salir de `/juegos/serpentina/jugar` varias veces sin listeners duplicados (un giro por pulsación).

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `/juegos/serpentina/jugar` muestra el juego real (serpiente, fruta), sin arena decorativa.
- [ ] Flechas/WASD giran la serpiente; no hay giro de 180°; ninguna tecla hace scroll.
- [ ] Las frutas se dibujan con sprites de `fruits.png` (recorte correcto, sin deformar) y varían entre partidas; con el PNG bloqueado el juego sigue con el fallback.
- [ ] Animaciones visibles: flotado y aparición de fruta, estallido/partículas al comer, pulso de cabeza, parpadeo al morir.
- [ ] Comer suma 10, crece 1 segmento y genera otra fruta en celda libre.
- [ ] Cada 5 frutas sube el nivel (HUD) y la velocidad (mínimo 70 ms/paso).
- [ ] Choque con pared o cuerpo abre el modal FIN DEL JUEGO con la puntuación correcta, una sola vez.
- [ ] Tablero lleno (si se alcanza) también abre FIN, una sola vez.
- [ ] El HUD refleja puntuación y nivel; sin vidas visibles (`hasLives: false`); el canvas no dibuja HUD, "PAUSA" ni "GAME OVER".
- [ ] PAUSA congela serpiente, animaciones y entrada; REANUDAR continúa sin salto; FIN detiene el juego; JUGAR DE NUEVO deja puntaje 0, nivel 01, serpiente inicial.
- [ ] GUARDAR PUNTUACIÓN crea fila en `scores` con `game_id = 'serpentina'`.
- [ ] El Salón muestra el puntaje en la pestaña SERPENTINA; vacío muestra `AÚN SIN CAMPEONES — SÉ EL PRIMERO`; stats reflejan la partida.
- [ ] Insert con `game_id` previos (`rocas`, `caida`, `bloque-buster`) y `serpentina` pasa el CHECK; `get_advisors` sin problemas nuevos.
- [ ] Sin listeners duplicados al salir y volver (un giro por pulsación).
- [ ] Controles táctiles (D-pad) visibles solo con `pointer: coarse`; swipe gira sin hacer scroll de página.
- [ ] `rocas`, `caida` y `bloque-buster` siguen funcionando igual.
- [ ] Sin errores de consola ni warnings de hydration (incluido Strict Mode); sin `Image` creada en carga de módulo ni en render.
- [ ] `references/source-assets/snake-assets/` no fue modificado (solo se copia el PNG a `public/`).

---

## Decisiones

- **Sí:** id `serpentina` (ya en el CHECK; mapeo natural a `cover-snake`). **Sin migración**, solo verificación.
- **Sí:** carpeta `lib/games/snake/` y `snake-canvas.tsx` (nombrados por el juego, como `asteroids`/`tetris`/`arkanoid`); id de plataforma `serpentina`.
- **Sí:** copiar `fruits.png` a `public/games/snake/` y usarlo con `Image` creado en `start()`. Es lo que piden los assets; el peso (585 KB) se acepta una vez cacheado. _(Abierta: si pesa para el primer render, recortar/optimizar el PNG en una spec aparte.)_
- **Sí:** portar `sprites.js` a `sprites.ts` (sin `window`, ruta `/games/snake/fruits.png`), valores idénticos.
- **Sí:** serpiente y partículas en vectores neón (look coherente con el resto); solo las frutas usan sprite.
- **Sí:** "animaciones" generadas por código, ya que el PNG no trae frames.
- **Sí (abierta):** una sola vida, choque con pared = muerte (clásico). Alternativa: modo wrap o 3 vidas (`hasLives: true`).
- **Sí (abierta):** +10 por fruta, nivel cada 5 frutas, velocidad 140→70 ms. Valores ajustables tras probar.
- **Sí (abierta):** categoría `ARCADE`, color `green` (coincide con `.cover-snake`).
- **Sí:** victoria por tablero lleno termina con `onGameOver(score)`; el modal no distingue victoria de derrota.
- **No:** audio, power-ups, obstáculos, `P`/`Esc`, persistencia local.

---

## Riesgos

| Riesgo                                                                | Mitigación                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Strict Mode duplica listeners/loops/`Image`                           | `destroy()` idempotente: cancela rAF, quita listeners, anula `onload`               |
| `Image`/`window`/`Math.random` rompen SSR                             | `Image` y listeners solo en `start()`; juego creado en `useEffect`                  |
| PNG tarda o falla en cargar                                           | Fallback vectorial (círculo neón); el juego no espera al PNG                        |
| Peso del PNG (585 KB) en conexión lenta                               | Carga asíncrona no bloqueante; cacheable por el navegador                           |
| Recortes del atlas desalineados (halos/bordes de otra fruta)          | Verificar visualmente las 22 frutas en el paso 3; ajustar `{x,y,w,h}` si hace falta |
| Frutas con ancho distinto se deforman                                 | `drawImage` conservando proporción dentro de la celda                               |
| Teclas hacen scroll o reactivan botones enfocados                     | `preventDefault` acotado a flechas; `blur()` de botones de la plataforma            |
| Doble giro en un mismo paso causa autochoque (↑ luego ← estando en →) | Buffer de 1 giro por paso + ignorar 180° respecto a la última dirección aplicada    |
| `dt` enorme tras pausa dispara muchos pasos                           | `resume()` reinicia `lastTime`; `dt` capado a 50 ms; acumulador con tope            |
| Swipe hace scroll de la página                                        | `touch-action: none` en el canvas; swipe en `pointerdown/up` del canvas             |
| Teclas "pegadas" al perder foco o pausar                              | Limpiar buffer en `pause()`, `restart()`, `destroy()` y `blur` de ventana           |
| CSS var no sirve en canvas                                            | `getComputedStyle` al crear el juego                                                |
| Spawn de fruta en bucle infinito con tablero casi lleno               | Elegir entre celdas libres calculadas; si no hay → victoria                         |
| Id fuera del CHECK falla el insert                                    | `serpentina` ya está en el CHECK; verificado en el paso 5                           |
| `best/plays` mock en `GAMES` no coinciden con reales                  | Son solo fallback; la UI ya lee `game_stats`                                        |
| DPR alto vuelve borroso el canvas escalado                            | Aceptado; manejar `devicePixelRatio` si se nota                                     |

---

## Qué **no** está en esta spec

- Sonido, vibración, música.
- Power-ups, frutas especiales/puntuaciones distintas, obstáculos, modo wrap, vidas.
- Pausa por teclado (`P`/`Esc`), selector de nivel, persistencia local.
- Optimización/recorte del spritesheet.
- Anti-trampa en puntajes y Auth.
- Port de otros juegos (`gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
