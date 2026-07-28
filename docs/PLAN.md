# Threader — MVP Plan

A local-first tool for composing, splitting, numbering, and **publishing** X threads,
where publishing is a guided step-by-step wizard rather than an automated post.

---

## 1. Problems being solved

| Problem | Solution in scope |
|---|---|
| People reply to post 1 or 2 while the thread is still going out | Closing post that asks readers to repost **the first post**, with its real URL captured during publishing |
| Manual numbering is tedious and error-prone | Numbering is derived, never typed. Reorder/merge/split and it renumbers itself |
| Splitting text by hand, counting characters | Auto-split with manual override |
| Publishing is 20 minutes of copy → switch → paste → find the image → repeat | A wizard that hands you one thing at a time, in order, already on the clipboard |
| Different accounts need different voice, numbering, CTAs | Profiles |

The reasoning behind each structural choice lives in [`docs/decisions/`](decisions/README.md)
as ADRs; this document describes *what* is being built, the ADRs record *why*.

**Design stance: reverse centaur, inverted.** The machine does the mechanical work
(counting, numbering, sequencing, clipboard, bookkeeping). The human does the judgment
(wording, splits, whether the post is good, hitting Post). The wizard never acts on the
network — it only ever prepares the next thing and waits.

---

## 2. Architecture

> ADR-0001

The core is a pure TypeScript library with **no DOM and no Node APIs**, so the same logic
backs the local web app now and a CLI, Tauri app, or hosted service later.

```
threader/
├── packages/
│   ├── core/        pure TS — split, number, render, templates, validate
│   └── store/       Storage interface + FsStore (Node) [+ MemoryStore for tests]
├── apps/
│   ├── web/         React + Vite + TypeScript (the only UI in the MVP)
│   └── server/      ~150 lines of node:http: files, assets, OS integrations
└── docs/
    ├── PLAN.md
    └── decisions/   ADRs — one file per decision, numbered, superseded not edited
```

Rules that keep the core reusable:

- `core` exports **pure functions over plain data**. No React, no `fs`, no `window`.
- Anything platform-specific enters through an interface: `Storage`, `Clipboard`, `Shell`.
- The web app is the first *adapter*, not the home of the logic. Splitting bugs get fixed
  in `core` with a unit test, not in a component.
- Publishing is behind a `Publisher` interface from day one, with `ManualPublisher`
  (the wizard) as the only implementation. An `XApiPublisher` can be added later without
  touching the editor.

**Why a server at all:** browsers can't write to `~/threader/`, can't reveal a file in
Finder, and can't reliably put a video on the clipboard. The server is thin and dumb —
it does file I/O and shells out. All thread logic stays in `core`.

---

## 3. Data model

> ADR-0003

```ts
type Thread = {
  id: string
  profileId: string
  title: string              // for the thread list, not published
  source: string             // the original blob of text
  detached: boolean          // true once posts were edited individually
  posts: Post[]
  closing: ClosingPost | null
  publishRun: PublishRun | null
  createdAt: string
  updatedAt: string
}

type Post = {
  id: string
  text: string               // body ONLY — numbering is never stored in text
  assets: AssetRef[]
  locked: boolean            // reflow must not touch this post
  published: { url: string; at: string } | null
}

type ClosingPost = {
  templateId: string | null  // which profile template it came from
  text: string               // resolved text, still containing {{url}} until publish
  assets: AssetRef[]
  published: { url: string; at: string } | null
}

type AssetRef = {
  id: string
  path: string               // relative to the thread folder, or to the profile library
  kind: 'image' | 'gif' | 'video'
  alt?: string
}

type PublishRun = {
  startedAt: string
  cursor: number             // -1 = not started, n = at post n, posts.length = closing
  firstPostUrl: string | null
  completedAt: string | null
}

type Profile = {
  id: string
  name: string               // "Main", "Company"
  handle: string             // "@matiasbaldanza"
  platform: 'x' | 'bluesky' | 'mastodon' | 'custom'
  charLimit: number          // 280 | 25000 | custom
  numbering: NumberingConfig
  closingTemplates: ClosingTemplate[]
  style: StyleRules          // stage 3
  libraryPath: string | null // stage 4
}

type NumberingConfig = {
  format: string             // "{n}/{total}", "🧵{n}/{total}", "{n}.", ""
  position: 'prefix' | 'suffix'
  separator: string          // "\n\n" for suffix, " " for prefix
  includeFirst: boolean      // some people leave post 1 unnumbered
  includeClosing: boolean
  endMarker: string          // "EOF" | "FIN" | "" — suffix on the LAST post (§5)
  endMarkerSeparator: string // " " by default
}

type ClosingTemplate = {
  id: string
  label: string              // "Repost ask", "Newsletter", "Follow"
  body: string               // supports {{url}} {{handle}} {{count}} {{title}}
}
```

Numbering lives in `NumberingConfig`, never in `Post.text`. Rendering is
`renderPost(post, index, total, profile) → string`, and that rendered string is what the
character counter measures and what the wizard copies. This is the single change that
makes "I missed the order" structurally impossible.

---

## 4. Splitting

> ADR-0004, ADR-0006

### Algorithm

1. **Normalize** — trim trailing whitespace, collapse 3+ blank lines to 2.
2. **Honor forced breaks** — a line containing only `---` is an explicit break the
   splitter must never cross or remove. This is the escape hatch for "I know where this
   should break."
3. **Greedy pack with descending break preference** within each segment:
   paragraph (`\n\n`) → sentence (`. ! ? …` + space, with an abbreviation guard) →
   line → word. Never split inside a URL, an `@handle`, or a `#hashtag`.
4. **Reserve the numbering budget** — the effective limit for each post is
   `charLimit − len(renderNumbering(n, total)) − len(separator)`.
5. **Fixpoint pass** — total post count affects the numbering width (`9/9` vs `9/12`),
   which affects the budget, which can affect the count. Re-run until stable, max 3
   iterations, then accept.

### Counting

X does not count characters naively, and getting this wrong means the post is rejected at
paste time — the single most annoying possible failure for this tool.

- URLs count as a flat 23 characters regardless of actual length (t.co wrapping).
- CJK and several other ranges count as 2.
- Counting uses NFC-normalized code points, not UTF-16 units — emoji are 2, not 4+.

Therefore `countChars` is a **pluggable, per-platform function** in `core`, with the
weighted X implementation as the default and a unit test suite of known-tricky strings.
Bluesky/Mastodon get simple graphemes.

### Compose vs. Arrange — the one real design tension

Two modes over the same thread:

- **Compose** — one big textarea. Splits recompute live as you type. Truth lives in `source`.
- **Arrange** — a column of post cards. Per-post editing, reordering, merging. Truth lives in `posts`.

The moment you edit an individual post, `detached` flips to `true`. From then on,
"Re-split from source" is a destructive action behind a confirm dialog. Individually
`locked` posts survive a reflow untouched.

The alternative — trying to keep `source` and `posts` bidirectionally in sync — is where
this class of tool usually dies. One-way with an explicit detach flag is the honest model.

### Arrange-mode operations

| Operation | Behavior |
|---|---|
| Split at cursor | Post becomes two; everything renumbers |
| Merge with next | Concatenated with `\n\n`; flagged red if over limit — allowed but blocked from publish |
| Move up / down | Drag or ⌘↑/⌘↓ |
| Delete | With undo |
| Lock | Excluded from reflow |
| Reflow from here | Re-pack this post and everything after it, leaving earlier posts alone |
| Add asset | Drop a file onto the card |

Every card shows a live counter of the **rendered** length (numbering included) and turns
red over the limit. The publish button is disabled while any post is over.

---

## 5. How a thread ends

Not every thread wants a call to action. A stream-of-thought thread that ends by asking for
a repost reads like an ad. So "ending" is a per-thread choice between three kinds, drawn
from profile settings:

| Ending | Adds a post? | For |
|---|---|---|
| **Marker** | No | Stream-of-thought. The last post's numbering becomes `12/12 EOF` |
| **Repost ask** | Yes | The default. Points readers back at post 1 |
| **Any other CTA** | Yes | Newsletter, follow, product — pre-worded per profile |

The last two are the same mechanism — a closing post built from a template — and are
described below. The first is not a post at all, which is what makes it different in kind.

### Marker endings

An end marker is a suffix on the **last post's numbering**, not a separate post:
`12/12 EOF`. The marker is a profile setting (`EOF`, `FIN`, `∎`, `— fin`, whatever you
like), so it becomes part of an account's voice rather than something retyped per thread.

It belongs in `NumberingConfig` because it is numbering — derived at render time, never
stored in `Post.text` (ADR-0003). Reorder the thread and the marker follows whichever post
is now last, which is the whole reason not to type it by hand.

```ts
type NumberingConfig = {
  // …
  /** Appended to the final post's numbering when the thread has no closing post. */
  endMarker: string        // "EOF" | "FIN" | "" (default)
  endMarkerSeparator: string   // " " by default
}
```

**Watch the budget.** The marker costs characters, and only on the last post — but which
post is last is not known until splitting has finished, and adding the marker can push that
post over the limit and cause a further split, which changes which post is last. The
existing fixpoint loop in `split()` already iterates on total; the marker has to be folded
into `numberingOverhead` for the final index so it is reserved rather than discovered
afterwards. Test this specifically: a thread that fits in exactly N posts without a marker
and N+1 with one.

### Closing posts

Built from a profile template, chosen per thread, editable inline. The default:

```
If this was useful, the best thing you can do is repost the first post 🙏

{{url}}
```

`{{url}}` is unresolvable until post 1 is actually live — which is exactly why URL capture
is step one of the wizard and not an afterthought. In the editor the closing post renders
with a placeholder chip where the URL will go, and its character count reserves 23 chars
for it.

Other templates worth shipping as defaults: newsletter CTA, follow CTA, recap + repost ask.

A thread has **either** a closing post **or** an end marker, never both — a marker means
"this is the end", and a closing post already is the end. When a closing post exists, the
marker is simply not rendered.

---

## 6. The publish wizard

> ADR-0002, ADR-0007

Full-screen, one step at a time, keyboard-driven (`Enter` = next, `⌘C` = re-copy).

**Per post `n`:**

1. **Text** — rendered post with its numbering, shown exactly as it will appear.
   Auto-copied to clipboard on entering the step; a "Copied ✓" state and a re-copy button.
2. **Assets** — one card per asset, in order, each with:
   - *Copy image* (`navigator.clipboard.write`, PNG/JPEG)
   - *Reveal in Finder* (server shells `open -R`) — the fallback, and the only option for
     video, which cannot be put on a browser clipboard
   - Alt text shown for you to copy separately
   - A checkbox per asset so you don't lose your place at 4 images
3. **Confirm** — "Posted?" plus a URL field with a Paste button. Validation: must look like
   `x.com/<handle>/status/<id>`, warns (does not block) if the handle doesn't match the
   profile. The status ID is extracted and stored.
4. Persist immediately, advance the cursor.

**Post 1** additionally sets `publishRun.firstPostUrl`, which unlocks the closing post.

**Final step** — closing post with `{{url}}` now resolved, copy, capture its URL, done.
Summary screen: thread marked published, every post URL listed, one-click copy of post 1's
URL for sharing elsewhere.

**Resumability** — `publishRun` is written to disk after every single step. Close the tab
at post 7, reopen, the thread list shows "Publishing · 7/14" and resumes exactly there.
You also get a permanent record of every post URL, which is genuinely useful later.

A "skip this post" and a "back" control both exist; going back does not un-publish
anything, it just lets you re-copy something you fumbled.

### ⚠️ Known blocker to resolve before Stage 7: X eats line breaks on paste

Observed in the X web composer (a regression from the 2024/25 redesign, still unfixed as of
July 2026): **pasting text collapses newlines into spaces.** Line breaks have to be
retyped by hand.

This is not a cosmetic problem for Threader — it defeats the copy step, which is the whole
point of the wizard:

- The numbering separator is `"\n\n"` by default, so `1/12` would land inline as
  `…end of the post 1/12` instead of on its own line.
- Every paragraph break *inside* a post is lost, so a two-paragraph post arrives as one
  slab.
- It fails silently. The paste looks like it worked, and you would only notice after
  posting.

**Investigate before building the copy step**, roughly in order of promise:

1. **Write `text/html` alongside `text/plain`.** `navigator.clipboard.write()` can carry
   several flavours; the composer is a `contenteditable`, so it may honour an HTML flavour
   with `<br>` or `<div>` where it flattens plain text. Most likely fix, and cheap to test.
2. **Check whether the loss is on copy or on paste.** Paste the same text into a plain
   textarea to confirm the newlines survive the clipboard — that tells us whether this is
   ours to fix at all.
3. **Try `\r\n` and ` `** as separators; some editors treat them differently.
4. **Synthetic typing** into the composer — rejected in advance unless everything else
   fails; it means driving X's DOM, which is fragile and against the spirit of ADR-0002.

**If none of them work**, the fallbacks are all honest but worse, and the choice is the
user's, not ours to make silently:

- Make the numbering separator `" "` for X profiles, so numbering at least reads correctly
  inline. `NumberingConfig.separator` already supports this — no code change, just a
  default.
- Have the wizard **warn on any post containing a newline** and show exactly where the
  breaks need retyping, so the manual fix-up is guided rather than remembered.
- Copy each paragraph as its own clipboard step, the way assets are handled.

Worth re-testing on the day: X ships composer changes often, and this may simply be fixed
by then.

---

## 7. Storage layout

> ADR-0005

```
~/threader/
├── profiles/
│   ├── main.json
│   └── company.json
├── threads/
│   └── 2026-07-27-reverse-centaurs/
│       ├── thread.json
│       └── assets/
│           ├── meme-01.png
│           └── demo.mp4
└── library/
    └── main/            # profile asset library (stage 4)
        └── memes/
```

Plain JSON and plain files. Readable by a future CLI without an export step, greppable,
`git init`-able if you want thread history, and survivable if this app is ever abandoned.
Root path is configurable via `THREADER_HOME`.

### Server API

```
GET    /api/profiles                    PUT /api/profiles/:id
GET    /api/threads                     GET/PUT/DELETE /api/threads/:id
POST   /api/threads/:id/assets          multipart upload → assets/
GET    /api/assets/*                    serve a local file
POST   /api/shell/reveal                { path } → open -R   (allowlisted to THREADER_HOME)
```

Binds to `127.0.0.1` only. The `reveal` endpoint takes a path, resolves it, and refuses
anything outside `THREADER_HOME` — the one place where a thin local server could otherwise
become a real hole.

---

## 8. Build stages

Each stage is a working app and a sensible commit. Nothing later is a prerequisite for
using what came before.

**Stage 0 — Scaffold.** ✅ pnpm workspace, `core` / `store` / `web` / `server`, TypeScript
strict, Vitest, one passing test. *Commit: scaffold.*

**Stage 1 — The core, headless.** ✅ `countChars`, `split`, `renderNumbering`, `renderPost`,
`renderThread`. Tests covering: URLs, emoji, forced breaks, the numbering fixpoint,
long unbreakable tokens. No UI at all yet — this is the piece everything else rests on.
*Commit: core splitting + numbering.*

**Stage 2 — Compose mode.** ✅ Textarea on the left, live post preview on the right,
hardcoded 280 limit and `{n}/{total}` numbering. Nothing persists yet. This is the first
moment the tool is actually useful. *Commit: compose view.*

**Stage 3 — Arrange mode.** ✅ Post cards, split/merge/reorder/lock/delete, the `detached`
flag and its confirm dialog, per-card counters. *Commit: manual split editing.*

**Stage 4 — Persistence.** ✅ `Storage` interface, `FsStore`, the server, thread list,
autosave. *Commit: local file storage.*

**Stage 5 — Profiles, minimal.** ✅ Char limit + numbering config + handle. Profile picker on
each thread. *Commit: profiles.*

**Stage 6 — Endings.** The three ending kinds (§5): end markers in `NumberingConfig` with
their budget reservation, closing-post templates on the profile, per-thread selection, and
placeholder rendering with its 23-char reservation. *Commit: thread endings.*

**Stage 7 — The publish wizard.** `Publisher` interface, `ManualPublisher`, step machine,
clipboard, URL capture and validation, resumable `publishRun`, summary screen.
**This is the payoff stage.** *Commit: publish wizard.*

> **Start this stage by settling the line-break problem** (§6). X's composer collapses
> pasted newlines into spaces, which breaks both the numbering separator and any paragraph
> inside a post. Spike the `text/html` clipboard flavour before building the step machine —
> the answer changes what the copy step has to do, and possibly the default separator.

**Stage 8 — Assets.** Drag-drop onto post cards, upload endpoint, thumbnails, alt text,
copy-image and reveal-in-Finder inside the wizard. *Commit: assets.*

> **Folder renames now move assets too.** Deliberately editing a thread's title renames
> its folder (decided in Stage 4, since doing it before assets existed cost nothing).
> Once `assets/` lives inside that folder, `renameThread` must keep asset paths working
> — they are stored relative to the thread folder, so a plain directory rename should be
> enough, but verify it and add a test. Note the rename fires only on explicit title
> edits, never on the title auto-following the draft's first line.

**Stage 9 — Style rules.** Per-profile lint, advisory only, never auto-rewriting: emoji
density, hashtag policy, sign-off presence, hook-post reminder, "post 1 has no link"
(links in post 1 suppress reach). Warnings on cards, never blocking. *Commit: style lint.*

**Stage 10 — Asset library.** Per-profile meme folder, searchable picker, reuse across
threads. *Commit: asset library.*

A reasonable stopping point for "this already changed my life" is **Stage 7**.

---

## 9. Explicitly out of scope for the MVP

Scheduling · analytics · X API posting · multi-user/auth · AI-assisted rewriting or
thread generation · cross-posting to other platforms in one run · mobile UI ·
image editing/meme generation · collaborative editing.

Each is deliberately excluded, and the architecture doesn't preclude any of them —
particularly API posting (a second `Publisher`) and cross-posting (a second `Profile`
with its own limit, rendering the same `posts` differently).

---

## 10. Open questions, deferred on purpose

1. **Quote-tweet threads** — some people chain quote-tweets rather than replies. Different
   URL bookkeeping. Ignored for now; ask again after using the wizard a few times.
2. **Auto-detecting the URL from the clipboard** — polling the clipboard is creepy and
   permission-heavy. Manual paste for now.
3. **Where the hook post fits** — whether post 1 should be separately authored rather than
   just being the first slice of the text. Likely a Stage 9 style rule, possibly its own
   field later.
4. **Editing an already-published thread** — currently unsupported; published threads are
   read-only archives. Revisit if it bites.
5. **Whether `\n\n` survives a paste into X at all** — see the blocker in §6. If it turns
   out newlines can never survive, the whole layout vocabulary shrinks: paragraph breaks
   inside a post stop being expressible, which affects the splitter's break preference
   (paragraphs would no longer be worth preferring over sentences) as well as the wizard.
   Do not act on this until it is actually measured.
