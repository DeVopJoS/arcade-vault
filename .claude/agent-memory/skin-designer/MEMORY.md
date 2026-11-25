# skin-designer — memoria

## Convenciones

- Skins obligatorias: `clasico` (default), `neon`, `retro`. Contrato en `.claude/agents/skin-designer.md`.
- Referencia aprobada por usuario (2026-11-24): `references/started-games/03-tetris/game.js` — `SKINS` con `{name, colors, boardBg, drawBlock}` (estrategia), `applySkin` + localStorage + `<select>`. Mapeo: ref `retro`→`clasico`, `neon`→`neon`, `pixel`→`retro`; `pastel` no requerida.
- Estado inicial (2026-11-24): ningún juego tiene `skins.ts`; colores hardcodeados en motores/canvas.

## Auditorías

<!-- <YYYY-MM-DD> · <gameId> · <estado> · <n fallos> -->
- 2026-11-24 · serpentina · ❌ · 11 fallos (sin skins.ts; tsc/eslint ok)
