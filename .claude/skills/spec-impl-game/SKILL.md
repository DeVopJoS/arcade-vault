---
name: spec-impl-game
description: Igual que /spec-impl (implementa una spec Aprobada de un juego, paso a paso, en rama spec-NN-slug) y, al terminar el plan, ejecuta en secuencia los subagentes skin-designer y luego mobile-porter sobre el juego implementado. Usar para specs de juegos nuevos.
disable-model-invocation: true
argument-hint: <NN-spec-name | ruta/a/spec.md>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — /spec-impl + skins + modo móvil

## Contexto de sesión

Estado del repo:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ specs/game-jam/ 2>/dev/null || echo "No existe specs/"`

Config de ramas:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

---

## Instrucciones

Argumento recibido: `$ARGUMENTS`

### Fases 1–4 — exactamente /spec-impl

1. Lee el skill original con Read: `~/.claude/skills/spec-impl/SKILL.md` (fallback: `~/.agents/skills/spec-impl/SKILL.md`). Si no existe ninguno, detente y pide instalarlo: `npx skills@latest add Klerith/fernando-skills`.
2. Sigue sus **Fases 1 a 4 al pie de la letra** (identificar spec, validar estado Aprobado, rama `spec-NN-slug` según `AutoCreateBranch`, implementar paso a paso con pausas, nunca commitear). Usa como `$ARGUMENTS` el argumento de arriba y como contexto de sesión el bloque de arriba (equivale al de /spec-impl).
   - Además de `specs/NN-*.md`, acepta specs en `specs/game-jam/<game-id>/spec.md` (argumento = ruta o `<game-id>`). Si la spec no está numerada, la rama es `spec-<game-id>`.
3. Todos los bloqueos de /spec-impl aplican: si la spec no está Aprobada, si hay cambios sin commitear sin respuesta, o si el usuario no confirma, **no llegues a la Fase 5**.

Cuando /spec-impl indicaría "✅ All steps of the plan are implemented", **no termines**: continúa a la Fase 5.

### Fase 5 — Post-implementación: skins y móvil (secuencial)

1. **Identifica el `gameId`** del juego implementado: el id de catálogo agregado en `lib/data.ts` y registrado en `GAME_CANVASES` de `lib/games/registry.ts` (p. ej. `serpentina`, no `snake`). Si no es inequívoco, pregunta con AskUserQuestion. Si el juego no quedó en el registry, detente y repórtalo (ninguno de los agentes puede trabajar sin canvas real).
2. Avisa al usuario:

   ```
   Plan implementado. Ejecuto ahora, en orden:
     1) skin-designer <gameId>   (auditoría de skins)
     2) mobile-porter <gameId>   (modo móvil SPEC 10)
   ```

   y espera confirmación.

3. **Lanza `skin-designer`** con la herramienta Agent (`subagent_type: "skin-designer"`), en primer plano, prompt: `<gameId>` + contexto breve (spec implementada, rama activa, archivos del juego en `components/<name>-canvas.tsx` y `lib/games/<name>/`). **Espera su resultado completo** antes de seguir.
4. Resume al usuario el veredicto de skins (pasa/falla, hallazgos clave, ruta de `references/skins-audit.md`). skin-designer solo audita: si hay fallas, **pregunta** si se corrigen ahora (dentro del alcance de la spec) o se anotan para otra spec; no corrijas sin respuesta.
5. **Solo después**, lanza `mobile-porter` con Agent (`subagent_type: "mobile-porter"`), en primer plano, prompt: `<gameId>` + mismo contexto (+ resultado de skins si mobile-porter toca el render). **Nunca lances ambos agentes en el mismo mensaje ni en paralelo / background.**
6. Resume el resultado de mobile-porter (mapeo de gamepad elegido, archivos tocados, `tsc`/`eslint`/Playwright).
7. Si cualquiera de los agentes falla o devuelve error, detente, reporta y pregunta cómo seguir; no lances el siguiente agente automáticamente.

### Cierre

```
✅ Plan implementado + skins auditadas + modo móvil aplicado.

Siguiente paso: verificar los criterios de aceptación uno a uno.
Si todos pasan, cambia el estado de la spec a "Implementado" y haz el commit final
(incluye .claude/agent-memory/ si los agentes la actualizaron) antes de mergear la rama.
```

Nunca commitees automáticamente.
