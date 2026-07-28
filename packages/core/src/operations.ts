import { createPost, type Clock, type Ids } from './factories.js'
import { split, type SplitOptions } from './split.js'
import type { AssetRef, ClosingTemplate, Post, Thread } from './types.js'

/**
 * Arrange-mode operations (docs/PLAN.md §4, ADR-0004).
 *
 * Every one of these is a pure `Thread → Thread`. The UI holds no thread logic of
 * its own; a card's "merge" button calls `mergePosts` and renders what comes back.
 *
 * The `detached` flag lives here rather than in the components, because it is the
 * single rule protecting your edits: once a post has been touched individually,
 * re-splitting from source would discard that work, so it becomes an explicit,
 * confirmable action instead of something that happens on the next keystroke.
 */

export type OpContext = { ids?: Ids; clock?: Clock }

const defaultIds: Ids = () => globalThis.crypto.randomUUID()
const defaultClock: Clock = () => new Date().toISOString()

/** Splitting config a thread-level operation needs. Comes from the profile. */
export type ReflowOptions = Omit<SplitOptions, 'startIndex' | 'otherPosts'>

function commit(
  thread: Thread,
  posts: Post[],
  opts: { detach: boolean; clock: Clock },
): Thread {
  return {
    ...thread,
    posts,
    detached: thread.detached || opts.detach,
    updatedAt: opts.clock(),
  }
}

function inRange(posts: Post[], index: number): boolean {
  return index >= 0 && index < posts.length
}

const ENDS_SENTENCE = /[.!?…]["'”’)\]]*$/

/**
 * Rejoins post bodies that are being put back together by a merge or a reflow.
 *
 * The seam matters. Splitting mid-sentence and then merging back must restore the
 * sentence — joining everything with a blank line would turn "…the machine ought"
 * and "to be doing…" into two paragraphs, and the splitter would then treat that
 * invented paragraph break as a boundary to respect. So a body that does not end a
 * sentence is joined with a space; anything else keeps its paragraph break.
 */
export function joinBodies(texts: string[]): string {
  return texts.reduce((acc, next) => {
    if (!acc) return next
    const separator = ENDS_SENTENCE.test(acc.trimEnd()) ? '\n\n' : ' '
    return acc + separator + next
  }, '')
}

export function postsFromBodies(bodies: string[], ctx: OpContext = {}): Post[] {
  const ids = ctx.ids ?? defaultIds
  return bodies.map((text) => createPost(text, { ids }))
}

/** Editing a single post's body. The canonical way to detach a thread. */
export function setPostText(
  thread: Thread,
  index: number,
  text: string,
  ctx: OpContext = {},
): Thread {
  if (!inRange(thread.posts, index)) return thread
  const posts = thread.posts.map((post, i) => (i === index ? { ...post, text } : post))
  return commit(thread, posts, { detach: true, clock: ctx.clock ?? defaultClock })
}

/**
 * Splits one post in two at a character offset. Assets stay with the first half —
 * they were attached to the post as it was written, and guessing which half they
 * belong to would be worse than a rule you can predict.
 */
export function splitPost(
  thread: Thread,
  index: number,
  offset: number,
  ctx: OpContext = {},
): Thread {
  if (!inRange(thread.posts, index)) return thread
  const post = thread.posts[index]!

  const head = post.text.slice(0, offset).trimEnd()
  const tail = post.text.slice(offset).trimStart()
  // Splitting at the very start or end would produce an empty post.
  if (!head || !tail) return thread

  const ids = ctx.ids ?? defaultIds
  const posts = [
    ...thread.posts.slice(0, index),
    { ...post, text: head },
    { ...createPost(tail, { ids }), locked: post.locked },
    ...thread.posts.slice(index + 1),
  ]
  return commit(thread, posts, { detach: true, clock: ctx.clock ?? defaultClock })
}

/**
 * Joins a post with the one after it. Allowed even when the result is over the
 * limit — the card turns red and publishing is blocked, which is more useful than
 * refusing the edit and leaving you to work around it.
 */
export function mergePosts(thread: Thread, index: number, ctx: OpContext = {}): Thread {
  if (!inRange(thread.posts, index) || !inRange(thread.posts, index + 1)) return thread
  const first = thread.posts[index]!
  const second = thread.posts[index + 1]!

  const merged: Post = {
    ...first,
    text: joinBodies([first.text, second.text]).trim(),
    assets: [...first.assets, ...second.assets],
    locked: first.locked || second.locked,
  }

  const posts = [
    ...thread.posts.slice(0, index),
    merged,
    ...thread.posts.slice(index + 2),
  ]
  return commit(thread, posts, { detach: true, clock: ctx.clock ?? defaultClock })
}

export function movePost(
  thread: Thread,
  from: number,
  to: number,
  ctx: OpContext = {},
): Thread {
  if (!inRange(thread.posts, from) || !inRange(thread.posts, to) || from === to) {
    return thread
  }
  const posts = [...thread.posts]
  const [moved] = posts.splice(from, 1)
  posts.splice(to, 0, moved!)
  return commit(thread, posts, { detach: true, clock: ctx.clock ?? defaultClock })
}

export function removePost(thread: Thread, index: number, ctx: OpContext = {}): Thread {
  if (!inRange(thread.posts, index)) return thread
  const posts = thread.posts.filter((_, i) => i !== index)
  return commit(thread, posts, { detach: true, clock: ctx.clock ?? defaultClock })
}

/**
 * Locking excludes a post from reflow. It does not change any text, so on its own
 * it does not detach the thread.
 */
export function setLocked(
  thread: Thread,
  index: number,
  locked: boolean,
  ctx: OpContext = {},
): Thread {
  if (!inRange(thread.posts, index)) return thread
  const posts = thread.posts.map((post, i) => (i === index ? { ...post, locked } : post))
  return commit(thread, posts, { detach: false, clock: ctx.clock ?? defaultClock })
}

/**
 * Re-packs the run of unlocked posts starting at `index`, leaving everything before
 * it — and the first locked post after it — untouched. A locked post is a wall in
 * both directions, which is what makes "lock" mean something predictable.
 *
 * Assets from every post in the run collect onto the first resulting post. Dropping
 * them silently would be worse; the run's text has been re-flowed, so there is no
 * honest way to know which new post each asset belonged to.
 */
export function reflowFrom(
  thread: Thread,
  index: number,
  options: ReflowOptions,
  ctx: OpContext = {},
): Thread {
  if (!inRange(thread.posts, index)) return thread
  if (thread.posts[index]!.locked) return thread

  let end = index
  while (end < thread.posts.length && !thread.posts[end]!.locked) end++

  const run = thread.posts.slice(index, end)
  const text = joinBodies(run.map((p) => p.text))
  const assets: AssetRef[] = run.flatMap((p) => p.assets)

  const bodies = split(text, {
    ...options,
    startIndex: index,
    otherPosts: thread.posts.length - run.length,
  })
  if (bodies.length === 0) return thread

  const ids = ctx.ids ?? defaultIds
  const repacked = bodies.map((body, i) => {
    const base = run[i]
    // Reuse ids where we can so React keys and any future asset links stay stable.
    const post = base ? { ...base, text: body } : createPost(body, { ids })
    return i === 0 ? { ...post, assets } : { ...post, assets: [] }
  })

  const posts = [
    ...thread.posts.slice(0, index),
    ...repacked,
    ...thread.posts.slice(end),
  ]
  return commit(thread, posts, { detach: true, clock: ctx.clock ?? defaultClock })
}

/**
 * Gives the thread a closing post, from a profile template.
 *
 * Does not detach: a closing post is a separate post appended to the thread, not an
 * edit to the hand-arranged ones, so the draft can keep driving the body.
 */
export function setClosing(
  thread: Thread,
  template: ClosingTemplate | null,
  ctx: OpContext = {},
): Thread {
  const clock = ctx.clock ?? defaultClock
  if (!template) return { ...thread, closing: null, updatedAt: clock() }
  return {
    ...thread,
    closing: {
      templateId: template.id,
      text: template.body,
      assets: thread.closing?.assets ?? [],
      published: thread.closing?.published ?? null,
    },
    updatedAt: clock(),
  }
}

/** Editing the closing post's wording, which detaches it from its template. */
export function setClosingText(
  thread: Thread,
  text: string,
  ctx: OpContext = {},
): Thread {
  if (!thread.closing) return thread
  const clock = ctx.clock ?? defaultClock
  return {
    ...thread,
    closing: { ...thread.closing, text, templateId: null },
    updatedAt: clock(),
  }
}

/**
 * Throws away the current posts and re-splits `source`. Destructive whenever the
 * thread is detached — the UI must confirm before calling this.
 */
export function resplitFromSource(
  thread: Thread,
  options: ReflowOptions,
  ctx: OpContext = {},
): Thread {
  const bodies = split(thread.source, options)
  const clock = ctx.clock ?? defaultClock
  return {
    ...thread,
    posts: postsFromBodies(bodies, ctx),
    detached: false,
    updatedAt: clock(),
  }
}

/**
 * Compose-mode typing. While the thread is attached, posts track the source on
 * every keystroke. Once detached, the source is still recorded but the posts are
 * left alone — re-splitting is `resplitFromSource`, behind a confirmation.
 */
export function setSource(
  thread: Thread,
  source: string,
  options: ReflowOptions,
  ctx: OpContext = {},
): Thread {
  const clock = ctx.clock ?? defaultClock
  if (thread.detached) {
    return { ...thread, source, updatedAt: clock() }
  }
  return {
    ...thread,
    source,
    posts: postsFromBodies(split(source, options), ctx),
    updatedAt: clock(),
  }
}
