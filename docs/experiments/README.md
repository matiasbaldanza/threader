# Experiments

Small, self-contained pages used to answer a question the code could not answer on its
own. Kept after the fact rather than deleted — the reasoning is worth as much as the
result, and a question that came back once can come back again.

Serve them over localhost rather than opening from `file://`, because clipboard and
permission APIs behave differently on an opaque origin:

```bash
python3 -m http.server 8000 --directory docs/experiments
```

---

## clipboard-line-breaks.html — does X keep pasted line breaks?

**Asked:** 2026-07-28 · **Answered:** 2026-07-29

### The question

Line breaks pasted into X's web composer were reported as collapsing into spaces. If true,
that defeated the publish wizard's copy step: Threader's numbering separator is a blank
line, so `1/12` would land inline, and any paragraph inside a post would arrive as one
slab. Worse, it fails silently — the paste looks right, and you only find out after
posting.

Serious enough that [PLAN.md](../PLAN.md) made it a blocker to resolve *before* building
Stage 7, since the answer changed what the copy step had to do and possibly the default
numbering separator.

### The method

The page writes the same Threader-shaped sample — two paragraphs and a numbering suffix —
to the clipboard eight ways, then you paste each into X and record whether the blank line
survived:

| | Payload |
|---|---|
| **A** | `text/plain` only, with `\n\n` |
| B | `text/plain` + `text/html` using `<br><br>` |
| C | `text/plain` + `text/html` using `<div>` blocks |
| D | `text/plain` + `text/html` using `<p>` paragraphs |
| E | `text/html` **only** — tests whether X prefers plain when both are present |
| F | `text/plain` with `\r\n` line endings |
| G | `text/plain` + `text/html` wrapped in `white-space: pre-wrap` |
| H | `text/plain` using U+2028 LINE SEPARATOR |

It also has a local paste area. That step matters: if breaks survive locally but not in X,
the loss is inside X's paste handler and no clipboard format can fix it — the difference
between a bug we can fix and one we can only work around.

### The result

**Variant A worked perfectly.** Plain text with `\n\n` pastes into X's composer with its
line breaks intact. Nothing more exotic is needed.

So either X has fixed the regression, or the original loss came from somewhere other than a
plain-text clipboard write — copying rendered text out of a web page, for instance, puts
`text/html` on the clipboard too, and that is a different paste path entirely.

### What changed because of it

- `apps/web/src/clipboard.ts` writes **`text/plain` only**. It had been writing an HTML
  flavour alongside, on the theory that a `contenteditable` which flattens plain text might
  honour block elements. With plain text verified to work, the HTML flavour is unnecessary
  — and not harmless, since it gives the composer a second, untested path to prefer.
- The publish wizard no longer warns on every post containing a newline. That warning was
  written for a problem that does not reproduce, and it would have fired on nearly every
  post.
- The blocker in [PLAN.md §6](../PLAN.md) is resolved.

### If it comes back

Re-run the page. If A now fails, work down the list — B, C, D and G are all one-line
changes to `toHtml()` in `clipboard.ts`, which is why the shape of that function is worth
remembering even though nothing calls it today. If nothing works, the fallbacks are in
PLAN.md §6: set the profile's numbering separator to a space, and have the wizard flag
posts containing newlines so the retyping is guided rather than remembered.
