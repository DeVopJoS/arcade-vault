# SPEC 06 — Salón de la Fama con puntajes reales en Supabase

> **Status:** Aprobado
> **Depends on:** SPEC 04 (clientes Supabase), SPEC 05 (juego `rocas` y modal FIN DEL JUEGO), SPEC 01 (`GamePlayer`, `hall-of-fame.tsx`, `lib/data.ts`)
> **Date:** 2026-11-19
> **Objective:** Guardar los puntajes del modal FIN DEL JUEGO en una tabla `scores` de Supabase y mostrar en el Salón de la Fama el ranking real (mejor marca por nombre) de cada juego, con estados vacío y error.

---

## Por qué existe esta spec

SPEC 05 dejó `rocas` jugable pero su puntaje solo llega a `localStorage["av_scores"]`, y el Salón (`components/hall-of-fame.tsx`) muestra datos inventados con `seededScores` y una fila "TU MEJOR MARCA" falsa. SPEC 04 dejó la conexión a Supabase sin tablas. Esta spec une las tres piezas: el primer dato real compartido entre jugadores.

---

## Scope

**In:**

- Migración con la tabla `scores`, RLS (solo `select` e `insert` para `anon`/`authenticated`) y CHECKs de validación.
- Vista `scores_best` (mejor marca por `game_id` + `player_name`) para el ranking.
- `lib/scores.ts`: funciones `submitScore` y `fetchLeaderboard` sobre el cliente de `lib/supabase/client.ts`.
- `GamePlayer`: GUARDAR PUNTUACIÓN inserta en Supabase (aplica a `rocas` y a los 7 juegos simulados).
- `HallOfFame`: las 8 pestañas leen de Supabase; podio y tabla con datos reales, estado de carga, vacío y error con reintento.
- Eliminar la fila "TU MEJOR MARCA" y las variables `youRank`/`youScore`.
- Textos en español, mismas clases CSS existentes (`av-hall`, `podium`, `hall-table`).

**Out of scope (para futuras specs):**

- Supabase Auth y puntajes ligados a `user_id` (el nombre sigue siendo libre, `av_user`).
- Anti-trampa real (validación de partida en servidor, rate limit, firma de puntaje).
- Fila "TU MEJOR MARCA" real o por nombre.
- Reemplazar `seededScores` en `app/juegos/[id]/page.tsx` (la ficha del juego sigue con mock).
- Migrar los puntajes ya guardados en `av_scores` a Supabase.
- Paginación, filtros por fecha/semana, buscador de jugadores.
- Tiempo real (Supabase Realtime) o revalidación automática.
- Portar los otros 7 juegos (siguen simulados; su puntaje simulado sí se guarda).
- Tests automatizados.

---

## Data model

Tabla nueva en esquema `public`:

```sql
create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text        not null,
  player_name text        not null,
  score       integer     not null,
  created_at  timestamptz not null default now(),
  constraint scores_game_id_chk
    check (game_id in ('bloque-buster','caida','serpentina','gloton',
                       'invasores','rocas','ranaria','duelo-pixel')),
  constraint scores_name_chk
    check (char_length(player_name) between 1 and 10),
  constraint scores_score_chk
    check (score between 0 and 10000000)
);

create index scores_game_score_idx on public.scores (game_id, score desc);
```

Vista de ranking (mejor marca por jugador y juego):

```sql
create view public.scores_best
with (security_invoker = true) as
select distinct on (game_id, player_name)
  game_id, player_name, score, created_at
from public.scores
order by game_id, player_name, score desc, created_at asc;
```

RLS: habilitada en `scores`. Políticas `select` e `insert` para `anon` y `authenticated`. Sin políticas de `update` ni `delete`.

Tipos TypeScript (`lib/scores.ts`):

```ts
export interface LeaderboardRow {
  rank: number; // 1..N, calculado en cliente tras ordenar
  name: string; // player_name
  score: number;
  date: string; // "DD/MM/YYYY" desde created_at
}

export async function submitScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<{ ok: true } | { ok: false; message: string }>;

export async function fetchLeaderboard(
  gameId: string,
  limit?: number, // por defecto 12
): Promise<LeaderboardRow[]>; // lanza Error con mensaje legible si falla
```

Convenciones:

- `game_id` usa los mismos ids de `GAMES` en `lib/data.ts`.
- `player_name` se guarda en mayúsculas, máx. 10 caracteres (igual que el input actual de `GamePlayer`).
- Desempate del ranking: mismo puntaje → gana el más antiguo.
- Fecha mostrada en formato `DD/MM/YYYY` (como `seededScores`).
- Esta spec no usa la service role key.

---

## Implementation plan

Antes del paso 1: invocar `/frontend-design` para los estados vacío/error/carga del Salón. Leer en `node_modules/next/dist/docs/` lo relativo a Client Components con `useEffect` y `cacheComponents` (el Salón sigue siendo client component). Inspeccionar con `list_tables` que no exista ya una tabla `scores`.

1. **Migración.** Aplicar con `apply_migration` el SQL de `scores`, índice, vista `scores_best` y políticas RLS. Verificar: `list_tables` muestra `scores`; `get_advisors` (security) no reporta RLS desactivada ni vista `SECURITY DEFINER` en `scores_best`.
2. **Prueba SQL.** Con `execute_sql`: insertar una fila válida, rechazar `score = -1`, rechazar `player_name = ''` y `game_id = 'x'`, confirmar que `scores_best` devuelve la mayor por nombre. Borrar las filas de prueba. Verificar: los 3 rechazos fallan por CHECK.
3. **Capa de datos.** Crear `lib/scores.ts` con `submitScore` y `fetchLeaderboard` (consulta a `scores_best` filtrada por `game_id`, orden `score desc, created_at asc`, `limit`). Verificar: `npx tsc --noEmit` sin errores.
4. **Guardar desde GamePlayer.** En `components/game-player.tsx`, el botón GUARDAR PUNTUACIÓN llama `submitScore`; mientras guarda se deshabilita, al éxito se muestra `PUNTUACIÓN GUARDADA_`, al fallo un mensaje de error y el botón queda activo para reintentar. `saveScore` de `SessionProvider` se mantiene como respaldo local sin cambios. Verificar: terminar una partida de `rocas`, guardar, y ver la fila en Supabase con `execute_sql`.
5. **Salón con datos reales.** En `components/hall-of-fame.tsx`: reemplazar `seededScores` por `fetchLeaderboard(tab)` en `useEffect` con estados `loading | ready | error`; descartar respuestas obsoletas al cambiar de pestaña rápido. Quitar la fila "TU MEJOR MARCA", `youRank`, `youScore` y el uso de `useSession` si ya no hace falta. Verificar: el Salón muestra el puntaje guardado en el paso 4 bajo la pestaña ROCAS.
6. **Estados vacío, error y podio parcial.** Con 0 filas: texto `AÚN SIN CAMPEONES — SÉ EL PRIMERO` y botón JUGAR hacia `/juegos/{id}/jugar`. Con error: mensaje legible y botón REINTENTAR. Con menos de 3 filas: ocultar el podio y mostrar solo la tabla. Estado de carga: texto `CARGANDO SALÓN_`. Verificar: pestaña de un juego sin puntajes, y error simulado con la URL de Supabase inválida.
7. **Cierre.** `npm run build` y `npm run lint`. Confirmar que `lib/data.ts` (`seededScores`) sigue existiendo porque `app/juegos/[id]/page.tsx` lo usa.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] Existe la tabla `public.scores` con RLS habilitada y la vista `scores_best` con `security_invoker = true`.
- [ ] `get_advisors` (security) no reporta problemas nuevos sobre `scores` ni `scores_best`.
- [ ] Un `insert` con `score < 0`, `player_name` vacío o de más de 10 caracteres, o `game_id` fuera de los 8 ids es rechazado por la base.
- [ ] Un `update` y un `delete` sobre `scores` con la clave publishable son rechazados por RLS.
- [ ] Terminar una partida de `rocas` y pulsar GUARDAR PUNTUACIÓN crea una fila con `game_id = 'rocas'`, el nombre en mayúsculas y el puntaje final del modal.
- [ ] Guardar un puntaje en cualquiera de los 7 juegos simulados también crea su fila en `scores`.
- [ ] Si el insert falla, el modal muestra un mensaje de error y permite reintentar; no muestra `PUNTUACIÓN GUARDADA_`.
- [ ] El botón GUARDAR PUNTUACIÓN no permite dobles inserts (se deshabilita mientras guarda y tras guardar).
- [ ] El Salón muestra el puntaje guardado en la pestaña del juego correspondiente tras recargar `/salon`.
- [ ] Si el mismo nombre guarda dos puntajes en un juego, aparece una sola vez con el mayor.
- [ ] El ranking se ordena de mayor a menor puntaje; con empate, el más antiguo va primero.
- [ ] Con 3 o más filas se ve el podio (02 / 01 CAMPEÓN / 03) con los datos reales; con menos de 3 se oculta.
- [ ] Una pestaña sin puntajes muestra `AÚN SIN CAMPEONES — SÉ EL PRIMERO` y un botón que lleva a `/juegos/{id}/jugar`.
- [ ] Con la URL de Supabase inválida el Salón muestra un error legible y el botón REINTENTAR; no se rompe la página.
- [ ] Cambiar de pestaña rápido no deja datos de la pestaña anterior en pantalla.
- [ ] La fila "TU MEJOR MARCA" y los valores inventados ya no aparecen en `/salon`.
- [ ] `app/juegos/[id]/page.tsx` y `lib/data.ts` no cambiaron.
- [ ] Sin errores en consola ni warnings de hydration en `/salon` y `/juegos/rocas/jugar`.
- [ ] No se usa la service role key en ningún archivo ni en `.next/static`.

---

## Decisiones

- **Sí:** Supabase como fuente de verdad. Es lo único que da un ranking compartido; SPEC 05 ya lo marcó como spec aparte basada en SPEC 04.
- **No:** leer `av_scores` en el Salón. Solo mostraría partidas propias, sin ranking global.
- **No:** híbrido con fallback a localStorage. Mezcla fuentes y oculta errores reales.
- **Sí:** nombre libre sin Auth. Pedido del usuario; Auth es una spec mayor y toca `av_user`.
- **No:** Supabase Auth ni `user_id` en `scores`. Fuera de alcance; el campo se añadiría luego con migración.
- **Sí:** las 8 pestañas leen datos reales. Elegido por el usuario; los simulados también guardan su puntaje.
- **No:** mock de relleno con `seededScores`. Mezclar datos falsos con reales engaña al jugador.
- **Sí:** mejor marca por nombre vía vista `scores_best`. Evita que un jugador llene el top; guarda todas las partidas para análisis futuro.
- **No:** una fila por partida en el ranking. Un nombre repetido monopoliza el podio.
- **Sí:** quitar la fila "TU MEJOR MARCA". Sin Auth no hay identidad fiable y el valor actual es inventado.
- **Sí:** `security_invoker = true` en la vista. Respeta RLS de `scores` y evita la advertencia de vistas `SECURITY DEFINER`.
- **Sí:** RLS solo `select` + `insert` y CHECKs. Protección mínima sin Auth; el anti-trampa real va en otra spec. El riesgo se acepta explícitamente.
- **No:** Server Action con rate limit. Más código y sigue sin ser anti-trampa real.
- **Sí:** `saveScore` local queda como está. No se rompe nada de SPEC 01; se retira cuando haya spec de Auth.
- **Sí:** `game_id` restringido por CHECK a los 8 ids actuales. Impide basura; agregar un juego exige migración (aceptado).
- **No:** tocar la ficha `/juegos/[id]`. No elegido por el usuario; queda con mock.

---

## Riesgos

| Riesgo                                                                         | Mitigación                                                                             |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Cualquiera puede insertar puntajes falsos con la clave publishable             | Aceptado y documentado; CHECKs acotan el daño; anti-trampa en spec futura              |
| Nombres ofensivos o suplantación (nombre libre)                                | Sin moderación en esta spec; se podrá borrar filas manualmente desde Supabase          |
| Vista creada como `SECURITY DEFINER` por defecto expondría datos saltando RLS  | `with (security_invoker = true)` y revisar `get_advisors` tras la migración            |
| Agregar un juego nuevo falla en el insert por el CHECK de `game_id`            | Migración que amplía el CHECK al sumar el juego; anotado en las decisiones             |
| Respuestas fuera de orden al cambiar de pestaña muestran el ranking equivocado | Ignorar la respuesta si la pestaña activa ya cambió (flag de cancelación en el efecto) |
| Supabase caído o sin red deja el Salón vacío                                   | Estado de error con REINTENTAR; no se rellena con datos mock                           |
| Las filas de prueba de los pasos 1–2 contaminan el ranking real                | Borrarlas con `execute_sql` al terminar cada prueba                                    |
| `GamePlayer` guarda el puntaje simulado de los otros 7 juegos, sin valor real  | Aceptado: se mantiene el flujo actual; cada juego tendrá su puntaje real al portarse   |

---

## Qué **no** está en esta spec

- Supabase Auth, `user_id`, sesión anónima.
- Anti-trampa, rate limit, moderación de nombres.
- Fila "TU MEJOR MARCA" (real o inventada).
- Ranking en la ficha `/juegos/[id]`.
- Migración de `av_scores` existentes.
- Paginación, filtros, Realtime.
- Port de los otros 7 juegos.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
