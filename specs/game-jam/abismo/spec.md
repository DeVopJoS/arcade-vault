# SPEC JAM — Juego ABISMO (abismo) integrado en el reproductor con leaderboard

> **Status:** Borrador
> **Game jam:** océano (2026-11-24)
> **Depends on:** SPEC 01 (`GamePlayer`, datos), SPEC 05 (patrón de juego en canvas), SPEC 06 (leaderboard Supabase), SPEC 07 (registro `lib/games/registry.ts`)
> **Date:** 2026-11-24
> **Objective:** Crear desde cero ABISMO, un juego de buceo con oxígeno limitado donde se recogen perlas en la profundidad y solo puntúan al volver a la superficie, montarlo en `GamePlayer` vía el registro (`abismo`) y que su puntaje llegue al Salón de la Fama.

---

## Por qué existe esta spec

**Interpretación del tema "océano":** la profundidad como recurso y como riesgo. El océano es un corte vertical de 300 m: cuanto más hondo, más valen las perlas, más oscuro está y más rápido se gasta el oxígeno. El jugador decide en cada inmersión cuánto arriesgar antes de subir a depositar (empujar-tu-suerte). Es la interpretación "exploración / supervivencia" del tema, distinta de CARDUMEN (puzzle) y SONAR (shooter) de la misma jam.

Estado actual:

- `abismo` **no existe** en `GAMES` (`lib/data.ts`) ni en `GAME_CANVASES` (`lib/games/registry.ts`); sin entrada, `GamePlayer` caería en la simulación de puntaje.
- `abismo` **no está** en el CHECK `scores_game_id_chk` → hace falta migración.
- No hay portada: se crea `.cover-abismo` en `app/globals.css` y se amplía `CoverClass`.
- Fuente: **desde cero** (no hay nada en `references/started-games/` ni assets en `references/source-assets/`). Todo vectorial neón.

Antes de escribir código Next: leer la guía relevante en `node_modules/next/dist/docs/` (AGENTS.md; `cacheComponents` activo; Client Components).

> Estado real inspeccionado (2026-11-24): CHECK vigente leído en Supabase = `CHECK ((game_id = ANY (ARRAY['bloque-buster'::text, 'caida'::text, 'serpentina'::text, 'gloton'::text, 'invasores'::text, 'rocas'::text, 'ranaria'::text, 'duelo-pixel'::text])))`. `list_tables(public)` = `scores` (RLS on, 4 filas); vistas `scores_best` y `game_stats` existen. `GAMES` = `rocas, caida, bloque-buster, serpentina`. `GAME_CANVASES` = esos cuatro. `CATS` = `TODOS, ARCADE, PUZZLE, SHOOTER`. `app/globals.css` tiene `.cover-*` de las 8 portadas previstas y `.touch-controls/.touch-btn` (+ `.touch-tetris`, `.touch-arkanoid`, `.touch-snake`). No hay `supabase/migrations/` en el repo (migraciones solo vía MCP).

---

## Scope

**In:**

- Motor en `lib/games/abismo/` (sin globals; `window`/`document` solo en `start()`).
- Factory `createAbismoGame(canvas, callbacks, options)` con `start/pause/resume/restart/destroy/setInput`.
- `components/abismo-canvas.tsx` + controles táctiles (D-pad de mantener, reutiliza `.touch-*`, variante `.touch-abismo`).
- Registro: `abismo: { component: AbismoCanvas, hasLives: false }`. `GamePlayer` no cambia.
- Entrada `abismo` en `GAMES` (categoría `ARCADE`, `cover-abismo`, color `cyan`); `CoverClass` amplía con `"cover-abismo"`; CSS `.cover-abismo`.
- Migración que amplía `scores_game_id_chk` con `abismo` (lista completa vigente + nuevo id).
- HUD/pausa/FIN/modal de la plataforma; el canvas no dibuja puntaje, nivel, "PAUSA" ni "GAME OVER". Sí dibuja indicadores propios del juego: barra de oxígeno y perlas en la bolsa (ver Decisiones).

**Reglas:**

- Resolución lógica 800×600. Mundo de 800×3000 px: 10 px = 1 m, profundidad 0–300 m. La cámara sigue al buzo en vertical (buzo en el tercio central, cámara limitada a `[0, 2400]`).
- Superficie: franja `y < 40` (0–4 m). Fondo marino en `y = 3000` (el buzo no lo atraviesa).
- Buzo: hitbox círculo de radio 14 px. Movimiento en 8 direcciones con inercia: aceleración 600 px/s², velocidad máxima 220 px/s (diagonal normalizada), arrastre 2.5 /s cuando no hay entrada. Bordes laterales `x ∈ [16, 784]`.
- Inicio: buzo en `(400, 20)`, oxígeno 100 %, bolsa vacía.
- Oxígeno: consumo por segundo bajo superficie = `3 + profundidad_m / 50 + 0.5 × (nivel − 1)` % (a 0 m nivel 1: 3 %/s; a 300 m nivel 1: 9 %/s). En la superficie se recarga a 40 %/s hasta 100 %. Oxígeno 0 → fin (las perlas de la bolsa se pierden).
- Perlas: siempre 8 activas en el mundo, en ostras sobre "repisas" a profundidad aleatoria entre 30 y 290 m (posiciones `x ∈ [60, 740]`, separación mínima 80 px entre perlas). Al recoger una, reaparece otra a los 4 s en otra posición. Radio de recogida 22 px.
- Valor de perla = `10 × (1 + floor(profundidad_m / 50))` → 10 (0–49 m) … 60 (250–299 m).
- Bolsa: máximo 5 perlas; con la bolsa llena las perlas no se recogen (parpadean en gris).
- Depósito: al entrar en la superficie con perlas, `score += suma de valores`; si se depositan 5 perlas en un mismo viaje, suma ×2. `onScore` solo al depositar.
- Medusas (peligro): `4 + 2 × (nivel − 1)` medusas (máx. 14), repartidas entre 40 y 290 m; flotan con oscilación vertical senoidal (amplitud 40 px, periodo 3 s) y deriva horizontal de 30 px/s × `1.1^(nivel−1)` que rebota en los bordes. Hitbox círculo de radio 18 px. Tocar una: −15 % de oxígeno, aturdido 0.6 s (sin control, velocidad a 0) e invulnerable 1.5 s (buzo parpadea). Las medusas no se pueden destruir.
- Oscuridad: por debajo de 150 m, fuera de un radio de luz alrededor del buzo (`260 − (profundidad_m − 150)` px, mínimo 140) la escena se oscurece al 85 %. Las perlas emiten un brillo tenue visible siempre (para orientarse).
- Nivel = `1 + floor(perlasDepositadas / 10)`; sube el consumo de oxígeno, el número y la velocidad de las medusas. `onLevel` solo al cambiar.
- Fin: oxígeno 0 → animación de 600 ms y `onGameOver(score)` una sola vez. Sin vidas: `hasLives: false`.
- Duración esperada: 2–4 min (el consumo creciente por nivel garantiza el final).

**Controles:**

- Teclado: flechas y `WASD` (mantener; `preventDefault` solo en flechas).
- Táctil (`pointer: coarse`): D-pad de 4 botones de mantener (`onPointerDown` → `down=true`, `onPointerUp/Cancel` → `down=false`, con `setPointerCapture`); combinar dos botones da diagonal.

**Animaciones (por código, tiempo solo dentro del loop):**

- Buzo: silueta vectorial neón cyan (cuerpo + aletas) con aleteo senoidal de las aletas al moverse; burbujas que salen del casco cada 0.4 s y suben con deriva.
- Perla: brillo pulsante (radio 6→8 px, 1.4 s) + halo; al recogerla, la perla vuela hacia el buzo (180 ms) y aparece un texto flotante `+NN` que sube 30 px y se desvanece (600 ms).
- Depósito: destello en la superficie y ráfaga de 10 partículas amarillas; texto `x2` si fue viaje completo.
- Medusa: campana magenta con tentáculos ondulantes (4 trazos con fase distinta); al tocarla, flash blanco de 120 ms.
- Oxígeno bajo (< 25 %): barra roja parpadeante y viñeta roja en los bordes.
- Fin: el buzo pierde color y sube lentamente mientras la pantalla se oscurece (600 ms) antes de `onGameOver`.

**Out of scope:**

- Sonido, vibración, música.
- Tiburones u otros enemigos móviles persiguiendo, armas, power-ups (tanques extra), mejoras de equipo entre partidas.
- Mapa con paredes/cuevas, scroll horizontal, generación procedural de terreno.
- Pausa por teclado (`P`/`Esc`), persistencia local, selector de nivel.
- Anti-trampa, Auth, otros juegos, tests, modificar `references/`.

---

## Data model

```ts
// lib/games/abismo/index.ts — interfaz común
export interface AbismoCallbacks {
  onScore: (score: number) => void; // solo al depositar perlas en la superficie
  onLives: (lives: number) => void; // no se usa (hasLives:false); se acepta por contrato, no se invoca
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void; // oxígeno agotado
}

export type AbismoAction = "up" | "down" | "left" | "right";

export interface AbismoGame {
  start(): void; // registra listeners (teclado, blur) y arranca el loop
  pause(): void;
  resume(): void; // reinicia lastTime
  restart(): void; // score 0, nivel 1, oxígeno 100 %, buzo en superficie, perlas y medusas nuevas
  destroy(): void; // idempotente: cancela rAF y quita listeners
  setInput(action: AbismoAction, down: boolean): void; // teclado y D-pad (mantener)
}

export function createAbismoGame(
  canvas: HTMLCanvasElement,
  callbacks: AbismoCallbacks,
  options?: { color?: string; hazardColor?: string; pearlColor?: string },
): AbismoGame;
```

```ts
// lib/games/registry.ts — solo se añade una línea (+ import)
import AbismoCanvas from "@/components/abismo-canvas";
abismo: { component: AbismoCanvas, hasLives: false },
```

```ts
// lib/data.ts — CoverClass amplía con "cover-abismo"; nueva entrada en GAMES
// (best/plays son fallback mock; las cifras reales vienen de game_stats)
{
  id: "abismo", title: "ABISMO", cat: "ARCADE", cover: "cover-abismo", color: "cyan",
  short: "Bucea hondo, roba perlas y vuelve antes de quedarte sin aire.",
  long: "Desciende por un océano de 300 metros donde cada perla vale más cuanto más oscuro está. Solo puntúan las que subes a la superficie. Esquiva las medusas y vigila el oxígeno: el abismo no perdona a los codiciosos.",
  best: 0, plays: "0",
}
```

```sql
-- Migración (apply_migration, nombre: add_abismo_to_scores_game_id_chk)
-- Lista = CHECK vigente (2026-11-24) + 'abismo'. Si otro juego de la jam (cardumen, sonar)
-- ya amplió el CHECK, releerlo e incluir también esos ids antes de aplicar.
alter table public.scores drop constraint if exists scores_game_id_chk;
alter table public.scores add constraint scores_game_id_chk
  check (game_id in (
    'bloque-buster', 'caida', 'serpentina', 'gloton', 'invasores',
    'rocas', 'ranaria', 'duelo-pixel', 'abismo'
  ));
```

Estructura de archivos:

```
lib/games/abismo/
  index.ts     // createAbismoGame, loop, estado, input, cámara, callbacks
  entities.ts  // tipos Diver/Pearl/Jelly/Particle/FloatText, física, colisiones, spawn, dibujo neón
  utils.ts     // constantes (800×600, mundo 3000, 10 px/m), clamp, lerp, easing, valor de perla
components/abismo-canvas.tsx
app/globals.css  // + .cover-abismo, + .touch-abismo (solo si el D-pad necesita ajuste)
```

Convenciones:

- Resolución lógica fija 800×600 (4:3, igual que `.crt-screen`); escalado por CSS como `snake-canvas.tsx`. Fondo: degradado vertical dibujado en canvas de `rgba(0,245,255,.10)` (superficie) a transparente (fondo), oscurecido por profundidad; partículas de "nieve marina" tenues.
- Coordenadas de mundo vs. pantalla: todo se simula en coordenadas de mundo; el dibujo resta `cameraY`.
- Indicadores en canvas permitidos (son mecánica, no HUD de plataforma): barra de oxígeno vertical a la izquierda (x=16, alto 200 px), contador de perlas en bolsa (5 casillas junto a la barra) y profundidad actual en metros en tipografía mono pequeña. Nada de puntaje/nivel/vidas/"PAUSA"/"GAME OVER".
- Colores: `getComputedStyle(canvas)` para `--cyan` (buzo), `--magenta` (medusas), `--yellow` (perlas); fallbacks `#00f5ff`, `#ff006e`, `#f5ff00`.
- `Math.random` solo tras montar (spawn de perlas/medusas/partículas en `start()`/`restart()`).
- Callbacks solo al cambiar el valor (`onScore` al depositar, `onLevel` al cambiar; ambos emitidos una vez al arrancar/reiniciar con 0 y 1).
- Un solo `onGameOver` por partida (flag `ended`); tras la animación el loop se detiene.
- `dt` capado a 0.05 s; `resume()` reinicia `lastTime`.
- Entrada: set de acciones activas; se limpia en `pause()`, `restart()`, `destroy()` y `blur` de ventana.
- `preventDefault` solo en flechas, mientras el juego está montado.

---

## Implementation plan

Antes del paso 1: leer `node_modules/next/dist/docs/` (Client Components), el CSS de `.crt-screen`, `.cover-*` y `.touch-*` en `app/globals.css`, y `components/snake-canvas.tsx` + `lib/games/snake/` como modelo. Invocar `/frontend-design` antes de los pasos 5 y 7.

1. **Utils y entidades.** `utils.ts` (constantes, valor de perla, consumo de oxígeno, clamp/lerp/easing) y `entities.ts` (buzo con inercia, perlas con separación mínima, medusas con oscilación/deriva, colisiones círculo-círculo, partículas y textos flotantes, funciones de dibujo). Funciones puras donde sea posible. Verificar: `npx tsc --noEmit`.
2. **Motor.** `index.ts`: loop rAF con `dt` capado, cámara, oxígeno/recarga, bolsa y depósito (×2 con 5), nivel, oscuridad por profundidad, aturdimiento/invulnerabilidad, animación de fin y `onGameOver` único, `destroy()` idempotente. Sin HUD. Verificar: `npx tsc --noEmit` y `npm run lint`.
3. **Componente canvas.** `components/abismo-canvas.tsx` (client): `callbacksRef`, juego en `useEffect([])`, `destroy()` en cleanup, colores vía `getComputedStyle`, `ref` con `pause/resume/restart`, D-pad de mantener. Verificar: `npx tsc --noEmit`.
4. **Registro.** Entrada `abismo` en `GAME_CANVASES`. Verificar: compila; `/juegos/abismo/jugar` aún 404 hasta el paso 5 (sin entrada en `GAMES`), resto de juegos igual.
5. **Datos, portada y migración.** `CoverClass` + `.cover-abismo` (degradado azul profundo, buzo cyan arriba y perla amarilla con halo abajo, burbujas) + entrada en `GAMES`. Releer el CHECK con `execute_sql` y `apply_migration` con la lista completa vigente + `abismo`. Verificar: `/juegos`, filtro ARCADE, `/juegos/abismo`, `/juegos/abismo/jugar`; `execute_sql` insert de prueba con `game_id='abismo'` pasa y se borra la fila; insert con `rocas` sigue pasando; `get_advisors` (security) sin problemas nuevos.
6. **Pausa, FIN, reinicio y guardado.** PAUSA/REANUDAR/FIN/JUGAR DE NUEVO contra el juego real; HUD con puntaje/nivel (sin vidas); GUARDAR PUNTUACIÓN crea fila `abismo`. Verificar: fila en `scores` y pestaña ABISMO en `/salon` (antes de guardar: `AÚN SIN CAMPEONES — SÉ EL PRIMERO`).
7. **Estilo y táctil.** Pulir neón del buzo/medusas/perlas, viñeta de oxígeno bajo, D-pad (`.touch-abismo` solo si hace falta). Verificar: emulación táctil en DevTools; diagonales con dos botones; sin scroll de página.
8. **Cierre.** `npm run build`, `npm run lint`; entrar/salir de `/juegos/abismo/jugar` varias veces sin listeners duplicados (velocidad del buzo constante, no duplicada); `rocas`, `caida`, `bloque-buster`, `serpentina` intactos.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `/juegos/abismo/jugar` muestra el juego real (buzo, perlas, medusas, océano con cámara vertical), sin arena decorativa.
- [ ] Flechas/WASD mueven al buzo con inercia en 8 direcciones (máx. 220 px/s); ninguna tecla hace scroll.
- [ ] El oxígeno baja más rápido cuanto más profundo (3 %/s en superficie de nivel 1 → 9 %/s a 300 m) y se recarga a 40 %/s en la superficie.
- [ ] Las perlas valen 10–60 según su profundidad; la bolsa admite 5; con bolsa llena no se recogen.
- [ ] El puntaje solo sube al llegar a la superficie; 5 perlas en un viaje suman ×2.
- [ ] Tocar una medusa resta 15 % de oxígeno, aturde 0.6 s y da 1.5 s de invulnerabilidad.
- [ ] Bajo 150 m la escena se oscurece fuera del radio de luz; las perlas siguen brillando.
- [ ] Cada 10 perlas depositadas sube el nivel (HUD), con más medusas y más consumo.
- [ ] Oxígeno 0 abre el modal FIN DEL JUEGO con la puntuación depositada correcta (las perlas de la bolsa no cuentan), una sola vez.
- [ ] El HUD refleja puntuación y nivel; sin vidas visibles (`hasLives: false`); el canvas no dibuja puntaje, nivel, "PAUSA" ni "GAME OVER" (solo oxígeno, bolsa y profundidad).
- [ ] PAUSA congela física, oxígeno y animaciones; REANUDAR continúa sin salto; FIN detiene el juego; JUGAR DE NUEVO deja puntaje 0, nivel 01, oxígeno 100 %, buzo en superficie.
- [ ] GUARDAR PUNTUACIÓN crea fila en `scores` con `game_id = 'abismo'`.
- [ ] El Salón muestra la pestaña ABISMO; vacía muestra `AÚN SIN CAMPEONES — SÉ EL PRIMERO`; stats reflejan la partida.
- [ ] El CHECK incluye todos los ids previos + `abismo`; insert con `rocas`, `caida`, `bloque-buster`, `serpentina` y `abismo` pasa; `get_advisors` sin problemas nuevos.
- [ ] Sin listeners duplicados al salir y volver.
- [ ] D-pad táctil visible solo con `pointer: coarse`; mantener pulsado mueve, soltar detiene (con inercia); sin scroll de página.
- [ ] `rocas`, `caida`, `bloque-buster` y `serpentina` siguen funcionando igual.
- [ ] Sin errores de consola ni warnings de hydration (incluido Strict Mode).

---

## Decisiones

- **Sí:** id `abismo`, carpeta `lib/games/abismo/` y `abismo-canvas.tsx` (juego original: el nombre de carpeta coincide con el id).
- **Sí:** juego desde cero, todo vectorial neón; sin assets.
- **Sí:** el puntaje solo cuenta al depositar en la superficie: es el núcleo de riesgo/recompensa y hace el puntaje comparable (perlas aseguradas).
- **Sí (abierta):** barra de oxígeno, bolsa y profundidad dibujadas en el canvas. El HUD de la plataforma solo tiene puntaje/vidas/nivel; el oxígeno es mecánica, no HUD. Alternativa: mapear oxígeno a "vidas" (no encaja: es continuo).
- **Sí (abierta):** valores de balance (consumo `3 + m/50`, recarga 40 %/s, perla `10 × (1 + floor(m/50))`, ×2 con 5 perlas, −15 % por medusa, nivel cada 10 perlas). Ajustables tras probar.
- **Sí (abierta):** categoría `ARCADE`, color `cyan`. Nueva portada `.cover-abismo` (no se reutiliza `.cover-rana`, reservada para `ranaria`).
- **Sí:** `hasLives: false`; una sola inmersión-partida termina con el oxígeno.
- **Sí:** migración del CHECK en el mismo PR (drop + add con lista completa).
- **No:** enemigos que persiguen, armas, power-ups, sonido, `P`/`Esc`.

---

## Riesgos

| Riesgo                                                                   | Mitigación                                                                                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Strict Mode duplica listeners/loops                                      | `destroy()` idempotente: cancela rAF, quita listeners de teclado y `blur`                                                             |
| `window`/`Math.random` rompen SSR                                        | Juego creado en `useEffect`; spawn y listeners solo en `start()`                                                                      |
| Teclas hacen scroll o reactivan botones enfocados                        | `preventDefault` acotado a flechas; `blur()` de botones de la plataforma                                                              |
| `dt` enorme tras pausa vacía el oxígeno de golpe                         | `resume()` reinicia `lastTime`; `dt` capado a 0.05 s                                                                                  |
| Teclas "pegadas" al perder foco                                          | Limpiar entrada en `pause()`, `restart()`, `destroy()` y `blur` de ventana                                                            |
| CSS var no sirve en canvas                                               | `getComputedStyle` al crear el juego, con fallbacks hex                                                                               |
| Id fuera del CHECK falla el insert                                       | Migración en el mismo PR; verificada con insert de prueba                                                                             |
| Las 3 specs de la jam reescriben el mismo CHECK                          | Releer el CHECK justo antes de aplicar; la lista = vigente + `abismo` (+ ids de jam ya integrados); el orden de aplicación no importa |
| Oscuridad costosa (máscara por frame)                                    | Un solo `radialGradient` + `fillRect` por frame con `globalCompositeOperation`; sin offscreen grandes                                 |
| Perlas inalcanzables con el oxígeno disponible (muy hondas a nivel alto) | Siempre ≥ 3 perlas activas en 30–150 m; el resto aleatorio                                                                            |
| Medusa aparece encima del buzo al reiniciar                              | Spawn de medusas solo a > 40 m y a > 120 px del buzo                                                                                  |
| Cámara con saltos al subir rápido                                        | Cámara con `lerp` (factor 8 /s) y clamp `[0, 2400]`                                                                                   |
| `best/plays` mock en `GAMES` no coinciden con reales                     | Son solo fallback; la UI ya lee `game_stats`                                                                                          |
| DPR alto vuelve borroso el canvas escalado                               | Aceptado; manejar `devicePixelRatio` si se nota                                                                                       |

---

## Qué **no** está en esta spec

- Sonido, vibración, música.
- Tiburones, armas, power-ups, mejoras de equipo, tanques extra.
- Cuevas, paredes, scroll horizontal o terreno procedural.
- Pausa por teclado (`P`/`Esc`), selector de nivel, persistencia local.
- Anti-trampa en puntajes y Auth.
- Los otros juegos de la jam (`cardumen`, `sonar`) y ports pendientes (`gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
