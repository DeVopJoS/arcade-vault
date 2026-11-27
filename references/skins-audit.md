# Auditoría de skins

Leyenda: ✅ ok · ⚠️ parcial · ❌ falta

Común a los 4 juegos (rama `04-skin-designer`, working tree sin commitear, 2026-11-24): selector genérico en `components/game-player.tsx:36-56,147-175` (botones `aria-pressed`, equivalente aceptado a `#skin-select`), persistencia `av-skin-<gameId>` (lectura en `useEffect` + try/catch, valida contra `entry.skins`), prop `skin` → canvas (`skinRef` + `useEffect` → `setSkin`, el motor no se recrea). `registry.ts` conecta `skins`/`defaultSkin` en las 4 entradas. `npx tsc --noEmit` ✅ · `npx eslint lib/games components/*-canvas.tsx components/game-player.tsx` ✅. Grep de literales de color fuera de `skins.ts`: 0 (solo helper `withAlpha` en `lib/games/snake/utils.ts`).

## ROCAS (`rocas`) — ✅ — 2026-11-24

| Check               | clasico | neon | retro | Nota                                                                                                                           |
| ------------------- | ------- | ---- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| Definida en SKINS   | ✅      | ✅   | ✅    | `SKINS: Record<SkinId, AsteroidsSkin>` (`skins.ts:354`), `DEFAULT_SKIN = "clasico"`                                            |
| Tokens completos    | ✅      | ✅   | ✅    | `name/colors/boardBg` + `drawBoard/drawShip/drawRock/drawBullet/drawParticle`; `boardBg: null` explícito en clasico            |
| Identidad visual    | ✅      | ✅   | ✅    | neon `#000`, relleno 0.55 + trazo, glow = color (8 si alpha<0.5); retro `#1a1a2e`, scanlines + franjas 4 px, rotación 16 pasos |
| Contraste HUD ≥ 4.5 | ✅      | ✅   | ✅    | N/A: sin `fillText`; HUD es DOM                                                                                                |
| Assets              | ✅      | ✅   | ✅    | N/A: vectorial                                                                                                                 |

Global: skins.ts ✅ · DEFAULT_SKIN ✅ · delegación drawX ✅ (0 literales fuera de skins.ts) · contexto limpio ✅ (save/restore) · applySkin sin reinicio ✅ (`index.ts:324`, fallback, redibuja en pausa) · localStorage `av-skin-rocas` ✅ · selector UI ✅ · tsc ✅ · eslint ✅

No-regresión clasico vs `main`: `#f5ff00` (= `--yellow`), trazo 1.5, glow 8 compartido, llama `rgba(255,130,0,0.85)`, partículas lineWidth 1 + alpha ttl, `clearRect` — idéntico.

### Faltantes / acciones

1. (menor) `lib/games/asteroids/skins.ts:377-384` — `SKIN_OPTIONS.swatch` hex duplicados a mano → derivar de `SKINS[id]` (`boardBg ?? "#0a0a0f"`, `colors.ship`, `colors.rock`) como en snake.
2. (info) `lib/games/asteroids/entities.ts:162` — llama aleatoria: al cambiar skin en pausa con `thrusting` activo la llama puede aparecer/desaparecer. Cosmético, aceptable.

## CAÍDA (`caida`) — ✅ — 2026-11-24

| Check               | clasico | neon | retro | Nota                                                                                                                                   |
| ------------------- | ------- | ---- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Definida en SKINS   | ✅      | ✅   | ✅    | `SKINS: Record<SkinId, TetrisSkin>` (`skins.ts:259`), `DEFAULT_SKIN = "clasico"`                                                       |
| Tokens completos    | ✅      | ✅   | ✅    | `name/colors[9]/accent/text/boardBg` + `drawBlock/drawWell/drawNextPanel`                                                              |
| Identidad visual    | ✅      | ✅   | ✅    | neon `#000`, paleta saturada, 0.55 + strokeRect, blur 15/8 (ghost 0.2); retro `#1a1a2e`, rejilla 4 px oscurecida, pozo de puntos       |
| Contraste HUD ≥ 4.5 | ✅      | ✅   | ✅    | "SIGUIENTE": clasico `#ff006e` 5.15 vs `#0a0a0f` / 5.31 vs CRT `#050507`; neon `#00ffff`/`#000` 16.75; retro `#e8e0c8`/`#1a1a2e` 12.94 |
| Assets              | ✅      | ✅   | ✅    | N/A                                                                                                                                    |

Global: skins.ts ✅ · DEFAULT_SKIN ✅ · delegación drawX ✅ (`COLORS` eliminado de `pieces.ts`) · contexto limpio ✅ · applySkin sin reinicio ✅ (`index.ts:441`, redibuja si `listening`, incluye pausa) · localStorage `av-skin-caida` ✅ · selector UI ✅ · tsc ✅ · eslint ✅

No-regresión clasico vs `main`: 8 colores de pieza, pad 1.5, relleno 0.55, lineWidth 2, glow 8 (0 en ghost), rejilla alpha 0.12, marco glow 8, label 12px monospace, panel alpha 0.4, `#ff006e` (= `--magenta`), `clearRect` — idéntico.

Notas revisadas: `paintBoard` cubre todo el canvas 480×600 (pozo + panel) — correcto (equivale a `canvas.style.background` de la referencia). Contraste de clasico depende del fondo CSS; ≥ 4.73 incluso sobre `--bg-3` `#15151f`.

### Faltantes / acciones

1. (menor) `lib/games/tetris/skins.ts:281-288` — `SKIN_OPTIONS.swatch` hex a mano → derivar de `SKINS[id]` (`boardBg ?? "#0a0a0f"`, `colors[1]`, `accent`).

## BLOQUE BUSTER (`bloque-buster`) — ✅ — 2026-11-24

| Check               | clasico | neon | retro | Nota                                                                                                                                  |
| ------------------- | ------- | ---- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Definida en SKINS   | ✅      | ✅   | ✅    | `SKINS: Record<SkinId, ArkanoidSkin>` (`skins.ts:364`), `DEFAULT_SKIN = "clasico"`                                                    |
| Tokens completos    | ✅      | ✅   | ✅    | `colors.bricks` (7 BlockColor) + `paddle/ball/ballCore/flash`; `drawBrick/drawExplosion/drawPaddle/drawBall` con `alpha?`             |
| Identidad visual    | ✅      | ✅   | ✅    | neon `#000`, 0.55 + trazo, blur 15/8, explosión en anillos; retro `#1a1a2e`, líneas 4 px + bisel, bola en cruz de píxeles, fragmentos |
| Contraste HUD ≥ 4.5 | ✅      | ✅   | ✅    | N/A: sin `fillText`                                                                                                                   |
| Assets              | ✅      | ✅   | ✅    | N/A                                                                                                                                   |

Global: skins.ts ✅ · DEFAULT_SKIN ✅ · delegación drawX ✅ (`BLOCK_HEX` y draw* eliminados de levels/entities) · contexto limpio ✅ · applySkin sin reinicio ✅ (`index.ts:348`) · localStorage `av-skin-bloque-buster` ✅ · selector UI ✅ · tsc ✅ · eslint ✅

No-regresión clasico vs `main`: `BLOCK_HEX` idéntico, ladrillo 0.25 + glow 10, explosión 4 pasos glow 16 flash `#ffffff`, paddle/bola `#00f5ff` (= `--cyan`) glow 14/16, roundRect r6, núcleo `#ffffff` — idéntico.

### Faltantes / acciones

1. (menor) `lib/games/arkanoid/skins.ts:386-393` — `SKIN_OPTIONS.swatch` hex a mano → derivar de `SKINS[id]` (`boardBg ?? "#0a0a0f"`, `colors.paddle`, `colors.bricks.red`).

## SERPENTINA (`serpentina`) — ✅ — 2026-11-24

Re-auditoría (3ª).

| Check               | clasico | neon | retro | Nota                                                                                                                                      |
| ------------------- | ------- | ---- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Definida en SKINS   | ✅      | ✅   | ✅    | `SKINS: Record<SkinId, SnakeSkin>` (`skins.ts:395`), `DEFAULT_SKIN = "clasico"`                                                           |
| Tokens completos    | ✅      | ✅   | ✅    | `name/colors/boardBg` + `drawGrid/drawSegment/drawEyes/drawFruit/drawParticle`; `boardBg: null` explícito en clasico                      |
| Identidad visual    | ✅      | ✅   | ✅    | neon: fondo `#000`, 0.55 + strokeRect, glow = color, blur 8 si alpha<0.5 (segmento y fruta `skins.ts:211`)                                |
| Contraste HUD ≥ 4.5 | ✅      | ✅   | ✅    | N/A: sin `fillText`                                                                                                                       |
| Assets              | ✅      | ✅   | ✅    | `public/games/snake/fruits.png` existe; clasico/neon sprite + glow, retro sprite pixelado+desaturado (cache), fallback vectorial por skin |

Global: skins.ts ✅ · DEFAULT_SKIN ✅ · delegación drawX ✅ · contexto limpio ✅ · applySkin sin reinicio ✅ (`index.ts:356`) · localStorage `av-skin-serpentina` ✅ · selector UI ✅ · tsc ✅ · eslint ✅

Fixes previos verificados: #1 blur fruta neón `alpha < 0.5 ? 8 : 16` (`skins.ts:211`) ✅ · #2 `SKIN_OPTIONS` derivado de `SKINS` (`skins.ts:420-431`) ✅ · #3 `registry.ts` formateado ✅.

### Faltantes / acciones

Ninguno. (info) `skin?: string` en registry/canvas en vez de `SkinId`: aceptado por registry genérico, validado con `isSkinId`.

## RANARIA (`ranaria`) — ✅ — 2026-11-26

Juego nuevo (rama `spec-frogger`, no existe en main): no-regresión de `clasico` evaluada contra el look del spec (carretera negra, río azul, franjas verdes, bocas verde oscuro + borde dorado).

| Check               | clasico | neon | retro | Nota                                                                                                                                                  |
| ------------------- | ------- | ---- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Definida en SKINS   | ✅      | ✅   | ✅    | `SKINS: Record<SkinId, RanariaSkin>` (`skins.ts:662`) vía fábrica `makeSkin(name, mode, boardBg, colors)`; `DEFAULT_SKIN = "clasico"`                 |
| Tokens completos    | ✅      | ✅   | ✅    | `name/colors/boardBg` + `drawBoard/drawGoalFrog/drawVehicle/drawLog/drawTurtles/drawFrog(alpha?)/drawHud`; `RanariaSkinColors` completo en las 3      |
| Identidad visual    | ✅      | ⚠️   | ✅    | neon: `#000`, relleno 0.55 + stroke, glow = color, blur 6 si alpha<0.5; retro: `#1a1a2e`, desaturada, líneas cada 4 px, sin glow. Ver acción 1 (neon) |
| Contraste HUD ≥ 4.5 | ✅      | ✅   | ✅    | `hudText` sobre fila 13 (`safe`): clasico 10.20 · neon 16.64 (`#00ff88`@0.14 sobre negro) · retro 7.17 (8.68 en línea de textura)                     |
| Assets              | ✅      | ✅   | ✅    | N/A: todo vectorial                                                                                                                                   |

Global: skins.ts ✅ · DEFAULT_SKIN ✅ · delegación drawX ✅ (0 literales fuera de skins.ts; `utils.ts:139` `withAlpha` solo convierte) · contexto limpio ✅ (`paint`/`line`/`text` con save/restore) · applySkin sin reinicio ✅ (`index.ts:422`, fallback DEFAULT_SKIN, redibuja en pausa) · localStorage `av-skin-ranaria` ✅ (`game-player.tsx:38`) · selector UI ✅ (`SKIN_OPTIONS` derivado de `SKINS`) · tsc ✅ · eslint ✅

### Faltantes / acciones

1. ✅ Corregido (hedge neon → `#b967ff`). (menor, legibilidad) `lib/games/ranaria/skins.ts:608-610` — en neon `hedge` y `goal` son ambos `#00ff88` (zona a 0.14): boca vs seto (muerte) solo se distingue por el borde `goalBorder`. → dar a `hedge` otro tono (p. ej. `#b967ff` o `goal: "#00f5ff"`) para diferenciar relleno.
