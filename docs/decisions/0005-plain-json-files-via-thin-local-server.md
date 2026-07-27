# ADR-0005 — Plain JSON files on disk, served by a thin local server

**Status:** Accepted · 2026-07-27

## Context

Options were browser `localStorage`/IndexedDB (no backend, but assets become base64 blobs
and a future CLI cannot see anything without an export step), the File System Access API
(no server, but Chrome-only and re-prompts every session), or real files behind a small
local server.

Threads have image and video attachments, and the core is meant to be reusable by a CLI or
desktop app later (ADR-0001) — both point at real files.

## Decision

Storage is plain JSON plus real asset files under `THREADER_HOME` (default `~/threader/`):

```
profiles/<slug>.json
threads/<yyyy-mm-dd>-<slug>/thread.json + assets/
library/<profile>/
```

A ~150-line local server (`apps/server`) does file I/O, asset upload/serving, and the one
OS integration the browser cannot do: reveal-in-Finder. It binds to `127.0.0.1` only.
Access goes through a `Storage` interface, with `MemoryStore` for tests.

## Consequences

- Greppable, diffable, `git init`-able thread history. Survives the app being abandoned.
- A future CLI reads the same files with no migration or export.
- Images are files you can drop in from Finder, not base64 strings in a browser database.
- Cost: the app is no longer a static page — it needs a process running. Acceptable for a
  local-first tool that is already started from a terminal.
- **Security constraint:** the `reveal` endpoint resolves its path and refuses anything
  outside `THREADER_HOME`. Asset serving is likewise allowlisted to that root. This is the
  one place a thin local server could otherwise become a real hole, and it must be tested.
