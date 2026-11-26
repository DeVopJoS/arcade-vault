# SPEC 10 — Gamepad móvil bajo la pantalla y footer de controles en el reproductor

> **Status:** Aprobado
> **Depends on:** SPEC 01 (`GamePlayer`, `Nav`), SPEC 05 (Rocas), SPEC 07 (Caída + registro `lib/games/registry.ts`), SPEC 08 (Bloque Buster), SPEC 09 (Serpentina). Sistema de skins ya integrado en `main` (PR #17, sin spec numerada).
> **Date:** 2026-11-26
> **Objective:** En dispositivos táctiles, sacar los botones superpuestos del canvas y reemplazarlos por un gamepad genérico (D-pad + A/B) debajo del CRT, con la fila PAUSA/FIN/SALIR/SKIN en un footer del reproductor y sin la nav global, sin cambiar nada en desktop.

---

## Por qué existe esta spec

Los 4 juegos implementados (`rocas`, `caida`, `bloque-buster`, `serpentina`; ver `references/implemented-games.md`) pintan sus botones táctiles **dentro** de `.crt-screen` (`.touch-controls` en cada `components/*-canvas.tsx`, CSS en `app/globals.css` bajo `@media (pointer: coarse)`). En móvil tapan parte del juego (piezas de Caída, ladrillos bajos de Bloque Buster, la serpiente en la esquina inferior derecha, etc.). Debajo del CRT hay espacio libre de sobra.

Además, en móvil la nav global y la fila de botones del HUD (`PAUSA/FIN/SALIR` + selector de skin) consumen el alto superior de la pantalla, empujando el CRT hacia abajo.

Estado real inspeccionado:

- `GameCanvasHandle` = `pause/resume/restart` (sin entrada de acciones). Cada wrapper tiene un `setInput(action, down)` interno que llama a `game.setInput`.
- Acciones por juego: `AsteroidsAction = left|right|thrust|fire`, `TetrisAction = left|right|down|rotate|drop`, `ArkanoidAction = left|right`, `SnakeAction = up|down|left|right` (Snake ignora `down=false`).
- `GameEntry` ya tiene `skins?` y `defaultSkin?`; `GamePlayer` guarda la skin en `localStorage` (`av-skin-${game.id}`) con `chooseSkin`.
- `Nav` (`components/nav.tsx`) es client component con `usePathname`; se monta en `app/layout.tsx`.
- Gestos sobre canvas existentes: swipe en Serpentina, arrastre en Bloque Buster.

Antes de escribir código Next: leer la guía relevante en `node_modules/next/dist/docs/` (AGENTS.md). Para el diseño visual del gamepad/footer usar `/frontend-design`.

---

## Scope

**In:**

- Componente genérico `components/gamepad.tsx`: D-pad (▲▼◀▶) a la izquierda + botones `A`/`B` a la derecha, estilo consola, coherente con la estética neón/CRT.
- Layout del gamepad declarado por juego en el registro (`GameEntry.gamepad`).
- `GameCanvasHandle.setInput(action: string, down: boolean)`; los 4 wrappers lo implementan reenviando a su motor (acciones desconocidas se ignoran).
- Eliminar `.touch-controls` (JSX en los 4 `*-canvas.tsx` y su CSS en `app/globals.css`).
- Vista de juego táctil (`@media (pointer: coarse)`) en `/juegos/[id]/jugar`, orden vertical:
  1. Stats compactas (Jugador, Puntuación, Vidas si aplica, Nivel).
  2. CRT.
  3. Gamepad (solo si el juego tiene `gamepad` en el registro).
  4. Footer del reproductor: `PAUSA/REANUDAR`, `FIN`, `SKIN` (si el juego tiene skins), `SALIR`.
- En esa vista táctil: ocultar la nav global (`Nav`) y la fila de acciones + selector de skin del HUD superior.
- Botón `SKIN` → pausa el juego y abre un panel con las opciones (muestras de color); elegir aplica `chooseSkin` (misma persistencia `localStorage`). Al cerrar, reanuda solo si el juego no estaba pausado antes de abrir.
- Vibración háptica corta (`navigator.vibrate(10)`) al pulsar botones del gamepad, si existe la API.
- Gestos sobre canvas se mantienen (swipe Serpentina, arrastre Bloque Buster).
- Actualizar `references/implemented-games.md` (columna Touch → `Gamepad`) y `references/integration-checklist.md` (los juegos nuevos declaran `gamepad` en el registro, sin botones dentro del canvas).

**Out of scope:**

- Desktop (`pointer: fine`): sin cambios visuales ni de comportamiento. Gamepad, footer móvil y panel de skin no se renderizan/visibles; HUD y nav idénticos a hoy.
- Orientación horizontal (landscape) con controles laterales → spec futura. En landscape el layout apila igual y se hace scroll.
- Footer global `© 2026 ARCADE VAULT` (se mantiene).
- Remapeo de controles configurable por el usuario, soporte de mandos físicos (Gamepad API), auto-repetición nueva (Caída ya la tiene en el motor).
- Juegos sin entrada en el registro (simulación): no muestran gamepad; sí el footer móvil.
- Cambios en motores `lib/games/*` (salvo que algo del contrato lo exija; no se espera).

---

## Data model

En `lib/games/registry.ts`:

```ts
export type GamepadSlot = "up" | "down" | "left" | "right" | "a" | "b";

export interface GamepadButton {
  /** Acción que se pasa a GameCanvasHandle.setInput. */
  action: string;
  /** Etiqueta corta bajo A/B (opcional en el D-pad). */
  label?: string;
}

/** Slots sin entrada se muestran apagados (deshabilitados). */
export type GamepadLayout = Partial<Record<GamepadSlot, GamepadButton>>;

export interface GameCanvasHandle {
  pause(): void;
  resume(): void;
  restart(): void;
  /** Entrada del gamepad; acción desconocida → se ignora. */
  setInput(action: string, down: boolean): void;
}

export interface GameEntry {
  // ...campos actuales
  /** Controles táctiles; sin campo → no se muestra gamepad. */
  gamepad?: GamepadLayout;
}
```

Mapeo (cerrado):

| Juego           | ▲        | ▼      | ◀              | ▶               | A                  | B                |
| --------------- | -------- | ------ | -------------- | --------------- | ------------------ | ---------------- |
| `rocas`         | `thrust` | —      | `left` (rotar) | `right` (rotar) | `fire` · `DISPARO` | —                |
| `caida`         | —        | `down` | `left`         | `right`         | `rotate` · `ROTAR` | `drop` · `CAÍDA` |
| `bloque-buster` | —        | —      | `left`         | `right`         | —                  | —                |
| `serpentina`    | `up`     | `down` | `left`         | `right`         | —                  | —                |

Persistencia: ninguna nueva (la skin sigue en `av-skin-${game.id}`).

---

## Implementation plan

1. **Contrato.** Añadir `GamepadSlot/GamepadButton/GamepadLayout`, `setInput` en `GameCanvasHandle` y `gamepad?` en `GameEntry`. Implementar `setInput` en el `useImperativeHandle` de los 4 wrappers (guard: solo acciones válidas del juego). Declarar el `gamepad` de cada juego según la tabla. Los botones superpuestos siguen ahí → sistema funcional.
2. **Componente `components/gamepad.tsx`.** Props: `layout: GamepadLayout`, `onInput(action, down)`, `disabled: boolean`. Pointer events con `setPointerCapture`; `down` en `pointerdown`, `up` en `pointerup/pointercancel/lostpointercapture`; `preventDefault` + `touch-action: none` + sin menú contextual/selección; multitáctil (D-pad + A a la vez). `navigator.vibrate?.(10)` en `pointerdown`. Al desactivarse (`disabled`) o desmontarse, envía `down=false` de cualquier acción sostenida. Slots sin acción: renderizados apagados (`disabled`, `aria-hidden`). Diseño con `/frontend-design`.
3. **Montaje en `GamePlayer`.** Renderizar `<Gamepad>` entre `.crt` y el footer, solo si `entry?.gamepad`; `onInput` → `gameRef.current?.setInput`; `disabled` cuando `paused || over`. Visible solo bajo `@media (pointer: coarse)` (CSS, `display:none` por defecto).
4. **Footer del reproductor + panel de skin.** Nueva fila `.player-footer` (táctil) con `PAUSA/REANUDAR`, `FIN`, `SKIN` (si `entry?.skins`), `SALIR`, reutilizando `togglePause/endGame/router.push`. Panel de skin: pausa al abrir, lista `entry.skins` con swatches, `chooseSkin` al elegir, botón cerrar; reanuda al cerrar solo si no estaba pausado antes. En táctil se ocultan `.hud-actions` y `.skin-picker` del HUD superior; stats compactas.
5. **Ocultar nav en juego táctil.** `Nav` detecta `/juegos/[id]/jugar` vía `usePathname` y añade una clase (ej. `is-playing`); CSS bajo `@media (pointer: coarse)` la oculta (incluye hamburguesa). En desktop no cambia.
6. **Limpieza.** Eliminar `.touch-controls` y `TouchButton`/`DPAD` de los 4 `*-canvas.tsx` y todo el CSS `.touch-*` de `app/globals.css` (verificar con grep que no queden referencias). Gestos de canvas intactos.
7. **Docs.** Actualizar `references/implemented-games.md` y `references/integration-checklist.md`; `npm run lint` y `npm run build` sin errores.

---

## Acceptance criteria

- [ ] `GameCanvasHandle` incluye `setInput(action, down)`; los 4 wrappers lo implementan; `tsc`/`npm run build` pasa.
- [ ] Los 4 juegos tienen `gamepad` en `GAME_CANVASES` exactamente según la tabla de mapeo.
- [ ] `grep -r "touch-controls\|TouchButton" components app` no devuelve resultados.
- [ ] En emulación móvil (DevTools, touch, 390×844) en `/juegos/<id>/jugar` para los 4 juegos: ningún botón se superpone al canvas.
- [ ] En esa emulación el orden es: stats → CRT → gamepad → footer (PAUSA, FIN, SKIN, SALIR); la nav global no se ve.
- [ ] Cada botón del gamepad produce su acción según la tabla (ej. Rocas: ▲ acelera, A dispara; Caída: A rota, B suelta; Serpentina gira en las 4 direcciones; Bloque Buster mueve la paleta con ◀▶).
- [ ] Mantener pulsado ◀ en Bloque Buster mueve la paleta de forma continua y se detiene al soltar (incluido arrastrar el dedo fuera del botón).
- [ ] Se puede pulsar D-pad y A simultáneamente en Rocas (rotar + disparar).
- [ ] Slots sin acción se ven apagados y no hacen nada.
- [ ] Con el juego en pausa o en FIN, el gamepad no envía acciones; ninguna acción queda "pegada" al reanudar.
- [ ] `SKIN` pausa el juego y abre el panel; elegir skin cambia el render y persiste tras recargar; cerrar reanuda solo si no estaba en pausa antes.
- [ ] Swipe en Serpentina y arrastre en Bloque Buster siguen funcionando.
- [ ] Juego sin entrada en el registro: sin gamepad, footer móvil presente.
- [ ] Desktop (sin emulación táctil, cualquier ancho): nav, HUD (stats + skin + PAUSA/FIN/SALIR) y CRT idénticos a antes; gamepad, footer móvil y panel no visibles.
- [ ] `npm run lint` sin errores.
- [ ] `references/implemented-games.md` y `references/integration-checklist.md` actualizados.

---

## Decisiones

**Tomadas:**

- **Gamepad genérico en `GamePlayer` + layout en el registro** (no cada canvas el suyo): un solo componente, juegos nuevos solo declaran `gamepad`. Requiere ampliar `GameCanvasHandle` con `setInput`.
- **Forma fija de consola (D-pad + A/B)** para todos; slots no usados **apagados**, no ocultos, para mantener la silueta.
- **Detección = `@media (pointer: coarse)`** (igual que hoy). Desktop con ventana estrecha no ve el gamepad; tablets sí.
- **`setInput(action: string, …)`** con string y guard en cada wrapper, en vez de genéricos tipados por juego: el registro es heterogéneo.
- **Gestos de canvas se mantienen**.
- **Nav global oculta en juego táctil**; **footer global `©` se mantiene**.
- **Fila PAUSA/FIN/SALIR/SKIN pasa al footer del reproductor** en táctil; stats siguen arriba.
- **Skin en móvil = botón `SKIN` → panel** que pausa el juego; reutiliza `chooseSkin` y `localStorage`.
- **Vibración 10 ms** si `navigator.vibrate` existe (iOS Safari no: silencioso).
- **Mapeo** de la tabla de Data model, cerrado.

**Descartadas:**

- Botones dibujados por cada canvas debajo del CRT (duplicación ×4).
- Layout libre por juego (inconsistente).
- Detección por ancho (desktop estrecho vería controles inútiles; tablets anchas no).
- Botón SKIN que rota / selector inline en móvil (rotar es opaco; inline ocupa alto).
- Landscape con controles laterales (spec futura).

---

## Riesgos

- **Acciones pegadas:** si se pierde un `pointerup` (cambio de pestaña, rotación, modal), una acción `down` queda activa. Mitigación: `lostpointercapture`/`pointercancel`, liberar todo al pasar a `disabled`, en `visibilitychange` y al desmontar.
- **Alto en móviles pequeños:** stats + CRT + gamepad + footer pueden no caber en 667 px de alto → scroll durante el juego. Mitigación: gamepad compacto (`clamp`), stats en una línea; verificar en 375×667.
- **Ocultar `Nav` por ruta** depende de `usePathname` en un client component bajo `Suspense`; un parpadeo inicial es posible. Mitigación: la clase es puramente CSS bajo `pointer: coarse`.
- **Dispositivos híbridos** (laptop táctil con mouse) pueden reportar `pointer: fine` y no ver el gamepad; aceptable (tienen teclado).
- **Doble toque / zoom en iOS** sobre los botones. Mitigación: `touch-action: none`/`manipulation` y `preventDefault` en `pointerdown`.

---

## Qué **no** está en esta spec

- Layout landscape con controles a los lados.
- Remapeo de botones, Gamepad API (mandos físicos).
- Cambios en desktop, en el footer global o en los motores de juego.
