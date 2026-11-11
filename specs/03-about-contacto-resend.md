# SPEC 03 — Página "Acerca de" en `/acerca` con formulario de contacto vía Resend

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-10
> **Objective:** Portar `about.jsx` de `references/templates/home-about/` a `/acerca` y hacer que su formulario de contacto envíe un correo real con Resend mediante una Server Action.

---

## Por qué existe esta spec

SPEC 02 omitió "Acerca de" por pedido explícito. Ahora se incorpora, y el formulario de contacto, que en la plantilla solo simula el envío, debe entregar correos reales. Eso añade el primer código de servidor y la primera dependencia externa del proyecto, por eso lleva decisiones de seguridad (validación, rate limit, secretos).

---

## Scope

**In:**

- Nueva página `/acerca` (`app/acerca/page.tsx`) idéntica a `about.jsx`: hero "ACERCA DE ARCADE VAULT", 3 highlights con iconos pixel (`HighlightIcon`), divisor animado y sección "CONTÁCTANOS" con terminal de éxito.
- Link "Acerca de" en `Nav` (desktop y panel móvil), último en el orden: Inicio · Biblioteca · Salón de la Fama · Acerca de. Activo si `pathname.startsWith("/acerca")`.
- CSS de las secciones About/Contact de `references/templates/home-about/styles.css` añadido a `app/globals.css` (sin duplicar clases existentes).
- Efecto `reveal` (IntersectionObserver) reutilizado de SPEC 02 si existe como hook; si no, extraído a un hook compartido.
- Server Action `sendContactMessage` en `app/acerca/actions.ts` que envía el correo con el SDK `resend`.
- Validación en servidor (nombre, correo, mensaje), `reply_to` = correo del visitante, asunto con el nombre.
- Rate limit en memoria: 3 envíos por hora por IP.
- Errores en UI: mensaje rojo inline sobre el botón + `shake`, conservando lo escrito.
- Textos en español idénticos a la plantilla.

**Out of scope (para futuras specs):**

- Correo de confirmación al visitante.
- Honeypot / CAPTCHA.
- Rate limit persistente o compartido entre instancias (Upstash/Redis).
- Guardar mensajes en base de datos o panel de administración.
- Plantilla HTML de correo con React Email (el cuerpo es texto plano).
- Dominio propio verificado en Resend (se configura por variables de entorno).
- Tests automatizados, i18n, Tailwind.

---

## Data model

```ts
// app/acerca/actions.ts
export interface ContactInput { name: string; email: string; msg: string }

export type ContactResult =
  | { ok: true; name: string }
  | { ok: false; error: "invalid" | "rate_limited" | "send_failed" };
```

Variables de entorno (`.env.local`, ya ignorado por `.gitignore` vía `.env*`):

```
RESEND_API_KEY=        # obligatoria
CONTACT_TO_EMAIL=      # obligatoria: destinatario del equipo
RESEND_FROM_EMAIL=     # opcional, default "Arcade Vault <onboarding@resend.dev>"
```

Rate limit (módulo `lib/rate-limit.ts`): `Map<string, number[]>` de timestamps por IP; ventana 1 h, máximo 3.

Convenciones:

- Validación servidor: `name` 1–60 chars, `email` con regex simple y máx. 120, `msg` 1–2000 chars; todo tras `trim()`.
- Mensajes de error UI (español): `invalid` → `REVISA LOS CAMPOS E INTENTA DE NUEVO`; `rate_limited` → `DEMASIADOS ENVÍOS, INTENTA MÁS TARDE`; `send_failed` → `NO SE PUDO ENVIAR, INTENTA MÁS TARDE`.
- IP desde `x-forwarded-for` (primer valor) con fallback `"unknown"`.
- El nombre/mensaje se insertan como texto plano; nunca se interpolan en HTML.

---

## Implementation plan

Antes del paso 1: leer en `node_modules/next/dist/docs/` lo relativo a Server Actions, `headers()` y `cacheComponents`. Revisar la doc actual del SDK `resend` (`emails.send`, retorno `{ data, error }`).

1. **Link y página estática.** Añadir "Acerca de" a `components/nav.tsx` (desktop + móvil). Crear `app/acerca/page.tsx` que renderiza `<About />`. Verificar: `/acerca` carga y el link se activa.
2. **CSS.** Copiar a `app/globals.css` los bloques About/Contact de la plantilla (`.about-*`, `.highlight*`, `.contact-*`, `.tip*`, `.terminal-success`, `.term-*`, `.shake`, etc.). Verificar que `.shake`, `.caret` y animaciones del divisor se aplican con el loader de Tailwind.
3. **Componente About.** Crear `components/about.tsx` (client) con `About`, `HighlightIcon`, reveal y el formulario aún simulado como en la plantilla (`sent` tras validar campos). Verificar: layout idéntico a la plantilla, terminal de éxito y "ENVIAR OTRO MENSAJE".
4. **Rate limit.** Crear `lib/rate-limit.ts` con `checkRateLimit(key): boolean` (limpia timestamps vencidos de la clave en cada llamada).
5. **Dependencia y entorno.** `npm i resend`. Crear `.env.local` con las 3 variables (valores reales los pone el usuario). Añadir `.env.example` con las claves vacías (no ignorado: `.gitignore` debe excluirlo con `!.env.example`).
6. **Server Action.** Crear `app/acerca/actions.ts` (`"use server"`) con `sendContactMessage(input)`: valida → comprueba rate limit → `resend.emails.send({ from, to, replyTo, subject: "[Arcade Vault] Mensaje de {name}", text })` → devuelve `ContactResult`. Si falta `RESEND_API_KEY` o `CONTACT_TO_EMAIL` devuelve `send_failed` y registra el error en consola del servidor.
7. **Conectar formulario.** En `components/about.tsx` reemplazar el envío simulado por la llamada a la action con estado `pending` (botón deshabilitado, texto `ENVIANDO…`). Éxito → terminal con `{name}`; error → mensaje inline rojo + `shake`, datos conservados. Mantener el `shake` actual para campos vacíos en cliente.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `/acerca` renderiza hero, 3 highlights, divisor y formulario, sin errores en consola ni warnings de hydration.
- [ ] El header muestra en orden: Inicio, Biblioteca, Salón de la Fama, Acerca de; el panel móvil (≤840 px) también.
- [ ] "Acerca de" está activo solo en `/acerca`; "Inicio" y los demás no.
- [ ] Las secciones `.reveal` pasan de opacidad 0 a 1 al hacer scroll.
- [ ] Enviar con algún campo vacío activa el shake y no llama a la action.
- [ ] Un envío válido entrega un correo al `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Mensaje de {name}`, cuerpo con nombre, correo y mensaje, y `reply-to` igual al correo del visitante (verificable en el dashboard de Resend o en la bandeja).
- [ ] Tras el envío válido se muestra la terminal con `MENSAJE RECIBIDO… GRACIAS, {NOMBRE EN MAYÚSCULAS}.`; "ENVIAR OTRO MENSAJE" vuelve al formulario vacío.
- [ ] Durante el envío el botón está deshabilitado y dice `ENVIANDO…`.
- [ ] Con `RESEND_API_KEY` inválida se muestra `NO SE PUDO ENVIAR, INTENTA MÁS TARDE` sobre el botón y los campos conservan lo escrito.
- [ ] El 4.º envío válido desde la misma IP en una hora muestra `DEMASIADOS ENVÍOS, INTENTA MÁS TARDE` y no llama a Resend.
- [ ] Llamar la action con `email` inválido o `msg` >2000 chars devuelve `{ ok: false, error: "invalid" }` sin llamar a Resend.
- [ ] `RESEND_API_KEY` no aparece en el bundle del cliente (`grep` en `.next/static` sin resultados).
- [ ] `.env.local` no está trackeado por git y `.env.example` sí.

---

## Decisiones

- **Sí:** ruta `/acerca`. Coherente con `/juegos` y `/salon` (español).
- **No:** `/about`. Rutas en inglés inconsistentes con el resto.
- **Sí:** Server Action. Sin endpoint público adicional, secretos solo en servidor, idiomático en Next 16.
- **No:** Route Handler `/api/contacto`. Más código para el mismo resultado; revisitar si otro cliente (móvil) necesita el endpoint.
- **Sí:** destinatario y remitente por variables de entorno. Cambian entre dev y producción; nada sensible en el repo.
- **Sí:** default `onboarding@resend.dev` como remitente. Funciona sin dominio verificado (solo entrega al dueño de la cuenta Resend); en producción se cambia a dominio propio.
- **Sí:** validación en servidor + `reply_to`. El cliente no es de fiar; permite responder directo al visitante.
- **Sí:** rate limit en memoria, 3/hora por IP. Protege la cuota de Resend sin dependencias; es best-effort (se reinicia con el servidor y no se comparte entre instancias serverless).
- **No:** Upstash/Redis. Servicio y variables extra desproporcionados para el MVP.
- **No:** honeypot ni correo de confirmación. Descartados por el usuario.
- **Sí:** errores como mensaje inline rojo + shake. Mantiene el diseño de la plantilla y los datos escritos.
- **No:** terminal con `[ERROR]`. Extiende la plantilla más allá de lo pedido.
- **Sí:** cuerpo del correo en texto plano. Evita inyección HTML y la dependencia de React Email.
- **Sí:** CSS global fiel a la plantilla. Mismo criterio que SPEC 01 y 02.
- **Sí:** componente client único `components/about.tsx`. Formulario con estado y reveal lo requieren.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Rate limit en memoria no funciona entre instancias serverless | Aceptado para MVP; documentado como limitación; spec futura con Redis |
| IP spoofeable vía `x-forwarded-for` fuera de un proxy confiable | Aceptado; usar el valor que inyecta la plataforma de despliegue |
| Remitente `onboarding@resend.dev` solo entrega al correo dueño de la cuenta | `CONTACT_TO_EMAIL` debe ser ese correo en desarrollo; dominio propio antes de producción |
| API key ausente o inválida rompe el formulario | La action captura el error, devuelve `send_failed` y registra en servidor |
| `cacheComponents` altera el acceso a `headers()` | Leer docs locales antes de codificar; `headers()` solo dentro de la action |
| Conflicto de clases CSS (`.btn`, `.field`, `.kicker`) con las ya existentes | Verificar en paso 2 antes de copiar; no duplicar reglas |
| Spam con IPs distintas | Fuera de alcance; honeypot/CAPTCHA en otra spec si hace falta |

---

## Qué **no** está en esta spec

- Correo de confirmación al visitante.
- Honeypot o CAPTCHA.
- Rate limit persistente (Redis/Upstash).
- Almacenamiento de mensajes o panel admin.
- Plantillas HTML de correo.
- Dominio propio verificado en Resend.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
