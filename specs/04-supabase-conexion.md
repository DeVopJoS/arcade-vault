# SPEC 04 — Conexión a Supabase (clientes browser y server)

> **Status:** Aprobado
> **Depends on:** SPEC 03 (convención de variables de entorno y `.env.template`)
> **Date:** 2026-11-19
> **Objective:** Instalar el SDK de Supabase y dejar configurados un cliente de navegador y uno de servidor (con variables de entorno) verificados mediante una página `/supabase-test`, sin tablas, migraciones, auth ni cambios en los datos mock.

---

## Por qué existe esta spec

El proyecto ya tiene proyecto Supabase vinculado vía `.mcp.json` (`project_ref=vkggthpkiefqvpcnzxah`) pero la app no tiene el SDK ni clientes. Esta spec establece solo la **conexión**; auth, tablas y migración de datos mock van en specs posteriores y partirán de estos clientes.

---

## Scope

**In:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- `lib/supabase/client.ts`: cliente de navegador (`createBrowserClient`).
- `lib/supabase/server.ts`: cliente de servidor (`createServerClient` con cookies de Next).
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`; claves vacías documentadas en `.env.template`.
- Página `/supabase-test` (`app/supabase-test/page.tsx`) que muestra si la conexión desde servidor y desde navegador responde.
- Textos de la página en español.

**Out of scope (para futuras specs):**

- Tablas, migraciones, RLS, `supabase/` CLI, tipos generados.
- Supabase Auth (reemplazo de `av_user`), `proxy.ts` de refresco de sesión, OAuth, invitado anónimo.
- Migrar `GAMES`, `seededScores` o `av_scores` a Supabase; `lib/data.ts` no se toca.
- Mensajes de contacto en base de datos (SPEC 03 sigue con Resend).
- Service role key / operaciones privilegiadas.
- Tests automatizados.
- Enlace a `/supabase-test` desde `Nav` o footer.

---

## Data model

Esta feature no introduce datos nuevos.

Variables de entorno (`.env.local`, ignorado por `.gitignore`):

```
NEXT_PUBLIC_SUPABASE_URL=              # obligatoria: https://vkggthpkiefqvpcnzxah.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # obligatoria: publishable key del proyecto
```

Firmas esperadas:

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient; // browser

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>; // server, usa cookies()
```

Convenciones:

- Ambas claves son públicas por diseño (`NEXT_PUBLIC_`); la seguridad real vendrá de RLS en specs futuras. Nunca se usa la service role key.
- Si falta una variable, el cliente lanza un error explícito con el nombre de la variable.
- `.env.local` ya existe con variables de Resend: añadir las nuevas sin tocar las existentes.

---

## Implementation plan

Antes del paso 1: leer en `node_modules/next/dist/docs/` lo relativo a `cookies()`, `cacheComponents`/Suspense con datos dinámicos y variables de entorno. Revisar la guía actual de Supabase para Next.js con `@supabase/ssr` (MCP `search_docs`) y obtener URL y publishable key con `get_project_url` y `get_publishable_keys`.

1. **Dependencias.** `npm i @supabase/supabase-js @supabase/ssr`. Verificar: `npm run build` sin errores.
2. **Entorno.** Añadir las 2 claves a `.env.template` (vacías, con comentario "SPEC 04") y los valores reales a `.env.local`. Verificar: `.env.template` trackeado, `.env.local` no.
3. **Cliente browser.** Crear `lib/supabase/client.ts`. Verificar: `npx tsc --noEmit` sin errores.
4. **Cliente server.** Crear `lib/supabase/server.ts` con `cookies()` de `next/headers` (`getAll`/`setAll`, `setAll` en `try/catch` por Server Components). Verificar: `tsc` sin errores.
5. **Página de prueba.** Crear `app/supabase-test/page.tsx`: server component con `<Suspense>` (por `cacheComponents`) que usa el cliente server para comprobar conectividad, más un componente client pequeño que hace lo mismo con el cliente browser. Cada lado muestra `CONEXIÓN OK` o `ERROR: {mensaje}`. La comprobación es una llamada que no requiere tablas (p. ej. `auth.getSession()`/`auth.getUser()` o `fetch` a `/auth/v1/health` con la key); definir la exacta tras leer la doc. Verificar: `/supabase-test` muestra ambos OK.
6. **Cierre.** `npm run build` y `npm run lint`. Verificar que ninguna clave secreta aparece en `.next/static`.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr`.
- [ ] Existen `lib/supabase/client.ts` y `lib/supabase/server.ts`, y exportan `createClient`.
- [ ] `/supabase-test` muestra `CONEXIÓN OK` para servidor y para navegador, sin errores en consola ni warnings de hydration.
- [ ] Con `NEXT_PUBLIC_SUPABASE_URL` vacía, la página muestra un error legible con el nombre de la variable en lugar de romper la app.
- [ ] `.env.template` contiene las 2 claves vacías y está trackeado; `.env.local` no está trackeado por git.
- [ ] No se creó ninguna tabla, migración ni carpeta `supabase/`.
- [ ] `lib/data.ts`, `Nav` y el formulario de SPEC 03 no cambiaron.
- [ ] Las rutas existentes (`/`, `/juegos/caida`, `/auth`, `/salon`, `/acerca`) siguen respondiendo.

---

## Decisiones

- **Sí:** solo conexión. Pedido explícito del usuario; auth y datos son specs aparte.
- **No:** tablas, migraciones, RLS, auth. Descartado por el usuario.
- **Sí:** `@supabase/ssr` con cliente browser y server. Es el patrón oficial para App Router y servirá de base para auth.
- **No:** `proxy.ts`. Solo sirve para refrescar sesión de Auth, que está fuera de alcance.
- **Sí:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nombre vigente de Supabase; evita la anon key legacy.
- **No:** service role key. Sería secreto con privilegios totales y no hace falta para conectar.
- **Sí:** página `/supabase-test` como verificación. Elegida por el usuario; visible y sin necesitar tablas.
- **Sí:** `lib/supabase/` separada de `lib/data.ts`. No se mezcla con los datos mock.
- **Sí:** `.env.template` con claves vacías, igual que SPEC 03.

---

## Riesgos

| Riesgo                                                        | Mitigación                                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `cacheComponents` exige Suspense al usar `cookies()`          | Leer docs locales; envolver el componente server de la página en `<Suspense>`          |
| `/supabase-test` queda como ruta pública en producción        | Sin link en la UI y sin datos sensibles; eliminarla o protegerla en una spec posterior |
| Sin tablas, la prueba de conexión es débil                    | Usar llamada de auth/health que sí valida URL + key contra el proyecto                 |
| API de `@supabase/ssr` cambió respecto al conocimiento previo | Consultar doc actual vía `search_docs` antes de codificar                              |
| Clave publishable mal copiada                                 | `get_publishable_keys` del MCP como fuente; error legible en la página                 |

---

## Qué **no** está en esta spec

- Tablas, migraciones, RLS, tipos generados.
- Supabase Auth, OAuth, sesión anónima, `proxy.ts`.
- Migración de `GAMES`, puntajes o mensajes de contacto.
- Service role key.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
