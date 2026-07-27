# ADR-0001 — Local-first web app with a headless reusable core

**Status:** Accepted · 2026-07-27

## Context

The tool is needed as a local web app today, but the same logic plausibly wants to run in a
terminal CLI, a Tauri/Electron desktop app, or a deployed service later. Rewriting the
splitting and numbering rules per surface would guarantee they drift apart, and those rules
are the entire value of the tool.

## Decision

`packages/core` is pure TypeScript with **no DOM and no Node APIs** — plain functions over
plain data. Everything platform-specific enters through an interface (`Storage`,
`Clipboard`, `Shell`, `Publisher`). The React web app is the first *adapter*, not the home
of the logic.

Workspace layout: `packages/core`, `packages/store`, `apps/web`, `apps/server`.

## Consequences

- A splitting bug is fixed in `core` with a unit test, not in a component. Every future
  surface inherits the fix.
- `core` is testable in Vitest with no browser, no jsdom, no fixtures on disk.
- Cost: a monorepo and interface boilerplate on day one, for a single-surface MVP. Accepted
  deliberately — the boilerplate is small and retrofitting it after the UI exists is not.
- Temptation to put "just this one thing" in a component must be resisted; the rule is that
  anything that transforms thread data belongs in `core`.
