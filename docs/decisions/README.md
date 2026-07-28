# Architecture Decision Records

One file per decision, numbered, never edited after acceptance — superseded instead.
Format: Context → Decision → Consequences. If a decision turns out wrong, add a new ADR
that supersedes it and mark the old one `Superseded by ADR-NNNN`.

| # | Title | Status |
|---|---|---|
| [0001](0001-local-first-web-app-with-reusable-core.md) | Local-first web app with a headless reusable core | Accepted |
| [0002](0002-manual-publish-wizard-not-api.md) | Publish via a manual guided wizard, not the X API | Accepted |
| [0003](0003-numbering-is-derived-never-stored.md) | Numbering is derived at render time, never stored in post text | Accepted |
| [0004](0004-compose-vs-arrange-one-way-detach.md) | Compose → Arrange is one-way, guarded by a `detached` flag | Accepted |
| [0005](0005-plain-json-files-via-thin-local-server.md) | Plain JSON files on disk, served by a thin local server | Accepted |
| [0006](0006-pluggable-weighted-character-counting.md) | Character counting is pluggable and platform-weighted | Accepted |
| [0007](0007-publish-runs-are-resumable-and-persisted.md) | Publish runs are persisted after every step | Accepted |
| [0008](0008-pnpm-workspaces.md) | pnpm workspaces as the package manager | Accepted |
