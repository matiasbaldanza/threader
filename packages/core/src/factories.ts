import type { NumberingConfig, Post, Profile, Thread } from './types.js'

/**
 * Ids and timestamps are injectable so tests stay deterministic and so `core`
 * depends on no ambient clock. Defaults use web-standard `crypto`, available in
 * both the browser and Node 20 — not a Node API (ADR-0001).
 */
export type Ids = () => string
export type Clock = () => string

const defaultIds: Ids = () => globalThis.crypto.randomUUID()
const defaultClock: Clock = () => new Date().toISOString()

export const defaultNumbering: NumberingConfig = {
  format: '{n}/{total}',
  position: 'suffix',
  separator: '\n\n',
  includeFirst: true,
  includeClosing: false,
}

export function createPost(
  text = '',
  opts: { ids?: Ids } = {},
): Post {
  const ids = opts.ids ?? defaultIds
  return {
    id: ids(),
    text,
    assets: [],
    locked: false,
    published: null,
  }
}

/**
 * A thread's display name, taken from the first line of the draft. Threads are
 * listed by name, and nobody wants to name a thread before writing it — so this is
 * derived until the writer overrides it.
 */
export function deriveTitle(source: string, fallback = 'Untitled thread'): string {
  const first = source.split('\n').map((l) => l.trim()).find((l) => l.length > 0)
  if (!first) return fallback
  return first.length > 60 ? `${first.slice(0, 57).trimEnd()}\u2026` : first
}

export function createThread(
  init: { profileId: string; title?: string; source?: string },
  opts: { ids?: Ids; clock?: Clock } = {},
): Thread {
  const ids = opts.ids ?? defaultIds
  const clock = opts.clock ?? defaultClock
  const now = clock()
  return {
    id: ids(),
    profileId: init.profileId,
    title: init.title ?? 'Untitled thread',
    source: init.source ?? '',
    detached: false,
    posts: [],
    closing: null,
    publishRun: null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * A thread nobody has written in yet. Used to keep untouched "New thread" clicks off
 * the disk — otherwise every stray click leaves a folder whose name is fixed as
 * "untitled-thread" before the title has been derived from anything.
 */
export function isBlankThread(thread: Thread): boolean {
  return (
    thread.source.trim().length === 0 &&
    thread.posts.length === 0 &&
    thread.closing === null
  )
}

export function createProfile(
  init: { name: string; handle: string },
  opts: { ids?: Ids } = {},
): Profile {
  const ids = opts.ids ?? defaultIds
  return {
    id: ids(),
    name: init.name,
    handle: init.handle,
    platform: 'x',
    charLimit: 280,
    numbering: { ...defaultNumbering },
    closingTemplates: [
      {
        id: 'repost-ask',
        label: 'Repost ask',
        body: 'If this was useful, the best thing you can do is repost the first post 🙏\n\n{{url}}',
      },
    ],
    style: {},
    libraryPath: null,
  }
}
