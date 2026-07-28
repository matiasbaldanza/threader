# AGENTS.md

Guidance for AI agents working in this repository.

## What this is

**Threader** — a local-first tool for composing, splitting, numbering, and publishing X
threads. Publishing is a guided manual wizard, never an API call.

Read [`docs/PLAN.md`](docs/PLAN.md) before doing anything substantial. It is the spec:
data model, splitting algorithm, wizard flow, and the staged build order.
Read [`docs/decisions/`](docs/decisions/README.md) for *why* things are the way they are.

## Design stance

Reverse centaur, inverted. The machine does the mechanical work — counting, numbering,
sequencing, clipboard, bookkeeping. The human keeps the judgment and the act of publishing.
When a feature could either automate a decision or make a decision cheaper to make, make it
cheaper. Do not add AI rewriting, auto-posting, or "smart" content changes.

## Repository layout

```
packages/core/     pure TS — split, number, render, templates, validate
packages/store/    Storage interface + FsStore + MemoryStore
apps/web/          React + Vite + TypeScript (the only UI in the MVP)
apps/server/       thin local server: file I/O, assets, reveal-in-Finder
docs/PLAN.md       the spec
docs/decisions/    ADRs
```

## Tooling

**pnpm only** — never `npm` or `yarn` in this repo (ADR-0008). A stray `npm install`
creates a second lockfile and breaks the strict `node_modules` layout that keeps `core`
honest.

```bash
pnpm install            # all workspace projects
pnpm dev                # web app on :5173
pnpm test               # vitest, whole workspace
pnpm typecheck          # tsc --noEmit, every package
pnpm --filter @threader/core test   # one package
```

Internal dependencies use `workspace:*`. A dependency needing an install script must be
added explicitly to `pnpm.onlyBuiltDependencies` in the root `package.json`.

## Hard rules

1. **`packages/core` stays pure.** No DOM, no Node APIs, no React, no `fs`, no `window`.
   Platform specifics enter through interfaces: `Storage`, `Clipboard`, `Shell`, `Publisher`.
2. **Anything that transforms thread data belongs in `core`**, with a unit test — not in a
   component. If you are tempted to put "just this one thing" in the UI, don't.
3. **Numbering is never stored in `Post.text`.** It is derived at render time from the
   profile's `NumberingConfig`. See ADR-0003.
4. **Never use `text.length` for character limits.** Use `countChars` from `core`. X counts
   URLs as a flat 23 and CJK as 2, and `.length` is UTF-16 units. See ADR-0006.
5. **The server never touches thread logic.** File I/O and shelling out only.
6. **Path guard:** any server endpoint taking a path resolves it and refuses anything
   outside `THREADER_HOME`. Bind to `127.0.0.1` only.
7. **No network calls to X.** Publishing prepares things for the human and waits.

## Working style

- The project is built in numbered stages (see PLAN.md §8). Each stage is a working app and
  one commit. Do not skip ahead or bundle stages unless asked.
- The user makes the commits. Do not commit or push unless explicitly asked.
- Prefer a small, boring, well-tested `core` over clever UI.
- Splitting and counting are test-driven. New edge case → new test in `packages/core`, then
  the fix.

## Decisions

Structural decisions get an ADR in `docs/decisions/`, numbered, in Context → Decision →
Consequences form. ADRs are not edited after acceptance — write a new one that supersedes
the old and mark the old `Superseded by ADR-NNNN`. Add a row to the index table in
`docs/decisions/README.md`.

If you are about to make a choice that would be expensive to reverse, write the ADR.
