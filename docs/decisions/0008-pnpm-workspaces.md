# ADR-0008 — pnpm workspaces as the package manager

**Status:** Accepted · 2026-07-27

## Context

ADR-0001 commits to a multi-package repo — a headless `core`, a `store`, and one adapter
per surface. That needs a workspace-aware package manager. The choice affects every
install, script, and CI step from Stage 0 onward, and switching later means regenerating
lockfiles and rewriting scripts across every package.

## Decision

**pnpm** is the package manager. npm and yarn are not used; there is one lockfile,
`pnpm-lock.yaml`.

- Workspace members are declared in `pnpm-workspace.yaml` (`packages/*`, `apps/*`).
- Internal dependencies use the `workspace:*` protocol, so they always resolve to the local
  package and can never silently pull a published one.
- The root `package.json` pins `packageManager` and `engines.pnpm`.
- Cross-package commands go through `pnpm -r` / `pnpm --filter`.

## Consequences

- Strict `node_modules` layout: a package can only import what it actually declares. This
  is what mechanically enforces ADR-0001's "`core` stays pure" — `core` cannot accidentally
  reach a React or Node type it never listed.
- Content-addressed store means fast installs and little disk duplication across the
  workspace.
- Cost: contributors must have pnpm installed; `npm install` in this repo is wrong and will
  produce a second lockfile. Guarded by `packageManager` and `engines`, and stated in
  AGENTS.md and the README.
- pnpm 10 blocks dependency build scripts by default. Anything needing one must be listed
  explicitly under `pnpm.onlyBuiltDependencies` — a deliberate, visible allowlist rather
  than arbitrary install-time code execution.
