---
name: add-game
description: Genera la spec (specs/NN-*.md) para agregar un juego nuevo a Arcade Vault con su leaderboard en Supabase e integración en GamePlayer. El juego puede venir de references/started-games/ (port a TypeScript) o crearse desde cero. Usar cuando el usuario pida "agregar/portar/crear un juego", "nuevo juego para la plataforma", o mencione tetris/arkanoid/otro juego con ranking. Solo escribe la spec; no implementa código.
---

# add-game — spec para sumar un juego a Arcade Vault

Produce `specs/NN-<slug>.md` en el formato de `specs/05-juego-asteroides-rocas.md` y `specs/06-salon-de-la-fama-supabase.md`. **No toques código, `lib/data.ts` ni la base de datos**: la implementación va luego con `/spec-impl`. Escribe la spec en español.

Referencias de este skill (léelas antes de escribir):

- `references/integration-checklist.md` — contrato técnico validado con `rocas`.
- `references/spec-template.md` — plantilla de la spec.

## Workflow

### 1. Elegir fuente

- Lista `references/started-games/*`. Pendientes de portar: los que no estén ya en `GAMES` de `lib/data.ts` (`02-asteroids` ya es `rocas`).
- Si el usuario no dijo cuál: AskUserQuestion con los candidatos + "desde cero".
- Con referencia: lee su `README.md`, `CLAUDE.md` y `game.js` completos. Desde cero: pide mecánica, controles y condición de fin.
- Pregunta (solo lo que falte): `id` kebab-case, título, categoría (`Category` de `lib/data.ts`), color neón (`cyan|magenta|yellow|green`), controles teclado/táctil, si hay vidas/niveles.

### 2. Inspeccionar el estado real (no asumir)

- `lib/data.ts` (`GAMES`, `Game`, `CoverClass`, `CATS`), `components/game-player.tsx`, `lib/scores.ts`, `components/hall-of-fame.tsx`, `lib/games/`, `lib/games/registry.ts` (¿existe ya?).
- `specs/`: calcula el siguiente `NN`.
- Supabase MCP: `list_tables` y `execute_sql` sobre `pg_get_constraintdef` de `scores_game_id_chk` para ver los ids vigentes; confirma vistas `scores_best` y `game_stats`. Si no hay MCP, léelo de las migraciones/spec 06 e indícalo.
- Antes de proponer código Next: apunta que se debe leer `node_modules/next/dist/docs/` (AGENTS.md).

### 3. Analizar el juego fuente

Identifica: variables globales, listeners en `window/document`, HUD y overlays dibujados en canvas (se eliminan), resolución lógica, reglas y puntuación, fin de partida, assets (imágenes/audio → `public/` o fuera de alcance, decídelo explícitamente), uso de `Math.random`/`window` en carga (riesgo SSR).

### 4. Escribir la spec

Usa `references/spec-template.md`. Secciones obligatorias en la spec:

1. **Port TS** en `lib/games/<id>/` con factory `create<Name>Game(canvas, callbacks, options)` y la interfaz común (`start/pause/resume/restart/destroy/setInput`, callbacks `onScore/onLives/onLevel/onGameOver`). Si el juego no tiene vidas/nivel, define qué reporta (p. ej. vidas fijas o `onLives` omitido) y cómo el HUD lo oculta/ajusta.
2. **Componente** `components/<id>-canvas.tsx` (client, `ref` pause/resume/restart, color vía `getComputedStyle`, controles táctiles `pointer: coarse` reutilizando `.touch-*`).
3. **Registro** `lib/games/registry.ts`: `gameId → componente canvas`. `GamePlayer` reemplaza `isRocas` por lookup; sin entrada → simulación decorativa actual. Si el registro aún no existe, la spec incluye crearlo y migrar `rocas`; si existe, solo registrar el nuevo.
4. **Datos**: nueva entrada en `GAMES` (portada/`CoverClass` si hace falta) y migración que amplía `scores_game_id_chk` con el nuevo id (SQL concreto basado en el CHECK vigente leído). Ids idénticos en `GAMES`, CHECK y registro.
5. **Leaderboard**: sin código nuevo; la spec solo verifica guardado (`submitScore`), pestaña del Salón, estado vacío y stats.
6. **Plan de implementación** numerado, cada paso con verificación (`npx tsc --noEmit`, `npm run lint`, `npm run build`, pruebas manuales, `get_advisors` tras la migración). Incluye "invocar `/frontend-design`" para controles táctiles/portada.
7. **Criterios de aceptación** verificables, derivados de 05/06 más las reglas propias del juego. Incluye: `references/started-games/<juego>/` sin modificar, otros juegos intactos, sin listeners duplicados al volver a entrar, sin errores de consola/hydration.
8. **Decisiones**, **Riesgos** (Strict Mode, SSR, scroll por teclas, `dt` tras pausa, color CSS var, DPR, audio autoplay/assets pesados si aplican) y **Qué no está**.

Status: `Borrador`. Date: hoy. Depends on: SPEC 01, 05, 06 (+ las que apliquen).

### 5. Entrega

Guarda `specs/NN-<slug>.md`. Responde en pocas líneas: ruta, decisiones abiertas y sugerir `/spec-impl`. No hagas commits.
