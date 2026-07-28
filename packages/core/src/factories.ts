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
