# ADR-0004 — Compose → Arrange is one-way, guarded by a `detached` flag

**Status:** Accepted · 2026-07-27

## Context

The thread exists in two representations: `source` (one blob of text you wrote) and `posts`
(the split result you then tweak individually). Keeping both editable and in sync
bidirectionally requires mapping arbitrary per-post edits back onto source offsets. This is
where tools of this kind usually collapse — either edits get silently lost on the next
reflow, or the sync logic becomes the largest and buggiest part of the codebase.

## Decision

Two explicit modes over one thread:

- **Compose** — a single textarea; splits recompute live; truth lives in `source`.
- **Arrange** — post cards; per-post editing, split, merge, reorder; truth lives in `posts`.

Editing an individual post sets `thread.detached = true`. From then on, "Re-split from
source" is a destructive action behind a confirm dialog. Individual posts can be `locked`
so a partial reflow leaves them untouched.

## Consequences

- Data loss is possible only through an explicit, named, confirmed action.
- The model is easy to explain in one sentence, and easy to reason about while debugging.
- Cost: after detaching, the original blob is no longer the working copy. Fixing a typo
  "at the source" means fixing it in a card. Acceptable — that is where the text lives once
  you have shaped it.
- `Reflow from here` (re-pack this post and everything after it) covers most of what
  bidirectional sync would have bought, at a fraction of the complexity.
