# ADR-0003 — Numbering is derived at render time, never stored in post text

**Status:** Accepted · 2026-07-27

## Context

Manual numbering is one of the two problems the tool exists to solve. Numbers typed into
the text go stale the instant a post is added, merged, or reordered — which is exactly what
editing a thread consists of.

## Decision

`Post.text` holds the body only. Numbering lives in the profile's `NumberingConfig`
(format, prefix/suffix, separator, whether post 1 and the closing post are numbered) and is
applied by `renderPost(post, index, total, profile)`.

That rendered string — not `Post.text` — is what the character counter measures and what
the publish wizard copies to the clipboard.

## Consequences

- Wrong or missing numbers become structurally impossible rather than merely unlikely.
  Reordering is free.
- Numbering style is a per-profile setting, so different accounts can use `1/12`, `🧵1/12`,
  `1.`, or nothing at all over identical text.
- The numbering suffix consumes characters, so the splitter must reserve its length from
  the budget — and the width of `{total}` depends on the number of posts, which depends on
  the budget. Resolved with a bounded fixpoint loop (see ADR-0006).
- Pasted text that already contains `1/`, `2/` markers is *not* stripped automatically;
  doing so would be too clever and would corrupt legitimate content like `3/4 of users`.
  A Stage 9 lint warning can flag the likely case instead.
