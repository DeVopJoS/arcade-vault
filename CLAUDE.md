# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: online game platform where users play and compete for points. UI/copy in Spanish. Development is spec-driven: `specs/NN-*.md` (via `/spec`, `/spec-impl` from `Klerith/fernando-skills`: `npx skills@latest add Klerith/fernando-skills`). `specs/.spec-config.yml`: `AutoCreateBranch: true` (`/spec-impl` creates branch `spec-NN-slug`).

Specs done: 01 MVP screens, 02 home, 03 about+contact (Resend), 04 Supabase connection, 05 Asteroids, 06 Hall of Fame (Supabase), 07 Tetris, 08 Arkanoid, 09 Snake.

## Commands

`npm run dev | build | start | lint | format` (prettier). No test runner.

## Stack / gotchas

- Next.js 16.4.5, React 19.3, Tailwind v4, TypeScript strict, App Router in `app/`, path alias `@/*` → repo root.
- AGENTS.md: this Next.js version has breaking changes vs. training data — read relevant guide in `node_modules/next/dist/docs/` before writing Next code. `next dev` rewrites AGENTS.md blocks (incl. agent-feedback pass); commit it with work.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching`, `experimental.agentFeedback`, and routes `*.css` through `@tailwindcss/turbopack` loader. `cacheComponents` changes caching/dynamic-data semantics — check docs before using fetch/cookies/etc.
- Layout uses the global `LayoutProps<"/">` type (typed routes helper), not hand-written props.
- Theme via CSS vars in `app/globals.css` (`--background`/`--foreground`, dark via `prefers-color-scheme`) mapped into Tailwind with `@theme inline`.
- Env (`.env.template` → `.env.local`): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `RESEND_FROM_EMAIL` (opt), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Routes (`app/`)

- `/` home (`components/home.tsx`), `/acerca` about + contact form (server action `actions.ts` → Resend, in-memory rate limit `lib/rate-limit.ts`, 3/hour)
- `/juegos` library, `/juegos/[id]` detail (+ `not-found.tsx`), `/juegos/[id]/jugar` player
- Games implemented are: `arkanoid`, `asteriods`, `snake` and more... (see `\references\implemented-games.md` when you need to check which games are implemented and how to implement new ones.)
- `/salon` Hall of Fame (`components/hall-of-fame.tsx`), `/auth` (`auth-form.tsx`), `/supabase-test` connectivity check
- UI templates/mocks in `references/templates/` (JSX prototypes); `references/started-games/` = vanilla JS sources for ports; `references/source-assets/` = sprites.

## Games architecture

- Catalog: `lib/data.ts` (mock `Game` list: rocas, caida, bloque-buster, serpentina).
- Registry: `lib/games/registry.ts` maps `gameId` → `{ component, hasLives }`. Ids without entry fall back to score simulation in `components/game-player.tsx`. Canvas contract: `GameCanvasProps` (`onScore/onLives/onLevel/onGameOver`) + `GameCanvasHandle` (`pause/resume/restart`).
- Each game: `components/<name>-canvas.tsx` (React wrapper) + `lib/games/<name>/` (`entities.ts`, `index.ts`, `utils.ts`, plus `board/pieces/levels/sprites` as needed). Games: `asteroids` (rocas), `tetris` (caida), `arkanoid` (bloque-buster), `snake` (serpentina; has on-screen D-pad for touch).
- Scores: `lib/scores.ts` (`submitScore`, `fetchLeaderboard`, `fetchGameStats`) via browser Supabase client. Tables/views: `scores` (insert), `scores_best` (leaderboard), `game_stats` (plays/players/best). Name uppercased, max 10 chars.
- `components/session-provider.tsx`: client-only fake session in localStorage (`av_user`, `av_scores`) — not Supabase Auth.
- Supabase clients: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (SSR, cookies).

## Tooling

- MCP (`.mcp.json`): `supabase` HTTP server (project-scoped; enabled in `.claude/settings.local.json`). Use for schema/migrations/advisors; inspect tables before schema changes.
- Hook (`.claude/settings.json`): PostToolUse on Write|Edit runs `.claude/hooks/format-lint.mjs` → prettier + eslint --fix on ts/tsx/js/jsx/mjs/json/css/md (skips node_modules, .next, demos). Lint errors block (exit 2) — fix them.
- Prettier config in `.prettierrc`; `demos/` is excluded from formatting.

## Skills

- `/frontend-design`: SIEMPRE usar para diseñar la interfaz de usuario.
- `/add-game` (`.claude/skills/add-game/`): genera spec `specs/NN-*.md` para un juego nuevo (port desde `references/started-games/` o desde cero) con leaderboard + integración en registry/GamePlayer. Solo escribe la spec; implementar con `/spec-impl`. Refs: `references/integration-checklist.md`, `references/spec-template.md`.
- Spec workflow: `/spec`, `/spec-impl` (fernando-skills).
