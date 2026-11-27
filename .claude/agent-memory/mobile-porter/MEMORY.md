# mobile-porter — memoria

## Convenciones

- Modo móvil de stock = SPEC 10 (`specs/10-gamepad-movil.md`), rama `spec-10-gamepad-movil` (2026-11-26).
- Detección táctil: `@media (pointer: coarse)`; desktop sin cambios.
- Gamepad fijo D-pad + A/B; slots sin acción apagados (no ocultos). A = acción principal, B = secundaria.
- Gestos sobre canvas (swipe/arrastre) se mantienen en el motor.
- Infra compartida (`components/gamepad.tsx`, `GamePlayer`, `Nav`) no se toca desde este agente.

## Mapeos aprobados

- `rocas` (shooter rotacional): ▲ thrust · ◀▶ left/right · A fire `DISPARO`
- `caida` (puzzle piezas): ▼ down · ◀▶ left/right · A rotate `ROTAR` · B drop `CAÍDA`
- `bloque-buster` (paleta): ◀▶ left/right (+ arrastre en canvas)
- `serpentina` (rejilla 4 dir.): ▲▼◀▶ up/down/left/right (+ swipe)
- `ranaria` (rana / cruce carriles): ▲▼◀▶ up/down/left/right; motor ignora `down=false` (1 salto por pulsación)

## Ports

<!-- <YYYY-MM-DD> · <gameId> · <tipo> · <port|audit> · <estado> -->

- 2026-11-26 · rocas, caida, bloque-buster, serpentina · — · port (SPEC 10) · ✅
- 2026-11-26 · ranaria · rana/cruce carriles · port · ✅
