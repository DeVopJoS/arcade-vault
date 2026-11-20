# SPEC NN — Juego <TÍTULO> (<id>) integrado en el reproductor con leaderboard

> **Status:** Borrador
> **Depends on:** SPEC 01 (`GamePlayer`, datos), SPEC 05 (patrón de juego en canvas), SPEC 06 (leaderboard Supabase) [+ otras]
> **Date:** <YYYY-MM-DD>
> **Objective:** <una frase: portar/crear <juego>, montarlo en GamePlayer vía registro y que su puntaje llegue al Salón de la Fama>

---

## Por qué existe esta spec

<Estado actual (qué hay hoy para este juego: simulación o nada), fuente (carpeta de referencia o desde cero) y qué hay que encapsular/limpiar.>

---

## Scope

**In:**

- Port/creación en `lib/games/<id>/` (sin globals; `window`/`document` solo en `start()`).
- Factory `create<Name>Game(canvas, callbacks, options)` con `start/pause/resume/restart/destroy/setInput`.
- `components/<id>-canvas.tsx` + controles táctiles.
- Registro `lib/games/registry.ts` y refactor de `GamePlayer` (reemplaza `isRocas`; migra `rocas` si el registro no existía).
- Entrada en `GAMES` (`lib/data.ts`) y migración que amplía `scores_game_id_chk`.
- HUD/pausa/FIN/modal de la plataforma; sin HUD ni "GAME OVER" en canvas.
- Reglas del juego: <lista concreta>.
- Controles: <teclado> / <táctil>.

**Out of scope:**

- <Mecánicas no presentes en la fuente, sonido, anti-trampa, Auth, otros juegos, tests, modificar `references/`>.

---

## Data model

```ts
// lib/games/<id>/index.ts — interfaz común
export interface <Name>Callbacks { onScore; onLives; onLevel; onGameOver }
export interface <Name>Game { start; pause; resume; restart; destroy; setInput }
export function create<Name>Game(canvas, callbacks, options?): <Name>Game;
```

```ts
// lib/games/registry.ts
export const GAME_CANVASES: Record<string, ComponentType<CanvasProps>> = { ... };
```

```sql
-- migración: ampliar game_id (lista = CHECK vigente + nuevo id)
alter table public.scores drop constraint scores_game_id_chk;
alter table public.scores add constraint scores_game_id_chk
  check (game_id in (<lista completa>));
```

Estructura de archivos, convenciones (resolución lógica, callbacks solo al cambiar, `dt` cap, `preventDefault` acotado).

---

## Implementation plan

Antes del paso 1: leer `node_modules/next/dist/docs/` (Client Components), el CSS de `.crt-screen`; invocar `/frontend-design` para UI nueva.

1. **Utils y entidades.** … Verificar: `npx tsc --noEmit`.
2. **Motor.** … Verificar: `tsc` y `npm run lint`.
3. **Componente canvas.** …
4. **Registro + GamePlayer.** … Verificar: `/juegos/<id>/jugar` muestra el juego; otros siguen simulados.
5. **Datos y migración.** `GAMES` + `apply_migration`; `get_advisors`.
6. **Pausa, FIN, reinicio y guardado.** Verificar fila en `scores` y pestaña del Salón.
7. **Estilo neón y táctil.** …
8. **Cierre.** `npm run build`, `npm run lint`, navegar fuera/volver sin listeners duplicados.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `/juegos/<id>/jugar` muestra el juego real, sin arena decorativa.
- [ ] Controles y reglas: <criterios concretos del juego>.
- [ ] HUD de la plataforma refleja puntuación/vidas/nivel; el canvas no dibuja HUD ni "GAME OVER".
- [ ] PAUSA/REANUDAR, FIN y JUGAR DE NUEVO funcionan.
- [ ] GUARDAR PUNTUACIÓN crea fila en `scores` con `game_id = '<id>'`.
- [ ] El Salón muestra el puntaje en la pestaña del juego; vacío muestra `AÚN SIN CAMPEONES — SÉ EL PRIMERO`.
- [ ] Insert con `game_id` previo y nuevo pasa el CHECK; `get_advisors` sin problemas nuevos.
- [ ] Sin listeners duplicados al salir y volver (un solo disparo/acción por pulsación).
- [ ] Otros juegos (`rocas` y simulados) siguen funcionando.
- [ ] Controles táctiles solo con `pointer: coarse`.
- [ ] Sin errores de consola ni warnings de hydration.
- [ ] `references/started-games/<carpeta>/` no fue modificado.

---

## Decisiones

- **Sí/No:** <decisión>. <razón>.

---

## Riesgos

| Riesgo                                         | Mitigación                                    |
| ---------------------------------------------- | --------------------------------------------- |
| Strict Mode duplica listeners/loops            | `destroy()` idempotente                       |
| `Math.random`/`window` rompen SSR              | Crear el juego en `useEffect`                 |
| Teclas hacen scroll                            | `preventDefault` acotado; `blur()` de botones |
| `dt` enorme tras pausa                         | `resume()` reinicia `lastTime`; `dt` capado   |
| CSS var no sirve en canvas                     | `getComputedStyle` al crear                   |
| Id fuera del CHECK falla el insert             | Migración en el mismo PR                      |
| <riesgos propios: assets, audio autoplay, DPR> | …                                             |

---

## Qué **no** está en esta spec

- <Lista>. Cada uno, si se hace, va en su propia spec.
