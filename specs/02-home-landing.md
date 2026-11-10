# SPEC 02 — Página de inicio (landing) en `/` y Biblioteca movida a `/juegos`

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-11-10
> **Objective:** Portar la landing de `references/templates/home-about/` (sin "Acerca de") a `/`, mover la Biblioteca a `/juegos` y añadir "Inicio" al header.

---

## Por qué existe esta spec

La plantilla `references/templates/home-about/` agrega una landing (`home.jsx`) y una página "Acerca de" (`about.jsx`) sobre las 5 pantallas de SPEC 01. Hoy `/` es la Biblioteca. Para que la landing sea la raíz, la Biblioteca pasa a `/juegos`, lo que obliga a actualizar los links internos que apuntaban a `/`.

---

## Scope

**In:**

- Nueva página `/` (`app/page.tsx`) con la landing: hero con siluetas flotantes, "¿POR QUÉ ARCADE VAULT?", "JUEGOS DISPONIBLES AHORA", stats, "ACTIVIDAD EN VIVO", "PRECIOS" con FAQ y CTA final.
- Biblioteca (componente `Library` existente) movida a `app/juegos/page.tsx` → ruta `/juegos`.
- Link "Inicio" en el `Nav` (desktop y panel móvil), primero en el orden: Inicio · Biblioteca · Salón de la Fama.
- Actualizar links internos que apuntaban a `/` como "Biblioteca" para que apunten a `/juegos`.
- CSS de la sección `/* ===== HOME PAGE ===== */` de `references/templates/home-about/styles.css` agregado a `app/globals.css`.
- Efecto `reveal` (IntersectionObserver) en componente client.
- Textos en español idénticos a la plantilla; datos de actividad, top, stats y FAQ hardcodeados como en la plantilla.

**Out of scope (para futuras specs):**

- Página "Acerca de" (`about.jsx`) y su link en el header: omitidos por pedido explícito.
- Datos reales o derivados de `av_scores` en "Actividad en vivo" / "Top jugadores".
- Cambiar los CTAs según haya sesión o no.
- Cualquier cambio en las demás pantallas más allá de actualizar links.
- Tests automatizados, i18n, Tailwind.

---

## Data model

Esta feature no introduce estructuras de datos globales nuevas. Reutiliza `GAMES` de `lib/data.ts` (SPEC 01) para el mini-rail (`GAMES.slice(0, 6)`).

Datos estáticos locales a `components/home.tsx` (arrays `as const`, tal cual la plantilla): 4 features, 3 stats, 7 filas de últimas puntuaciones, 5 filas de top jugadores, 3 ítems de FAQ, 6 ítems del plan.

Convenciones:

- Números con `toLocaleString("es-ES")`.
- Anchos de las barras del top: `100 - i * 16` %.

---

## Implementation plan

Antes del paso 1: releer en `node_modules/next/dist/docs/` lo relevante a rutas y `Link`/`useRouter`.

1. **Mover Biblioteca.** Crear `app/juegos/page.tsx` que renderiza `<Library />`. Verificar: `/juegos` muestra la Biblioteca igual que antes `/`.
2. **Actualizar links a Biblioteca.** Cambiar `"/"` → `"/juegos"` en:
   - `components/game-player.tsx` (VOLVER AL VAULT).
   - `components/hall-of-fame.tsx` (link al vault).
   - `app/juegos/[id]/page.tsx` (botón volver).
   - `app/juegos/[id]/not-found.tsx`.

   Los redirects de `components/auth-form.tsx` quedan en `/` (ver Decisiones).
3. **Header.** En `components/nav.tsx`: añadir link "Inicio" (`/`) en desktop y panel móvil; "Biblioteca" apunta a `/juegos`. `activeInicio = pathname === "/"`; `activeBiblioteca = pathname.startsWith("/juegos")`. El logo sigue apuntando a `/`.
4. **CSS.** Copiar el bloque `HOME PAGE` de la plantilla a `app/globals.css` (final del archivo). Verificar que `.reveal`, `.mini-card`, `.activity-grid`, `.price-card` y keyframes `bounce`/`float` se aplican; ajustar si el loader de Tailwind los altera. No duplicar clases ya existentes (`.btn.xl`, `.pulse`, `.fade-in`).
5. **Landing estática.** Crear `components/home.tsx` (client, por `useReveal` y navegación) con las secciones de `home.jsx`, usando `Link` en lugar de `navigate()`. Incluye `FloatingSilhouettes`, `MiniCard`, `FeatureIcon` y `useReveal`. `app/page.tsx` renderiza `<Home />`.
6. **Metadata.** Sin cambios (el layout ya es Arcade Vault).

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `/` muestra la landing con las 6 secciones (hero, 01 Por qué, 02 Juegos, stats, 03 Actividad, 04 Precios) y el CTA final; sin errores en consola.
- [ ] `/juegos` muestra la Biblioteca con 8 tarjetas; el chip `PUZZLE` deja solo `CAÍDA`.
- [ ] El header muestra, en orden: Inicio, Biblioteca, Salón de la Fama; no existe "Acerca de" en ningún lugar de la UI.
- [ ] "Inicio" está activo solo en `/`; "Biblioteca" está activo en `/juegos` y `/juegos/[id]`.
- [ ] El panel móvil (≤840 px) incluye Inicio, Biblioteca, Salón y Cuenta/Iniciar Sesión.
- [ ] En la landing el mini-rail muestra 6 tarjetas (`GAMES.slice(0, 6)`); clic en una navega a `/juegos/[id]`.
- [ ] EXPLORAR JUEGOS, VER TODOS LOS JUEGOS e INSERTAR MONEDA navegan a `/juegos`.
- [ ] CREAR CUENTA y EMPEZAR GRATIS navegan a `/auth`; VER SALÓN navega a `/salon`.
- [ ] Las secciones con clase `reveal` aparecen al hacer scroll (pasan de opacidad 0 a 1).
- [ ] VOLVER AL VAULT (reproductor), el botón de volver del detalle, el link de not-found y el link del salón navegan a `/juegos`.
- [ ] Iniciar sesión o "Jugar como invitado" redirige a `/`.
- [ ] Ningún link interno apunta a `/` esperando la Biblioteca (`grep` de `href="/"` y `push("/")` solo devuelve Inicio/logo/auth).
- [ ] Sin warnings de hydration en `/` al recargar con sesión guardada.

---

## Decisiones

- **Sí:** Biblioteca en `/juegos`. Decisión del usuario; coherente con `/juegos/[id]`.
- **No:** Biblioteca en `/biblioteca` ni Inicio en `/inicio`. Descartadas por el usuario/recomendación: `/` debe ser la landing.
- **Sí:** orden del header Inicio · Biblioteca · Salón de la Fama. Igual que la plantilla sin "Acerca de" (valor por defecto recomendado, no discutido a fondo).
- **Sí:** datos de la landing hardcodeados con textos de la plantilla. Es contenido de marketing/mock; derivarlo de `lib/data.ts` se desvía de la plantilla (valor por defecto recomendado).
- **Sí:** CTAs siempre visibles, sin depender de sesión. Evita lógica extra no presente en la plantilla (valor por defecto recomendado).
- **Sí:** redirect tras login/invitado a `/` (Inicio). Es la raíz del sitio; el usuario puede pasar a Biblioteca desde el header.
- **No:** página "Acerca de" ni su link. Omitida por pedido explícito.
- **Sí:** `Link` de Next en lugar de `navigate()`. Rutas reales como en SPEC 01.
- **Sí:** CSS global fiel a la plantilla. Mismo criterio que SPEC 01.
- **Sí:** un único componente client `components/home.tsx`. El efecto `reveal` y los handlers lo requieren; evita dividir una página estática en muchos archivos.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Links viejos a `/` quedan mostrando la landing en lugar de la Biblioteca | Paso 2 + criterio de `grep` en aceptación |
| `.reveal` deja secciones invisibles si el observer falla o JS tarda | Aceptado para el MVP; verificar en paso 5 que se activan al scroll |
| Conflicto de clases CSS (`.btn.lg`, `.lb-link`, etc.) con las ya existentes en `globals.css` | Verificar en paso 4 antes de copiar; no duplicar reglas |
| `prefers-reduced-motion` no contemplado en `float`/`bounce`/`reveal` | Fuera de alcance; la plantilla tampoco lo trata |

---

## Qué **no** está en esta spec

- Página "Acerca de".
- Datos reales en actividad/top.
- CTAs dependientes de sesión.
- Cambios en juegos, auth o salón más allá de actualizar links.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
