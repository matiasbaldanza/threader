import type { Clock } from './factories.js'
import type { Profile, Thread } from './types.js'
import { renderThread } from './numbering.js'
import { needsUrl } from './templates.js'

/**
 * The publish run (docs/PLAN.md §6, ADR-0002 and ADR-0007).
 *
 * Threader never posts anything. This is bookkeeping for a human doing the posting:
 * which step you are on, which URLs you have captured, and whether the run finished.
 * Every transition is a pure `Thread → Thread`, so the wizard can persist after each
 * one and resume exactly where it stopped.
 */

const defaultClock: Clock = () => new Date().toISOString()

export type PublishStep =
  | { kind: 'post'; index: number }
  | { kind: 'closing' }
  | { kind: 'done' }

export function isPublishing(thread: Thread): boolean {
  return thread.publishRun !== null && thread.publishRun.completedAt === null
}

/** How many steps a run has: every post, plus the closing post if there is one. */
export function stepCount(thread: Thread): number {
  return thread.posts.length + (thread.closing ? 1 : 0)
}

export function currentStep(thread: Thread): PublishStep {
  const run = thread.publishRun
  if (!run || run.completedAt !== null) return { kind: 'done' }
  if (run.cursor < thread.posts.length) return { kind: 'post', index: run.cursor }
  if (thread.closing) return { kind: 'closing' }
  return { kind: 'done' }
}

/**
 * Why the thread cannot be published yet, or null if it can.
 *
 * An over-limit post is the one thing that must block: publishing would strand you
 * halfway through a thread with a post X refuses to accept.
 */
export function publishBlockedReason(thread: Thread, profile: Profile): string | null {
  if (thread.posts.length === 0) return 'There is nothing to publish yet.'
  const rendered = renderThread(thread, profile)
  const over = rendered.filter((p) => p.overLimit).length
  if (over > 0) {
    return `${over} post${over === 1 ? ' is' : 's are'} over the ${profile.charLimit}-character limit.`
  }
  return null
}

export function startPublish(thread: Thread, clock: Clock = defaultClock): Thread {
  if (isPublishing(thread)) return thread
  return {
    ...thread,
    publishRun: {
      startedAt: clock(),
      cursor: 0,
      firstPostUrl: null,
      completedAt: null,
    },
    updatedAt: clock(),
  }
}

/**
 * Whether the run has to stop and ask for post 1's URL.
 *
 * Only when the closing post actually links back to it. A thread that just ends does
 * not need the URL of anything, and asking anyway is a tab switch and a paste per
 * post to collect data nothing reads.
 */
export function needsFirstPostUrl(thread: Thread): boolean {
  return thread.closing !== null && needsUrl(thread.closing.text)
}

/**
 * Marks the current step done and moves on.
 *
 * The URL is optional and, in practice, only supplied for post 1 — it is what the
 * closing post's {{url}} resolves to, and the reason that capture happens at the start
 * of the run rather than the end.
 */
export function recordPublished(
  thread: Thread,
  url?: string,
  clock: Clock = defaultClock,
): Thread {
  const run = thread.publishRun
  if (!run || run.completedAt !== null) return thread

  const at = clock()
  const step = currentStep(thread)
  let posts = thread.posts
  let closing = thread.closing
  let firstPostUrl = run.firstPostUrl

  const published = url ? { at, url } : { at }

  if (step.kind === 'post') {
    posts = thread.posts.map((post, i) =>
      i === step.index ? { ...post, published } : post,
    )
    if (step.index === 0 && url) firstPostUrl = url
  } else if (step.kind === 'closing' && closing) {
    closing = { ...closing, published }
  } else {
    return thread
  }

  const cursor = run.cursor + 1
  const finished = cursor >= stepCount({ ...thread, posts, closing })

  return {
    ...thread,
    posts,
    closing,
    publishRun: {
      ...run,
      cursor,
      firstPostUrl,
      completedAt: finished ? at : null,
    },
    updatedAt: at,
  }
}

/**
 * Steps back without un-publishing anything. Going back is for re-copying something
 * you fumbled, not for undoing a post that is already public — Threader cannot delete
 * a post and must not pretend otherwise.
 */
export function stepBack(thread: Thread, clock: Clock = defaultClock): Thread {
  const run = thread.publishRun
  if (!run || run.cursor <= 0) return thread
  return {
    ...thread,
    publishRun: { ...run, cursor: run.cursor - 1, completedAt: null },
    updatedAt: clock(),
  }
}

/** Skips the current step without recording a URL. */
export function skipStep(thread: Thread, clock: Clock = defaultClock): Thread {
  const run = thread.publishRun
  if (!run || run.completedAt !== null) return thread
  const cursor = run.cursor + 1
  const finished = cursor >= stepCount(thread)
  const at = clock()
  return {
    ...thread,
    publishRun: { ...run, cursor, completedAt: finished ? at : null },
    updatedAt: at,
  }
}

/**
 * Abandons the run. Published posts keep their URLs — they are still public, and
 * forgetting that would be a lie about the world.
 */
export function abandonPublish(thread: Thread, clock: Clock = defaultClock): Thread {
  if (!thread.publishRun) return thread
  return { ...thread, publishRun: null, updatedAt: clock() }
}

/**
 * Forgets the run *and* the record of what went out, so the thread can be published
 * again from the top.
 *
 * Distinct from `abandonPublish`, which only drops the run and leaves the record
 * intact. This one is for "I deleted those posts on X, let me start again" — and it
 * cannot be inferred, because Threader has no way to know whether the posts are still
 * up. Whatever is already public stays public; this only changes what Threader
 * remembers, which is why the UI has to say so plainly.
 */
export function resetPublish(thread: Thread, clock: Clock = defaultClock): Thread {
  return {
    ...thread,
    posts: thread.posts.map((post) => ({ ...post, published: null })),
    closing: thread.closing ? { ...thread.closing, published: null } : null,
    publishRun: null,
    updatedAt: clock(),
  }
}

/** How far through a run the thread is, 0 to 1. Drives the progress ring. */
export function publishProgress(thread: Thread): number {
  const steps = stepCount(thread)
  if (steps === 0) return 0
  if (thread.publishRun?.completedAt) return 1
  const cursor = thread.publishRun?.cursor ?? 0
  return Math.min(cursor / steps, 1)
}

/** Not started, part-way through, or finished — what the ring colours itself by. */
export type PublishState = 'unpublished' | 'publishing' | 'published'

export function publishState(thread: Thread): PublishState {
  if (!thread.publishRun) return 'unpublished'
  return thread.publishRun.completedAt ? 'published' : 'publishing'
}

const STATUS_URL =
  /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d+)/

export type StatusUrl = { handle: string; id: string }

/**
 * Pulls the handle and status id out of a pasted URL.
 *
 * Used to confirm the paste is actually a post URL rather than, say, the profile page
 * or whatever else was on the clipboard — a mistake that would otherwise only surface
 * when the closing post links somewhere useless.
 */
export function parseStatusUrl(url: string): StatusUrl | null {
  const match = STATUS_URL.exec(url.trim())
  if (!match) return null
  return { handle: `@${match[1]}`, id: match[2]! }
}
