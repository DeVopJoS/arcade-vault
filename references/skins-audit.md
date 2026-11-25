# Auditoría de skins

Leyenda: ✅ ok · ⚠️ parcial · ❌ falta

## SERPENTINA (`serpentina`) — ❌ — 2026-11-24

| Check               | clasico | neon | retro | Nota                                                                                  |
| ------------------- | ------- | ---- | ----- | ------------------------------------------------------------------------------------- |
| Definida en SKINS   | ❌      | ❌   | ❌    | No existe `lib/games/snake/skins.ts`                                                  |
| Tokens completos    | ❌      | ❌   | ❌    | Sin `SnakeSkin`; único token = `color` (`--green`) pasado por options                 |
| Identidad visual    | ⚠️      | ❌   | ❌    | Look actual (neón verde + glow) sirve de base para `clasico`; neon/retro inexistentes |
| Contraste HUD ≥ 4.5 | n/a     | n/a  | n/a   | Canvas sin texto (`fillText` ausente); HUD en DOM                                     |
| Assets              | ⚠️      | ❌   | ❌    | `public/games/snake/fruits.png` existe; ninguna skin define cómo dibujar fruta        |

Global: skins.ts ❌ · DEFAULT_SKIN ❌ · delegación drawX ❌ (21 líneas con estilos/literales fuera de skins.ts, 5 literales de color) · contexto limpio ⚠️ (funciones actuales usan save/restore) · applySkin sin reinicio ❌ · localStorage `av-skin-serpentina` ❌ · selector UI ❌ · tsc ✅ · eslint ✅

### Faltantes / acciones

1. `lib/games/snake/skins.ts` (nuevo) — crear `SkinId`, `SnakeSkin { name, colors, boardBg, drawGrid, drawSegment, drawEyes, drawFruit, drawParticle, drawEatEffect }` con `alpha?`, `SKINS: Record<SkinId, SnakeSkin>`, `DEFAULT_SKIN = "clasico"` → port del patrón `SKINS` de `references/started-games/03-tetris/game.js`.
2. `lib/games/snake/entities.ts:73` — `FALLBACK_COLOR = "#ff006e"` → mover a `skins.ts` (`colors.fallback` por skin).
3. `lib/games/snake/entities.ts:209-224` — `drawGrid` pinta `withAlpha(color, 0.06)` → `activeSkin.drawGrid` (retro: rejilla pixel oscura; neon: líneas tenues del color).
4. `lib/games/snake/entities.ts:255-263` — sprite con `shadowColor rgba(255,255,255,.55)`/blur 10 y fallback magenta → `activeSkin.drawFruit` (clasico: sprite + glow actual; neon: sprite + glow del color de fruta; retro: sprite sin glow + textura/tinte desaturado o forma pixel).
5. `lib/games/snake/entities.ts:302-306` — partículas con `shadowColor = color`, blur 8 → `activeSkin.drawParticle` (retro blur 0).
6. `lib/games/snake/entities.ts:323-324` — ojos `#fff` → `skin.colors.eyes`.
7. `lib/games/snake/entities.ts:352-355` — segmentos `strokeStyle/fillStyle 0.25/shadowBlur 12` → `activeSkin.drawSegment`; `SKINS.clasico` debe reproducir exactamente estos valores (sin regresión).
8. `lib/games/snake/index.ts:74` y `:196` — `options.color || "#00ff88"` + `clearRect` → usar `activeSkin` y `activeSkin.boardBg` (`null` ⇒ clearRect); añadir `setSkin(key)` con fallback a `DEFAULT_SKIN` que llame `draw()` sin tocar score/estado.
9. `components/snake-canvas.tsx:54` — lectura de `--green` con fallback `#00ff88` → sustituir por prop `skin?: SkinId` pasada al motor (`setSkin` en `useEffect` al cambiar).
10. `components/game-player.tsx` — sin selector → `<select>` CLÁSICO/NEÓN/RETRO, persistir `av-skin-serpentina` en localStorage (lectura en `useEffect` + try/catch), valor inicial = guardado.
11. Identidad: neon `boardBg #000`, relleno alpha ~0.55 + stroke, `shadowBlur` > 0 (menor si alpha < 0.5); retro paleta desaturada, `boardBg #1a1a2e`, textura cada ~4 px, blur 0.

Siguiente paso: `/spec skins-serpentina` → `/spec-impl` (paletas con `/frontend-design`).
