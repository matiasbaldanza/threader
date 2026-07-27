# ADR-0002 — Publish via a manual guided wizard, not the X API

**Status:** Accepted · 2026-07-27

## Context

The app could post threads itself through the X API, or it could walk the human through
posting them. Write access to the X API costs $100+/month, requires OAuth per account, and
is subject to rate limits and policy changes outside our control. It also removes the
last-second review that catches a bad line before it is public.

The stated goal is the inverse of a reverse centaur: the machine does the mechanical work
(counting, ordering, clipboard, bookkeeping), the human keeps the judgment and the act of
publishing.

## Decision

Publishing is a step-by-step wizard that prepares one thing at a time — post text on the
clipboard, then each asset, then a field to paste back the resulting URL — and never
touches the network.

`Publisher` is an interface from the start. `ManualPublisher` is its only implementation in
the MVP; an `XApiPublisher` can be added later without touching the editor.

## Consequences

- Zero cost, no API keys, no rate limits, works with any account including ones we do not
  own, immune to API policy changes.
- Every post gets a human look immediately before it goes out.
- Publishing a 15-post thread still requires 15 human interactions. The wizard makes each
  one a single keystroke, but it does not make them disappear.
- Post URLs must be captured by hand. This is unavoidable without the API, and it is also
  what makes ADR-0007 (persisted publish runs) worth the effort.
