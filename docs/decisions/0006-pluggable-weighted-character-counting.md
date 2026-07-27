# ADR-0006 — Character counting is pluggable and platform-weighted

**Status:** Accepted · 2026-07-27

## Context

`text.length` is wrong for X in at least three ways, and each one produces the worst
possible failure mode for this tool: a post the app said was fine gets rejected at paste
time, mid-publish, after the previous posts are already live.

- URLs count as a flat 23 characters regardless of length (t.co wrapping) — so the app
  *overcounts* long links and splits more than necessary.
- CJK and several other Unicode ranges count as 2.
- JavaScript's `.length` is UTF-16 units, so an emoji reads as 2–7 instead of 2.

Other platforms count differently again (Bluesky: 300 graphemes; Mastodon: 500, links
capped at 23).

## Decision

`countChars(text, platform)` is a pluggable function in `core`. The weighted X
implementation is the default; simple grapheme counting backs the others. Character limit
is a per-profile setting, so one account can be 280 and another 25 000.

It ships with a unit test suite of known-tricky strings: bare URLs, URLs with query
strings, emoji with ZWJ sequences and skin-tone modifiers, CJK, RTL text, and combining
marks.

Splitting reserves `charLimit − len(numbering) − len(separator)` per post, and because the
width of `{total}` depends on the post count which depends on the budget, it iterates to a
fixpoint (max 3 passes, then accepts).

## Consequences

- Counts match what X will actually accept, which is the difference between the tool being
  trustworthy and being a liability halfway through a thread.
- Adding Bluesky or Mastodon later is a counting function and a profile field, not a
  rewrite.
- Cost: the weighted counter is the fiddliest code in `core` and must be test-driven. This
  is where bugs will live, so that is where the tests go.
