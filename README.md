# Threader

A local-first tool for writing X threads: paste your text, let it split and number itself,
then publish it through a step-by-step wizard that hands you one thing at a time.

**Status: Stage 3.** Compose and arrange both work — write a draft, watch it split and
number itself, then edit, split, merge, reorder and lock posts by hand. Nothing persists
yet; that is Stage 4.

## Why

- People reply to post 1 or 2 while the rest of the thread is still going out. Threader
  captures the first post's real URL during publishing and builds a closing post that asks
  readers to repost *that* one.
- Manual numbering goes stale the moment you reorder or merge anything. Here numbering is
  derived at render time, never typed — so it cannot be wrong.
- Publishing by hand is copy → switch tabs → paste → find the image → repeat. The wizard
  puts each post on your clipboard in order, offers its assets one at a time, and takes the
  resulting URL before moving on.

The machine does the mechanical work. You keep the judgment and the act of publishing —
Threader never posts anything itself.

## Features

- Auto-split with manual override — drag, merge, split, reorder, lock a post against reflow
- Correct character counting (URLs count as 23, CJK as 2, emoji as 2)
- Derived numbering, configurable per account (`1/12`, `🧵1/12`, `1.`, none)
- Profiles: character limit, numbering style, closing-post templates, voice rules, asset library
- Images, GIFs, and video attached per post
- A resumable publish wizard — close the tab at post 7, come back, resume at post 7
- A permanent record of every published post's URL

## Getting started

Requires **Node ≥ 22.13** and **pnpm ≥ 10** — pnpm only, not npm or yarn ([ADR-0008](docs/decisions/0008-pnpm-workspaces.md)).
The Node floor comes from pnpm 11's launcher, not from anything in this codebase. There is
an `.nvmrc`, so:

```bash
nvm use
```

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173.

| Command | Does |
|---|---|
| `pnpm dev` | Web app on :5173 |
| `pnpm test` | Vitest across the workspace |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm build` | Build every package |

## Using Threader

There is a `?` in the top bar that explains all of this inside the app. The short
version:

### Two ways to look at a thread

**Compose** is where you write *text* — one box for the whole thread. Threader splits and
numbers it as you type. Put `---` on its own line to force a break exactly where you want
one.

**Arrange** is where you handle *posts* — each one becomes its own editable card. Go here
when the automatic split got something almost right and you want to fix it by hand.

### The buttons on each post

| Button | What it does | When you'd reach for it |
|---|---|---|
| **Split here** | Breaks one post in two at your cursor | A break landed somewhere that reads badly, or a line deserves a post of its own |
| **Merge ↓** | Pulls the post below up into this one | A break wasn't earning its keep, or a post is too thin to stand alone |
| **Tidy ↓** | Pours this post and the ones below it back together and re-splits them evenly | After a few edits the posts have gone lumpy — one is 260 characters, the next is 40 |
| **Keep as is** | Protects a post from Tidy, and stops Tidy running past it | You deliberately left a one-line punchline short |
| **↑ ↓ ✕** | Move or delete a post | Numbering always follows |

Splitting mid-sentence and merging back gives you the sentence exactly as it was — the
seam does not become a paragraph break.

### Two things worth knowing

**Numbering is never yours to type.** It is added when the post is rendered, so it cannot
go stale. Reorder, split or merge freely and `1/9` fixes itself.

**Editing a post disconnects it from the draft.** Otherwise your next keystroke in Compose
would wipe out the edits you just made by hand. You can rebuild the posts from the draft
whenever you like — Threader asks first, because it throws those edits away.

**⌘Z undoes anything**, including a deleted post.

## Running the tests

Splitting and counting are the whole value of this tool, and both are test-driven — a new
edge case gets a test in `packages/core` before it gets a fix. Run everything from the repo
root:

```bash
pnpm test
```

```
 ✓ packages/core/src/factories.test.ts (3 tests) 4ms
 ✓ packages/core/src/count.test.ts (20 tests) 8ms
 ✓ packages/core/src/numbering.test.ts (13 tests) 5ms
 ✓ packages/store/src/index.test.ts (1 test) 4ms
 ✓ packages/core/src/split.test.ts (32 tests) 205ms

 Test Files  5 passed (5)
      Tests  69 passed (69)
```

That is the summary view — failures still print a full diff. To see every test name instead
of a per-file roll-up:

```bash
pnpm test:verbose
```

```
 ✓ packages/core/src/count.test.ts > countX — URLs > counts a bare domain as a URL — X auto-links it 0ms
 ✓ packages/core/src/count.test.ts > countX — weighted ranges > counts a ZWJ emoji sequence as a single emoji 0ms
 ✓ packages/core/src/split.test.ts > split — forced breaks > always starts a new post at --- 1ms
```

### Watch mode

Leave this open while working on `core` — it re-runs only the tests affected by each save:

```bash
pnpm test:watch
```

Press `a` to re-run everything, `f` to re-run only failures, `q` to quit.

### Browser UI

A test tree, per-test timings, rendered diffs, and a module graph, at
http://localhost:51204/__vitest__/:

```bash
pnpm test:ui
```

Both watch mode and the UI need an interactive terminal — they exit immediately if stdin
is not a TTY, so run them yourself rather than from a script or CI step.

### Running part of the suite

Filter by file path:

```bash
pnpm vitest run split
```

Filter by test name, across all files:

```bash
pnpm vitest run -t "emoji"
```

One package only:

```bash
pnpm vitest run packages/core
```

## Documentation

- [docs/PLAN.md](docs/PLAN.md) — the spec: data model, splitting algorithm, wizard flow, build stages
- [docs/decisions/](docs/decisions/README.md) — ADRs recording why each structural choice was made
- [AGENTS.md](AGENTS.md) — guidance for AI agents working in this repo

## Stack

TypeScript throughout. A pure, headless `core` package holds all thread logic, with the
React + Vite web app as its first adapter — so a CLI or desktop version can reuse it
unchanged. Threads and assets are stored as plain JSON and real files under `~/threader/`.
