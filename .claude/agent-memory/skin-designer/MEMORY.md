# skin-designer — memoria

## Convenciones

- Skins obligatorias: `clasico` (default), `neon`, `retro`. Contrato en `.claude/agents/skin-designer.md`.
- Referencia aprobada por usuario (2026-11-24): `references/started-games/03-tetris/game.js` — `SKINS` con `{name, colors, boardBg, drawBlock}` (estrategia), `applySkin` + localStorage + `<select>`. Mapeo: ref `retro`→`clasico`, `neon`→`neon`, `pixel`→`retro`; `pastel` no requerida.
- Estado (2026-11-24, rama 04-skin-designer): los 4 juegos tienen `skins.ts` + `setSkin`; motores sin literales de color.

## Auditorías

<!-- <YYYY-MM-DD> · <gameId> · <estado> · <n fallos> -->

- 2026-11-24 · serpentina · ❌ · 11 fallos (sin skins.ts; tsc/eslint ok)
- 2026-11-24 · serpentina · ✅ · 0 fallos bloqueantes, 3 menores (re-audit tras impl, sin commitear)
- 2026-11-24 · rocas · ✅ · 0 bloqueantes, 1 menor (swatch a mano) + 1 info (llama aleatoria en pausa)
- 2026-11-24 · caida · ✅ · 0 bloqueantes, 1 menor (swatch a mano)
- 2026-11-24 · bloque-buster · ✅ · 0 bloqueantes, 1 menor (swatch a mano)
- 2026-11-24 · serpentina · ✅ · 0 fallos (3ª audit; fixes #1-#3 verificados)

## Notas de implementación vistas

- serpentina estableció patrón genérico: `GameEntry.skins/defaultSkin` + `GameCanvasProps.skin?: string` en registry, selector en `game-player.tsx` con botones `aria-pressed` (no `<select>`, para no robar flechas/espacio). Tratado como equivalente válido de `#skin-select` (propuesto por agente principal, pendiente confirmación del usuario).
- Clasico ya no lee CSS vars (`--yellow/--magenta/--cyan`): literales iguales en skins.ts; no-regresión = comparar con valor de la var en `app/globals.css`.
- Único texto en canvas: tetris "SIGUIENTE" (clasico `#ff006e` sobre fondo CSS, 5.15 vs `#0a0a0f`).
- Prettier `--check` da warn en todo por CRLF en Windows; comparar con `tr -d '\r'` para ver diffs reales.
