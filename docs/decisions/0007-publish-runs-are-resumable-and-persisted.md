# ADR-0007 — Publish runs are persisted after every step

**Status:** Accepted · 2026-07-27

## Context

Because the wizard is manual (ADR-0002), publishing a long thread takes several minutes of
tab-switching between the app and X. A crash, an accidental close, or an interruption
partway through would otherwise mean restarting a run whose first eight posts are already
public — the one state the tool must never leave you in.

## Decision

`Thread.publishRun` (`cursor`, `firstPostUrl`, `startedAt`, `completedAt`) and each post's
`published: { url, at }` are written to disk after **every** wizard step, not at the end.

Reopening the app shows "Publishing · 7/14" in the thread list and resumes at exactly that
step. Going back is allowed and does not un-publish anything — it only lets you re-copy
something you fumbled.

## Consequences

- Interruption costs nothing.
- Side benefit that justifies the design on its own: every thread ends up with a permanent
  record of each post's URL. That is useful long after publishing — for linking back,
  quoting yourself, or checking what you actually said.
- Post 1's URL is captured first and stored separately, which is what unlocks the closing
  post's `{{url}}` placeholder — the mechanism that solves the "people reply to post 1 too
  early" problem this whole tool was built for.
- Cost: a write per step, and `publishRun` has to be reconciled if posts are edited
  mid-run. Resolved simply — a thread with an active `publishRun` is read-only in the
  editor until the run completes or is explicitly abandoned.
