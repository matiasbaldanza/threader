import { describe, expect, it } from 'vitest'
import { createThread, defaultNumbering } from './factories.js'
import {
  joinBodies,
  mergePosts,
  movePost,
  postsFromBodies,
  reflowFrom,
  removePost,
  resplitFromSource,
  setLocked,
  setPostText,
  setSource,
  splitPost,
} from './operations.js'
import type { AssetRef, Thread } from './types.js'

let seq = 0
const ctx = {
  ids: () => `id-${seq++}`,
  clock: () => '2026-07-27T00:00:00.000Z',
}

const opts = { charLimit: 280, numbering: defaultNumbering }

function threadWith(bodies: string[], source = bodies.join('\n\n')): Thread {
  seq = 0
  return {
    ...createThread({ profileId: 'p1', source }, ctx),
    posts: postsFromBodies(bodies, ctx),
  }
}

const asset = (id: string): AssetRef => ({ id, path: `${id}.png`, kind: 'image' })

describe('setPostText', () => {
  it('replaces one post and detaches the thread', () => {
    const thread = threadWith(['one', 'two'])
    expect(thread.detached).toBe(false)

    const next = setPostText(thread, 1, 'edited', ctx)
    expect(next.posts.map((p) => p.text)).toEqual(['one', 'edited'])
    expect(next.detached).toBe(true)
  })

  it('ignores an out-of-range index', () => {
    const thread = threadWith(['one'])
    expect(setPostText(thread, 5, 'x', ctx)).toBe(thread)
  })
})

describe('splitPost', () => {
  it('splits at the offset and trims the seam', () => {
    const thread = threadWith(['hello there world'])
    const next = splitPost(thread, 0, 5, ctx)
    expect(next.posts.map((p) => p.text)).toEqual(['hello', 'there world'])
    expect(next.detached).toBe(true)
  })

  it('refuses a split that would leave an empty post', () => {
    const thread = threadWith(['hello'])
    expect(splitPost(thread, 0, 0, ctx)).toBe(thread)
    expect(splitPost(thread, 0, 5, ctx)).toBe(thread)
  })

  it('keeps assets with the first half', () => {
    const thread = threadWith(['hello there'])
    thread.posts[0]!.assets = [asset('a')]
    const next = splitPost(thread, 0, 5, ctx)
    expect(next.posts[0]?.assets).toHaveLength(1)
    expect(next.posts[1]?.assets).toEqual([])
  })
})

describe('joinBodies', () => {
  it('keeps a paragraph break between complete sentences', () => {
    expect(joinBodies(['One thing.', 'Another thing.'])).toBe('One thing.\n\nAnother thing.')
  })

  it('restores a sentence that was split mid-way', () => {
    // Split "the machine ought to be doing" and merge it back: a blank line here
    // would invent a paragraph break the splitter would then respect forever.
    expect(joinBodies(['the machine ought', 'to be doing'])).toBe(
      'the machine ought to be doing',
    )
  })

  it('handles quotes and brackets at the sentence end', () => {
    expect(joinBodies(['He said "go."', 'Then left.'])).toBe('He said "go."\n\nThen left.')
  })
})

describe('mergePosts', () => {
  it('joins two complete sentences with a blank line', () => {
    const thread = threadWith(['One thing.', 'Two things.', 'three'])
    const next = mergePosts(thread, 0, ctx)
    expect(next.posts.map((p) => p.text)).toEqual(['One thing.\n\nTwo things.', 'three'])
    expect(next.detached).toBe(true)
  })

  it('rejoins a mid-sentence split with a space', () => {
    const thread = threadWith(['the machine ought', 'to be doing'])
    const next = mergePosts(thread, 0, ctx)
    expect(next.posts[0]?.text).toBe('the machine ought to be doing')
  })

  it('carries both posts assets', () => {
    const thread = threadWith(['one', 'two'])
    thread.posts[0]!.assets = [asset('a')]
    thread.posts[1]!.assets = [asset('b')]
    const next = mergePosts(thread, 0, ctx)
    expect(next.posts[0]?.assets.map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('allows a merge that goes over the limit', () => {
    // Deliberate: the card turns red and publishing is blocked, rather than the
    // edit being refused.
    const long = 'x'.repeat(200)
    const thread = threadWith([long, long])
    const next = mergePosts(thread, 0, ctx)
    expect(next.posts).toHaveLength(1)
    expect(next.posts[0]!.text.length).toBeGreaterThan(280)
  })

  it('does nothing on the last post', () => {
    const thread = threadWith(['one'])
    expect(mergePosts(thread, 0, ctx)).toBe(thread)
  })
})

describe('movePost', () => {
  it('reorders and detaches', () => {
    const thread = threadWith(['a', 'b', 'c'])
    const next = movePost(thread, 2, 0, ctx)
    expect(next.posts.map((p) => p.text)).toEqual(['c', 'a', 'b'])
    expect(next.detached).toBe(true)
  })

  it('is a no-op when moving onto itself', () => {
    const thread = threadWith(['a', 'b'])
    expect(movePost(thread, 1, 1, ctx)).toBe(thread)
  })
})

describe('removePost', () => {
  it('drops the post and detaches', () => {
    const thread = threadWith(['a', 'b', 'c'])
    const next = removePost(thread, 1, ctx)
    expect(next.posts.map((p) => p.text)).toEqual(['a', 'c'])
    expect(next.detached).toBe(true)
  })
})

describe('setLocked', () => {
  it('does not detach — locking changes no text', () => {
    const thread = threadWith(['a', 'b'])
    const next = setLocked(thread, 0, true, ctx)
    expect(next.posts[0]?.locked).toBe(true)
    expect(next.detached).toBe(false)
  })
})

describe('reflowFrom', () => {
  it('re-packs from the given post, leaving earlier ones alone', () => {
    const thread = threadWith(['keep me', 'aaa', 'bbb', 'ccc'])
    const next = reflowFrom(thread, 1, opts, ctx)
    expect(next.posts[0]?.text).toBe('keep me')
    expect(next.posts).toHaveLength(2)
    expect(next.posts[1]?.text).toBe('aaa bbb ccc')
  })

  it('stops at a locked post', () => {
    const thread = threadWith(['a', 'b', 'locked', 'c'])
    thread.posts[2]!.locked = true
    const next = reflowFrom(thread, 0, opts, ctx)
    expect(next.posts.map((p) => p.text)).toEqual(['a b', 'locked', 'c'])
  })

  it('refuses to reflow a locked post itself', () => {
    const thread = threadWith(['a', 'b'])
    thread.posts[0]!.locked = true
    expect(reflowFrom(thread, 0, opts, ctx)).toBe(thread)
  })

  it('collects the run assets onto the first resulting post', () => {
    const thread = threadWith(['a', 'b'])
    thread.posts[0]!.assets = [asset('x')]
    thread.posts[1]!.assets = [asset('y')]
    const next = reflowFrom(thread, 0, opts, ctx)
    expect(next.posts[0]?.assets.map((a) => a.id)).toEqual(['x', 'y'])
  })

  it('budgets the run at its real position in the thread', () => {
    // With post 1 unnumbered, reflowing from post 2 must NOT inherit post 1's
    // larger budget. Body of exactly the unnumbered limit should still split.
    const numbering = { ...defaultNumbering, includeFirst: false }
    const body = 'ab '.repeat(20).trim() // 59 chars
    const thread = threadWith(['first', body])
    const next = reflowFrom(thread, 1, { charLimit: 60, numbering }, ctx)
    // 59 fits unnumbered, but "\n\n2/2" pushes it over — so it must split.
    expect(next.posts.length).toBeGreaterThan(2)
  })
})

describe('setSource', () => {
  it('re-splits live while the thread is attached', () => {
    const thread = threadWith([], '')
    const next = setSource(thread, 'one\n---\ntwo', opts, ctx)
    expect(next.posts.map((p) => p.text)).toEqual(['one', 'two'])
    expect(next.detached).toBe(false)
  })

  it('records the source but leaves posts alone once detached', () => {
    const thread = setPostText(threadWith(['one', 'two']), 0, 'edited', ctx)
    const next = setSource(thread, 'completely different text', opts, ctx)
    expect(next.source).toBe('completely different text')
    expect(next.posts.map((p) => p.text)).toEqual(['edited', 'two'])
  })
})

describe('resplitFromSource', () => {
  it('discards edits and re-attaches the thread', () => {
    const thread = setPostText(threadWith(['one', 'two'], 'one\n---\ntwo'), 0, 'edited', ctx)
    expect(thread.detached).toBe(true)

    const next = resplitFromSource(thread, opts, ctx)
    expect(next.posts.map((p) => p.text)).toEqual(['one', 'two'])
    expect(next.detached).toBe(false)
  })
})
