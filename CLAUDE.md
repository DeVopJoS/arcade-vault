# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: online game platform where users play and compete for points (per README). Early stage — only the create-next-app scaffold exists (`app/layout.tsx`, `app/page.tsx`); `references/` is empty. README says development is spec-driven (`/spec`, `/spec-impl`) using skills from `Klerith/fernando-skills` (`npx skills@latest add Klerith/fernando-skills`).

## Commands

- `npm run dev` — dev server (Next dev, Turbopack)
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)
- No test runner configured.

## Stack / gotchas

- Next.js 16.4.5, React 19.3, Tailwind v4, TypeScript strict, App Router in `app/`, path alias `@/*` → repo root.
- AGENTS.md: this Next.js version has breaking changes vs. training data — read relevant guide in `node_modules/next/dist/docs/` before writing Next code.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching`, `experimental.agentFeedback`, and routes `*.css` through `@tailwindcss/turbopack` loader. `cacheComponents` changes caching/dynamic-data semantics — check docs before using fetch/cookies/etc.
- Layout uses the global `LayoutProps<"/">` type (typed routes helper), not hand-written props.
- Theme via CSS vars in `app/globals.css` (`--background`/`--foreground`, dark via `prefers-color-scheme`) mapped into Tailwind with `@theme inline`.
