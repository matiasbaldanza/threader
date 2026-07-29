import { describe, expect, it } from 'vitest'
import { createProfile, createThread, defaultNumbering } from './factories.js'
import { postsFromBodies } from './operations.js'
import {
  abandonPublish,
  needsFirstPostUrl,
  currentStep,
  isPublishing,
  parseStatusUrl,
  publishBlockedReason,
  publishProgress,
  publishState,
  recordPublished,
  resetPublish,
  skipStep,
  startPublish,
  stepBack,
  stepCount,
} from './publish.js'
import type { Thread } from './types.js'

let seq = 0
const ids = () => `id-${seq++}`
const clock = () => '2026-07-28T12:00:00.000Z'

const profile = createProfile({ name: 'Main', handle: '@me' }, { ids: () => 'p1' })

function threadWith(bodies: string[], closingText?: string): Thread {
  seq = 0
  const thread = createThread({ profileId: 'p1' }, { ids, clock })
  return {
    ...thread,
    posts: postsFromBodies(bodies, { ids }),
    closing: closingText
      ? { templateId: 't', text: closingText, assets: [], published: null }
      : null,
  }
}

describe('publishBlockedReason', () => {
  it('blocks an empty thread', () => {
    expect(publishBlockedReason(threadWith([]), profile)).toMatch(/nothing to publish/)
  })

  it('blocks an over-limit post — the run would strand you halfway', () => {
    const thread = threadWith(['x'.repeat(400)])
    expect(publishBlockedReason(thread, profile)).toMatch(/over the 280/)
  })

  it('allows a thread that fits', () => {
    expect(publishBlockedReason(threadWith(['short']), profile)).toBeNull()
  })
})

describe('a run through the posts', () => {
  it('starts at post 1', () => {
    const thread = startPublish(threadWith(['a', 'b']), clock)
    expect(isPublishing(thread)).toBe(true)
    expect(currentStep(thread)).toEqual({ kind: 'post', index: 0 })
  })

  it('records each URL and advances', () => {
    let thread = startPublish(threadWith(['a', 'b']), clock)
    thread = recordPublished(thread, 'https://x.com/me/status/1', clock)

    expect(thread.posts[0]?.published?.url).toBe('https://x.com/me/status/1')
    expect(currentStep(thread)).toEqual({ kind: 'post', index: 1 })
  })

  it('records the time even when no URL is given', () => {
    // The common case: only post 1 needs a URL, so every other step just records
    // that it went out and when.
    let thread = startPublish(threadWith(['a', 'b']), clock)
    thread = recordPublished(thread, undefined, clock)

    expect(thread.posts[0]?.published).toEqual({ at: clock() })
    expect(currentStep(thread)).toEqual({ kind: 'post', index: 1 })
  })

  it("keeps post 1's URL separately — the closing post depends on it", () => {
    let thread = startPublish(threadWith(['a', 'b']), clock)
    thread = recordPublished(thread, 'https://x.com/me/status/1', clock)
    expect(thread.publishRun?.firstPostUrl).toBe('https://x.com/me/status/1')
  })

  it('finishes after the last post when there is no closing post', () => {
    let thread = startPublish(threadWith(['a', 'b']), clock)
    thread = recordPublished(thread, 'https://x.com/me/status/1', clock)
    thread = recordPublished(thread, 'https://x.com/me/status/2', clock)

    expect(thread.publishRun?.completedAt).toBe(clock())
    expect(isPublishing(thread)).toBe(false)
    expect(currentStep(thread)).toEqual({ kind: 'done' })
  })

  it('ends on the closing post when there is one', () => {
    let thread = startPublish(threadWith(['a'], 'repost {{url}}'), clock)
    expect(stepCount(thread)).toBe(2)

    thread = recordPublished(thread, 'https://x.com/me/status/1', clock)
    expect(currentStep(thread)).toEqual({ kind: 'closing' })

    thread = recordPublished(thread, 'https://x.com/me/status/9', clock)
    expect(thread.closing?.published?.url).toBe('https://x.com/me/status/9')
    expect(thread.publishRun?.completedAt).toBe(clock())
  })
})

describe('needsFirstPostUrl', () => {
  it('is false without a closing post — nothing links back', () => {
    expect(needsFirstPostUrl(threadWith(['a']))).toBe(false)
  })

  it('is false when the closing post does not link back', () => {
    expect(needsFirstPostUrl(threadWith(['a'], 'Subscribe at example.com'))).toBe(false)
  })

  it('is true only when the closing post asks for a repost of post 1', () => {
    expect(needsFirstPostUrl(threadWith(['a'], 'repost the first post {{url}}'))).toBe(true)
  })
})

describe('going back and skipping', () => {
  it('steps back without un-publishing what is already public', () => {
    let thread = startPublish(threadWith(['a', 'b']), clock)
    thread = recordPublished(thread, 'https://x.com/me/status/1', clock)
    thread = stepBack(thread, clock)

    expect(currentStep(thread)).toEqual({ kind: 'post', index: 0 })
    // The post is still live. Threader cannot delete it and must not pretend it can.
    expect(thread.posts[0]?.published?.url).toBe('https://x.com/me/status/1')
  })

  it('cannot step back past the beginning', () => {
    const thread = startPublish(threadWith(['a']), clock)
    expect(stepBack(thread, clock).publishRun?.cursor).toBe(0)
  })

  it('skips a step without recording a URL', () => {
    let thread = startPublish(threadWith(['a', 'b']), clock)
    thread = skipStep(thread, clock)

    expect(thread.posts[0]?.published).toBeNull()
    expect(currentStep(thread)).toEqual({ kind: 'post', index: 1 })
  })
})

describe('abandoning', () => {
  it('drops the run but keeps the URLs of posts that are already public', () => {
    let thread = startPublish(threadWith(['a', 'b']), clock)
    thread = recordPublished(thread, 'https://x.com/me/status/1', clock)
    thread = abandonPublish(thread, clock)

    expect(thread.publishRun).toBeNull()
    expect(thread.posts[0]?.published?.url).toBe('https://x.com/me/status/1')
  })
})

describe('resuming', () => {
  it('picks up exactly where it stopped', () => {
    let thread = startPublish(threadWith(['a', 'b', 'c']), clock)
    thread = recordPublished(thread, 'https://x.com/me/status/1', clock)

    // What reloading from disk gives you back.
    const reloaded: Thread = JSON.parse(JSON.stringify(thread))
    expect(currentStep(reloaded)).toEqual({ kind: 'post', index: 1 })
    expect(isPublishing(reloaded)).toBe(true)
  })
})

describe('parseStatusUrl', () => {
  it('reads a post URL', () => {
    expect(parseStatusUrl('https://x.com/matiasbaldanza/status/1234567890')).toEqual({
      handle: '@matiasbaldanza',
      id: '1234567890',
    })
  })

  it('accepts twitter.com and trailing query junk', () => {
    expect(parseStatusUrl('https://twitter.com/me/status/42?s=20')).toEqual({
      handle: '@me',
      id: '42',
    })
  })

  it('rejects anything that is not a post URL', () => {
    // The profile page is the easy mistake, and would leave the closing post
    // linking somewhere useless.
    expect(parseStatusUrl('https://x.com/matiasbaldanza')).toBeNull()
    expect(parseStatusUrl('not a url')).toBeNull()
    expect(parseStatusUrl('')).toBeNull()
  })
})

describe('numbering is unaffected by publishing', () => {
  it('does not touch post text', () => {
    let thread = startPublish(threadWith(['a', 'b']), clock)
    thread = recordPublished(thread, 'https://x.com/me/status/1', clock)
    expect(thread.posts.map((p) => p.text)).toEqual(['a', 'b'])
    expect(defaultNumbering.format).toBe('{n}/{total}')
  })
})

describe('resetPublish', () => {
  it('forgets the run and what went out, so it can be published again', () => {
    let thread = startPublish(threadWith(['a', 'b']), clock)
    thread = recordPublished(thread, 'https://x.com/me/status/1', clock)
    thread = resetPublish(thread, clock)

    expect(thread.publishRun).toBeNull()
    expect(thread.posts.every((p) => p.published === null)).toBe(true)
    expect(currentStep(thread)).toEqual({ kind: 'done' })
    expect(isPublishing(startPublish(thread, clock))).toBe(true)
  })

  it('differs from abandoning, which keeps the record', () => {
    let thread = startPublish(threadWith(['a', 'b']), clock)
    thread = recordPublished(thread, 'https://x.com/me/status/1', clock)

    expect(abandonPublish(thread, clock).posts[0]?.published).not.toBeNull()
    expect(resetPublish(thread, clock).posts[0]?.published).toBeNull()
  })
})

describe('publishState and progress', () => {
  it('is unpublished before a run starts', () => {
    const thread = threadWith(['a', 'b'])
    expect(publishState(thread)).toBe('unpublished')
    expect(publishProgress(thread)).toBe(0)
  })

  it('is part-way through during a run', () => {
    let thread = startPublish(threadWith(['a', 'b']), clock)
    thread = recordPublished(thread, undefined, clock)

    expect(publishState(thread)).toBe('publishing')
    expect(publishProgress(thread)).toBe(0.5)
  })

  it('is full once finished', () => {
    let thread = startPublish(threadWith(['a']), clock)
    thread = recordPublished(thread, undefined, clock)

    expect(publishState(thread)).toBe('published')
    expect(publishProgress(thread)).toBe(1)
  })
})
