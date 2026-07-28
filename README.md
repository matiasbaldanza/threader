# Threader

A local-first tool for writing X threads: paste your text, let it split and number itself,
then publish it through a step-by-step wizard that hands you one thing at a time.

**Status: Stage 0.** Workspace scaffolded; the actual splitting logic lands in Stage 1.

## Why

- People reply to post 1 or 2 while the rest of the thread is still going out. Threader
  captures the first post's real URL during publishing and builds a closing post that asks
  readers to repost *that* one.
- Manual numbering goes stale the moment you reorder or merge anything. Here numbering is
  derived at render time, never typed — so it cannot be wrong.
- Publishing by hand is copy → switch tabs → paste → find the image → repeat. The wizard
  puts each post on your clipboard in order, offers its assets one at a time, and takes the
  resulting URL before moving on.

The machine does the mechanical work. You keep the judgment and the act of publishing —
Threader never posts anything itself.

## Features

- Auto-split with manual override — drag, merge, split, reorder, lock a post against reflow
- Correct character counting (URLs count as 23, CJK as 2, emoji as 2)
- Derived numbering, configurable per account (`1/12`, `🧵1/12`, `1.`, none)
- Profiles: character limit, numbering style, closing-post templates, voice rules, asset library
- Images, GIFs, and video attached per post
- A resumable publish wizard — close the tab at post 7, come back, resume at post 7
- A permanent record of every published post's URL

## Getting started

Requires **Node ≥ 20.10** and **pnpm ≥ 10** — pnpm only, not npm or yarn ([ADR-0008](docs/decisions/0008-pnpm-workspaces.md)).

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173.

| Command | Does |
|---|---|
| `pnpm dev` | Web app on :5173 |
| `pnpm test` | Vitest across the workspace |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm build` | Build every package |

## Documentation

- [docs/PLAN.md](docs/PLAN.md) — the spec: data model, splitting algorithm, wizard flow, build stages
- [docs/decisions/](docs/decisions/README.md) — ADRs recording why each structural choice was made
- [AGENTS.md](AGENTS.md) — guidance for AI agents working in this repo

## Stack

TypeScript throughout. A pure, headless `core` package holds all thread logic, with the
React + Vite web app as its first adapter — so a CLI or desktop version can reuse it
unchanged. Threads and assets are stored as plain JSON and real files under `~/threader/`.
