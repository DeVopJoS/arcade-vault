# SPEC 01 — MVP visual de Arcade Vault (todas las pantallas)

> **Status:** Aprobado
> **Depends on:** ninguna
> **Date:** 2026-11-08
> **Objective:** Portar a Next.js las 5 pantallas de `references/templates/` (biblioteca, detalle, reproductor, auth, salón de la fama) con navegación real, datos mock y sesión simulada en localStorage, sin implementar ningún juego.

---

## Por qué existe esta spec

El repo solo tiene el scaffold de create-next-app. Las plantillas en `references/templates/` son un prototipo React-in-HTML (Babel, estado + hash, `window.*`). Hay que convertirlo en una app Next real que sirva de base visual para specs posteriores (juegos reales, backend, auth real).

El usuario mencionó "Airkit Bolt"; se confirmó que el nombre del producto en la UI es **Arcade Vault** (coincide con plantillas, repo y README).

---

## Scope

**In:**

- Layout global (`app/layout.tsx`) con `Nav` y footer compartidos, fuentes y tema oscuro neón fijo.
- Cinco pantallas con rutas reales:
  - `/` — Biblioteca (hero, búsqueda, chips de categoría, grid de tarjetas con tilt).
  - `/juegos/[id]` — Detalle (portada, tags, stats, leaderboard mock).
  - `/juegos/[id]/jugar` — Reproductor (HUD, marco CRT, arena decorativa, puntaje simulado con timer, pausa, FIN, modal de fin de juego con guardado de puntaje).
  - `/auth` — Iniciar sesión / Crear cuenta / Jugar como invitado (todo mock).
  - `/salon` — Salón de la Fama (tabs por juego, podio, tabla, "tu mejor marca" si hay sesión).
- Menú móvil (hamburguesa + panel) del `Nav`.
- Datos mock tipados en `lib/` (8 juegos, categorías, `seededScores`).
- Sesión simulada en localStorage (`av_user`) y guardado de puntajes (`av_scores`), como en la plantilla.
- `not-found` para `id` de juego inexistente.
- CSS global fiel a `references/templates/styles.css`; fuentes con `next/font/google`.
- Textos en español, idénticos a las plantillas.

**Out of scope (para futuras specs):**

- Cualquier juego real (lógica, canvas, input de teclado/táctil). La arena del reproductor es decorativa.
- Backend, base de datos, auth real (hash de contraseñas, OAuth Google/GitHub, validación). Los botones sociales son inertes.
- Leer `av_scores` para mostrarlos en leaderboard/salón: se guardan pero no se consumen.
- Tema claro / respeto de `prefers-color-scheme`.
- Reescritura a Tailwind de las clases de plantilla.
- Tests automatizados (no hay runner configurado).
- Contador de créditos funcional (queda fijo en `03`, como en la plantilla).
- i18n.

---

## Data model

```ts
// lib/data.ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type CoverClass =
  | "cover-bricks" | "cover-tetro" | "cover-snake" | "cover-glot"
  | "cover-invaders" | "cover-rocas" | "cover-rana" | "cover-duelo";
export type NeonColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;        // slug: "bloque-buster", "caida", ...
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: CoverClass; // clase CSS definida en styles.css
  color: NeonColor;
  best: number;
  plays: string;     // ya formateado, ej. "12.4K"
}

export const GAMES: Game[];                 // los 8 de data.jsx, sin cambios
export const CATS: ("TODOS" | Category)[];  // ["TODOS","ARCADE","PUZZLE","SHOOTER","VERSUS"]

export interface ScoreRow { rank: number; name: string; score: number; date: string } // date "DD/MM/2026"
export function seededScores(seed: number, count?: number): ScoreRow[]; // misma lógica determinista
```

```ts
// Sesión (components/session-provider.tsx, client)
export interface User { name: string }      // mayúsculas, máx. 10 chars
// localStorage "av_user": JSON de User; ausente = invitado
// localStorage "av_scores": JSON de SavedScore[]
export interface SavedScore { game: string; score: number; name: string; at: number }
```

Convenciones:

- Números con `toLocaleString("es-ES")`.
- `seededScores` debe dar los mismos resultados que la plantilla para la misma semilla (detalle usa `id.length*17+3`, salón usa `tab.length*23+7`).
- Lecturas de localStorage siempre dentro de `try/catch`.

---

## Implementation plan

Antes del paso 1: leer las guías relevantes de `node_modules/next/dist/docs/` (layouts, fuentes, `params` asíncronos, `cacheComponents`, `generateStaticParams`, `not-found`).

1. **Base visual.** Copiar `references/templates/styles.css` a `app/globals.css` (conservando `@import "tailwindcss"`), quitar el bloque `prefers-color-scheme` del scaffold. Cargar Press Start 2P, JetBrains Mono y Courier Prime con `next/font/google` en `app/layout.tsx` y mapearlas a `--pixel` / `--mono`. Verificar: `npm run dev` muestra fondo oscuro y fuente mono en `/`.
2. **Datos.** Crear `lib/data.ts` con `GAMES`, `CATS`, `PLAYERS` y `seededScores` tipados. Verificar: `npm run lint` y `tsc` sin errores.
3. **Sesión.** Crear `components/session-provider.tsx` (client) con contexto `{ user, login, signOut, saveScore }`. Hidratar desde `av_user` en `useEffect` para evitar mismatch SSR. Montarlo en `app/layout.tsx`.
4. **Shell.** Crear `components/nav.tsx` (client: menú móvil, sesión, link activo según `usePathname`) y footer en el layout. Verificar: nav y footer visibles en `/`; hamburguesa abre/cierra panel a ≤840px.
5. **Biblioteca.** Crear `components/game-card.tsx` (client, tilt) y `components/library.tsx` (client, búsqueda + chips). `app/page.tsx` los renderiza. Click en tarjeta o JUGAR navega a `/juegos/[id]`.
6. **Detalle.** Crear `app/juegos/[id]/page.tsx` (server, `params` asíncrono, `generateStaticParams`) y `app/juegos/[id]/not-found.tsx`. `notFound()` si el id no existe. Botones → `/juegos/[id]/jugar` y `/`.
7. **Auth.** Crear `components/auth-form.tsx` (client) y `app/auth/page.tsx`. Submit → `login({name})` + redirect a `/`. "Jugar como invitado" → `signOut()` + redirect a `/`.
8. **Salón.** Crear `components/hall-of-fame.tsx` (client, tabs) y `app/salon/page.tsx`. Podio, tabla y fila "tu mejor marca" solo con sesión.
9. **Reproductor.** Crear `components/game-player.tsx` (client) y `app/juegos/[id]/jugar/page.tsx`. HUD, CRT, arena decorativa, timer de puntaje, pausa, FIN, modal con guardado vía `saveScore`, JUGAR DE NUEVO, VOLVER AL VAULT.
10. **Metadata.** Actualizar `title`/`description` del layout a Arcade Vault en español.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] Las rutas `/`, `/juegos/caida`, `/juegos/caida/jugar`, `/auth`, `/salon` responden y renderizan sin errores en consola.
- [ ] `/juegos/no-existe` y `/juegos/no-existe/jugar` muestran la página not-found.
- [ ] `/` lista 8 tarjetas; el chip `PUZZLE` deja solo `CAÍDA`; buscar `zzz` muestra "NO HAY RESULTADOS".
- [ ] Click en una tarjeta navega a `/juegos/[id]` de ese juego.
- [ ] El detalle muestra título, descripción larga, tags, 3 stats y 10 filas de leaderboard.
- [ ] En el reproductor el puntaje sube cada ~220 ms; PAUSA lo detiene y muestra "EN PAUSA"; REANUDAR lo reanuda.
- [ ] FIN abre el modal con la puntuación final; GUARDAR PUNTUACIÓN muestra "PUNTUACIÓN GUARDADA_" y añade una entrada a `localStorage["av_scores"]`.
- [ ] JUGAR DE NUEVO reinicia puntaje a 0; VOLVER AL VAULT navega a `/`; SALIR navega al detalle del juego.
- [ ] Iniciar sesión con usuario `px_kai` guarda `{"name":"PX_KAI"}` en `av_user`, redirige a `/` y el nav muestra `PX_KAI ▾`.
- [ ] Con usuario vacío el nombre es `PLAYER1`.
- [ ] Recargar la página conserva la sesión; clic en `PX_KAI ▾` la cierra y el nav vuelve a "Iniciar Sesión".
- [ ] "Jugar como invitado" redirige a `/` sin usuario.
- [ ] La pestaña "Crear cuenta" muestra el campo de correo; "Iniciar sesión" lo oculta.
- [ ] `/salon` muestra podio top 3 y 12 filas; cambiar de tab cambia los datos; con sesión aparece "TU MEJOR MARCA EN {JUEGO}"; sin sesión no.
- [ ] A ≤840 px aparece la hamburguesa y el panel lateral navega a Biblioteca, Salón y Auth.
- [ ] Ningún texto de la UI dice "Airkit Bolt".
- [ ] Sin warnings de hydration al recargar con sesión guardada.

---

## Decisiones

- **Sí:** nombre Arcade Vault. Coincide con plantillas y repo; "Airkit Bolt" se trató como error.
- **Sí:** rutas reales de App Router. Idiomático, URLs compartibles; el hash JSON de la plantilla no escala.
- **No:** SPA con hash. Copia fiel pero descarta las ventajas de Next.
- **Sí:** reproductor como réplica de plantilla con puntaje simulado. Valida el flujo completo (HUD → fin → guardar) antes de tener juegos reales.
- **Sí:** mock en localStorage con claves `av_user` y `av_scores`, idénticas a la plantilla. Facilita reemplazarlo por backend después.
- **No:** leer `av_scores` en leaderboard/salón. La plantilla no lo hace; mezclar datos reales con seeded requiere definir reglas de ranking (otra spec).
- **Sí:** CSS global fiel. Máxima fidelidad visual con mínimo riesgo; el CSS usa muchas animaciones y clases compuestas.
- **No:** reescritura a Tailwind. Costo alto, riesgo de desvío visual, sin beneficio para el MVP.
- **Sí:** `next/font/google`. Self-host, sin request externo en runtime.
- **Sí:** solo tema oscuro. La plantilla no define tema claro.
- **Sí:** server components por defecto; `'use client'` solo en Nav, SessionProvider, Library, GameCard, AuthForm, HallOfFame, GamePlayer.
- **Sí:** `lib/data.ts` tipado en vez de `window.*`.
- **Sí:** contador de créditos estático (`03`). Sin mecánica de créditos definida.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Next 16 con `cacheComponents` cambia semántica de `params` y datos dinámicos | Leer docs locales antes de codificar; `params` asíncrono; páginas de detalle con `generateStaticParams` |
| Hydration mismatch al leer `av_user` en el primer render | Estado inicial `null` y lectura en `useEffect`; el nav pinta "Iniciar Sesión" hasta montar |
| localStorage bloqueado (modo privado) | `try/catch` en toda lectura/escritura; la app funciona sin persistir |
| `*.css` pasa por loader `@tailwindcss/turbopack` y puede chocar con CSS legacy de la plantilla | Verificar en paso 1 que keyframes y selectores se aplican; ajustar si Tailwind los toca |
| Timer del reproductor con `Math.random()` rompe SSR | Componente client; puntaje inicia en 0 y el timer arranca en `useEffect` |
| Level-up de la plantilla (`score % 2500 < 100`) es errático | Replicar tal cual; es simulación decorativa |

---

## Qué **no** está en esta spec

- Juegos jugables.
- Backend, auth real, OAuth.
- Ranking real con `av_scores`.
- Tema claro.
- Tailwind para las pantallas.
- Tests automatizados.
- Créditos funcionales.

Cada uno, si se hace, va en su propia spec.
