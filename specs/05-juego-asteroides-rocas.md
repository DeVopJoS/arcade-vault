# SPEC 05 — Juego Asteroides (ROCAS) integrado en el reproductor

> **Status:** Implementado
> **Depends on:** SPEC 01 (reproductor `GamePlayer`, `saveScore`, datos mock)
> **Date:** 2026-11-19
> **Objective:** Portar a TypeScript el juego Asteroids de `references/started-games/02-asteroids/` y montarlo dentro de `GamePlayer` solo para el juego `rocas`, reutilizando el HUD, la pausa y el modal de fin de la plataforma, con controles de teclado y táctiles.

---

## Por qué existe esta spec

SPEC 01 dejó el reproductor con una arena decorativa y puntaje simulado. Este es el primer juego real. El original es un `game.js` con variables globales, listeners en `window` y HUD/game over dibujados en el canvas; para vivir en React hay que encapsularlo, limpiarlo al desmontar y delegar HUD y fin de partida a la plataforma.

---

## Scope

**In:**

- Port a TypeScript del juego en `lib/games/asteroids/`, sin globals ni acceso a `document`/`window` fuera de `start()`.
- Factory `createAsteroidsGame(canvas, callbacks)` con control de ciclo de vida (`start`, `pause`, `resume`, `restart`, `destroy`).
- Integración en `components/game-player.tsx`: si `game.id === "rocas"` se monta el canvas en `.crt-screen`; el resto de juegos conserva la simulación actual.
- HUD de la plataforma alimentado por el juego (puntuación, vidas, nivel). Se eliminan del canvas el HUD y el overlay "GAME OVER".
- Fin de partida (vidas = 0) abre el modal FIN DEL JUEGO existente; botón FIN también lo abre.
- PAUSA / REANUDAR detienen y reanudan el juego real. JUGAR DE NUEVO lo reinicia.
- Estilo neón: trazos con el color `yellow` del juego (`var(--yellow)`) y brillo (`shadowBlur`), fondo transparente/negro del CRT.
- Controles de teclado: `←` `→` rotar, `↑` propulsar, `Espacio` disparar.
- Controles táctiles: botones en pantalla (rotar izq., rotar der., propulsar, disparar), visibles solo en dispositivos táctiles (`@media (pointer: coarse)`).
- Reglas de juego idénticas al original: mundo toroidal, 3 vidas, invencibilidad 3 s al reaparecer, asteroides 3 tamaños con puntos 20/50/100, oleada `3 + nivel`, resolución lógica 800×600.

**Out of scope (para futuras specs):**

- Power-ups y estrella fugaz mencionados en el README del original (el código no los tiene).
- OVNIs (la descripción de `rocas` en `lib/data.ts` los menciona; no existen en el juego).
- Guardar puntaje en Supabase (sigue `saveScore` → `localStorage["av_scores"]`).
- Sonido, vibración, ranking real, dificultad configurable.
- Portar los otros 7 juegos o cambiar su simulación.
- Tests automatizados.
- Modificar `references/started-games/02-asteroids/` (queda como fuente intacta).

---

## Data model

Esta feature no introduce datos persistentes nuevos; reutiliza `SavedScore` de SPEC 01. Define la interfaz entre el juego y React:

```ts
// lib/games/asteroids/index.ts
export interface AsteroidsCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface AsteroidsGame {
  start(): void; // registra listeners y arranca el loop
  pause(): void;
  resume(): void;
  restart(): void; // score 0, 3 vidas, nivel 1
  destroy(): void; // cancela rAF y quita listeners
  setInput(action: "left" | "right" | "thrust" | "fire", down: boolean): void; // táctil
}

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
  options?: { color?: string },
): AsteroidsGame;
```

Estructura de archivos prevista:

```
lib/games/asteroids/
  index.ts       // createAsteroidsGame, loop, estado, input
  entities.ts    // Ship, Asteroid, Bullet, Particle
  utils.ts       // wrap, dist, rand, randInt
components/asteroids-canvas.tsx  // client: monta canvas + controles táctiles
```

Convenciones:

- Canvas con resolución interna 800×600 y escalado por CSS (`width:100%`, `aspect-ratio: 4/3`), sin cambiar la lógica.
- Los callbacks se invocan solo cuando el valor cambia, no en cada frame.
- `dt` limitado a 0.05 s como en el original.
- Los listeners de teclado llaman `preventDefault` solo para `Space` y flechas, y solo mientras el juego esté montado.

---

## Implementation plan

Antes del paso 1: leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `"use client"`. Leer el CSS actual de `.crt-screen` y `.game-arena` en `app/globals.css`. Invocar `/frontend-design` antes de diseñar los controles táctiles (paso 7).

1. **Utils y entidades.** Crear `lib/games/asteroids/utils.ts` y `entities.ts` (Bullet, Asteroid, Ship, Particle) tipados, con el `ctx` recibido por parámetro en `draw`. Verificar: `npx tsc --noEmit` sin errores.
2. **Motor.** Crear `lib/games/asteroids/index.ts` con estado, `update`, `draw`, loop con `requestAnimationFrame`, input de teclado y callbacks. Sin HUD ni overlay en canvas. Verificar: `tsc` y `npm run lint` sin errores.
3. **Componente canvas.** Crear `components/asteroids-canvas.tsx` (client) que monta el canvas, crea el juego en `useEffect`, lo destruye al desmontar y expone `ref` con `pause/resume/restart`. Verificar: compila.
4. **Integrar en GamePlayer.** En `components/game-player.tsx`, si `game.id === "rocas"`: no arrancar el `setInterval` simulado ni el efecto de nivel, y renderizar `AsteroidsCanvas` en lugar de `.game-arena`. Conectar `onScore/onLives/onLevel` al estado del HUD y `onGameOver` a `setOver(true)`. Verificar: `/juegos/rocas/jugar` muestra la nave y el puntaje sube al destruir asteroides; `/juegos/caida/jugar` sigue simulado.
5. **Pausa, FIN y reinicio.** PAUSA/REANUDAR llaman `pause()/resume()`; FIN abre el modal y detiene el juego; JUGAR DE NUEVO llama `restart()`. Verificar manualmente el ciclo completo.
6. **Estilo neón.** Pasar `color: "var(--yellow)"` resuelto a valor real vía `getComputedStyle`, trazos con `shadowBlur`. Verificar visualmente sobre el CRT.
7. **Controles táctiles.** Botones superpuestos que llaman `setInput`, visibles solo con `pointer: coarse`, con `touch-action: none` y sin scroll al pulsar. Verificar con emulación táctil en DevTools.
8. **Cierre.** `npm run build` y `npm run lint`; probar navegar fuera y volver al juego sin listeners duplicados.

Cada paso deja la app compilable y navegable.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `/juegos/rocas/jugar` muestra la nave, asteroides en movimiento y no muestra la arena decorativa.
- [ ] `←` `→` rotan, `↑` propulsa y `Espacio` dispara; las flechas y espacio no hacen scroll de la página.
- [ ] Destruir un asteroide grande suma 20, mediano 50 y pequeño 100 en el HUD de la plataforma.
- [ ] Al chocar, las vidas del HUD bajan de 3 a 2; la nave reaparece tras ~2 s con invencibilidad de 3 s (parpadeo).
- [ ] Al limpiar todos los asteroides el nivel del HUD sube en 1 y aparece una oleada de `3 + nivel` asteroides.
- [ ] Con 0 vidas se abre el modal FIN DEL JUEGO con la puntuación final correcta.
- [ ] GUARDAR PUNTUACIÓN añade una entrada con `game: "rocas"` a `localStorage["av_scores"]`.
- [ ] PAUSA congela asteroides, nave y balas, y muestra "EN PAUSA"; REANUDAR continúa desde el mismo estado.
- [ ] FIN abre el modal y el juego deja de actualizarse.
- [ ] JUGAR DE NUEVO reinicia puntaje a 0, 3 vidas y nivel 01.
- [ ] El canvas no dibuja SCORE, NIVEL, vidas ni "GAME OVER".
- [ ] SALIR y VOLVER AL VAULT desmontan el juego; al volver a entrar no hay listeners duplicados (un solo disparo por pulsación).
- [ ] `/juegos/caida/jugar` conserva el puntaje simulado y la arena decorativa.
- [ ] Con emulación táctil aparecen los 4 botones y permiten jugar; en escritorio con mouse no aparecen.
- [ ] Sin errores en consola ni warnings de hydration.
- [ ] `references/started-games/02-asteroids/` no fue modificado.

---

## Decisiones

- **Sí:** integrar dentro de `GamePlayer`. Reutiliza HUD, pausa, modal y `saveScore` ya validados en SPEC 01.
- **No:** iframe del HTML original. Menos integrado y obliga a `postMessage` para puntaje y pausa.
- **No:** componente aparte con HUD propio. Duplicaría UI y el guardado de puntaje.
- **Sí:** portar a TypeScript en `lib/games/asteroids/`. Elimina globals, tipa el juego y permite limpiar listeners al desmontar.
- **No:** copiar `game.js` a `public/`. Rápido, pero con globals, sin cleanup y sin tipos.
- **Sí:** quitar HUD y "GAME OVER" del canvas. La plataforma ya los muestra; evita duplicar información.
- **Sí:** el motor reporta cambios por callbacks y React solo renderiza el HUD. Evita re-render por frame.
- **Sí:** estilo neón amarillo (color del juego). Coherencia visual con la plataforma.
- **Sí:** controles táctiles con botones en pantalla. Elegido por el usuario; el juego necesita 4 acciones simultáneas.
- **No:** power-ups, estrella fugaz y OVNIs. El código original no los tiene; serían mecánicas nuevas.
- **No:** Supabase para puntajes. Requiere tablas, RLS y auth; spec aparte basada en SPEC 04.
- **Sí:** mantener la resolución lógica 800×600 y escalar por CSS. Conserva exactamente la física del original.
- **Sí:** solo `rocas` usa el juego real. Los demás siguen simulados hasta tener su propio port.

---

## Riesgos

| Riesgo                                                                       | Mitigación                                                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| React Strict Mode monta el efecto dos veces en dev y duplica listeners/loops | `destroy()` idempotente que cancela rAF y quita listeners; el efecto lo llama en cleanup          |
| `Math.random()` y `window` rompen SSR                                        | Todo el juego se crea en `useEffect` dentro de un componente client; nada se ejecuta en el render |
| Teclas (flechas/espacio) hacen scroll o activan botones enfocados            | `preventDefault` en esas teclas mientras el juego está montado; quitar foco del botón tras pulsar |
| Pausa deja `dt` enorme al reanudar                                           | `resume()` reinicia `lastTime`; `dt` capado a 0.05 s                                              |
| Color CSS var no sirve en canvas                                             | Resolver `--yellow` con `getComputedStyle` al crear el juego                                      |
| Botones táctiles tapados por el scroll o zoom del navegador                  | `touch-action: none`, `pointerdown/up/cancel` y `setPointerCapture`                               |
| Canvas escalado se ve borroso en pantallas de alta densidad                  | Aceptado en esta spec; manejar `devicePixelRatio` si se nota                                      |

---

## Qué **no** está en esta spec

- Power-ups, estrella fugaz, OVNIs.
- Supabase, ranking real o lectura de `av_scores`.
- Sonido o vibración.
- Port de los otros 7 juegos.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
