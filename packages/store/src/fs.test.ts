import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createProfile, createThread } from '@threader/core'
import { FsStore } from './fs.js'
import { assertSafeId, resolveWithin, slugify } from './paths.js'

let home: string
let store: FsStore

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'threader-test-'))
  store = new FsStore(home)
  await store.init()
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

const ids = (() => {
  let n = 0
  return () => `id-${n++}`
})()

describe('path safety', () => {
  it('resolves paths inside the home', () => {
    expect(resolveWithin('/a/b', 'threads', 'x')).toBe('/a/b/threads/x')
  })

  it('refuses to escape the home', () => {
    expect(() => resolveWithin('/a/b', '../../etc/passwd')).toThrow(/escapes/)
    expect(() => resolveWithin('/a/b', 'threads', '..', '..', '..')).toThrow(/escapes/)
  })

  it('does not treat a sibling with a shared prefix as inside', () => {
    expect(() => resolveWithin('/a/b', '../bc')).toThrow(/escapes/)
  })

  it('rejects ids that could traverse', () => {
    expect(() => assertSafeId('../x')).toThrow(/unsafe/)
    expect(() => assertSafeId('a/b')).toThrow(/unsafe/)
    expect(() => assertSafeId('')).toThrow(/unsafe/)
    expect(assertSafeId('ok-123')).toBe('ok-123')
  })
})

describe('slugify', () => {
  it('makes a folder-safe name', () => {
    expect(slugify('Reverse Centaurs!')).toBe('reverse-centaurs')
  })

  it('truncates on a word boundary rather than mid-word', () => {
    const slug = slugify('Persistence is the boring feature that makes everything trustworthy')
    expect(slug).toBe('persistence-is-the-boring')
    expect(slug.length).toBeLessThanOrEqual(28)
  })

  it('hard-cuts a single word longer than the limit', () => {
    expect(slugify('a'.repeat(50))).toBe('a'.repeat(28))
  })

  it('leaves a short title alone', () => {
    expect(slugify('Short one')).toBe('short-one')
  })

  it('strips accents rather than dropping the word', () => {
    expect(slugify('Café à Paris')).toBe('cafe-a-paris')
  })

  it('falls back when nothing survives', () => {
    expect(slugify('🙏🙏🙏')).toBe('untitled')
  })
})

describe('FsStore — threads', () => {
  it('round-trips a thread', async () => {
    const thread = createThread({ profileId: 'p1', title: 'Reverse centaurs' }, { ids })
    await store.putThread(thread)

    expect(await store.getThread(thread.id)).toEqual(thread)
    expect(await store.listThreads()).toHaveLength(1)
  })

  it('writes a human-readable folder named for the date and title', async () => {
    const thread = {
      ...createThread({ profileId: 'p1', title: 'Reverse Centaurs' }, { ids }),
      createdAt: '2026-07-28T10:00:00.000Z',
    }
    await store.putThread(thread)

    const path = join(home, 'threads', '2026-07-28-reverse-centaurs', 'thread.json')
    const written = JSON.parse(await readFile(path, 'utf8'))
    expect(written.id).toBe(thread.id)
  })

  it('keeps the folder stable when the title changes', async () => {
    const thread = createThread({ profileId: 'p1', title: 'First name' }, { ids })
    await store.putThread(thread)
    await store.putThread({ ...thread, title: 'Totally different' })

    // Renaming would break asset paths and any link to the folder.
    const found = await store.getThread(thread.id)
    expect(found?.title).toBe('Totally different')
    expect(await store.listThreads()).toHaveLength(1)
  })

  it('renames the folder when the title is deliberately changed', async () => {
    const thread = {
      ...createThread({ profileId: 'p1', title: 'First name' }, { ids }),
      createdAt: '2026-07-28T10:00:00.000Z',
    }
    await store.putThread(thread)
    await store.renameThread(thread.id, 'Something else entirely')

    const { readdir } = await import('node:fs/promises')
    expect(await readdir(join(home, 'threads'))).toEqual([
      '2026-07-28-something-else-entirely',
    ])
    // The thread itself is untouched — only its container moved.
    expect((await store.getThread(thread.id))?.id).toBe(thread.id)
  })

  it('keeps the original creation date when renaming', async () => {
    const thread = {
      ...createThread({ profileId: 'p1', title: 'Old' }, { ids }),
      createdAt: '2020-01-02T00:00:00.000Z',
    }
    await store.putThread(thread)
    await store.renameThread(thread.id, 'New title')

    const { readdir } = await import('node:fs/promises')
    expect(await readdir(join(home, 'threads'))).toEqual(['2020-01-02-new-title'])
  })

  it('is a no-op when the slug would not change', async () => {
    const thread = createThread({ profileId: 'p1', title: 'Same Title' }, { ids })
    await store.putThread(thread)
    const { readdir } = await import('node:fs/promises')
    const before = await readdir(join(home, 'threads'))

    await store.renameThread(thread.id, 'same title!')

    expect(await readdir(join(home, 'threads'))).toEqual(before)
  })

  it('suffixes a rename that would collide with another thread', async () => {
    const a = { ...createThread({ profileId: 'p', title: 'Taken' }, { ids }), createdAt: '2026-07-28T00:00:00.000Z' }
    const b = { ...createThread({ profileId: 'p', title: 'Other' }, { ids }), createdAt: '2026-07-28T00:00:00.000Z' }
    await store.putThread(a)
    await store.putThread(b)

    await store.renameThread(b.id, 'Taken')

    const { readdir } = await import('node:fs/promises')
    expect((await readdir(join(home, 'threads'))).sort()).toEqual([
      '2026-07-28-taken',
      '2026-07-28-taken-2',
    ])
    expect(await store.getThread(a.id)).not.toBeNull()
    expect(await store.getThread(b.id)).not.toBeNull()
  })

  it('refuses to rename with an unsafe id', async () => {
    await expect(store.renameThread('../../x', 'y')).rejects.toThrow(/unsafe/)
  })

  it('does not collide when two threads share a date and title', async () => {
    const a = { ...createThread({ profileId: 'p', title: 'Same' }, { ids }), createdAt: '2026-07-28T00:00:00.000Z' }
    const b = { ...createThread({ profileId: 'p', title: 'Same' }, { ids }), createdAt: '2026-07-28T00:00:00.000Z' }
    await store.putThread(a)
    await store.putThread(b)

    const all = await store.listThreads()
    expect(all).toHaveLength(2)
    expect(await store.getThread(a.id)).not.toBeNull()
    expect(await store.getThread(b.id)).not.toBeNull()
  })

  it('lists most recently updated first', async () => {
    const older = { ...createThread({ profileId: 'p', title: 'Older' }, { ids }), updatedAt: '2026-07-01T00:00:00.000Z' }
    const newer = { ...createThread({ profileId: 'p', title: 'Newer' }, { ids }), updatedAt: '2026-07-28T00:00:00.000Z' }
    await store.putThread(older)
    await store.putThread(newer)

    expect((await store.listThreads()).map((t) => t.title)).toEqual(['Newer', 'Older'])
  })

  it('deletes a thread and its folder', async () => {
    const thread = createThread({ profileId: 'p1', title: 'Gone' }, { ids })
    await store.putThread(thread)
    await store.deleteThread(thread.id)

    expect(await store.getThread(thread.id)).toBeNull()
    expect(await store.listThreads()).toEqual([])
  })

  it('returns null for an unknown thread', async () => {
    expect(await store.getThread('nope')).toBeNull()
  })

  it('refuses an id that would traverse out of the home', async () => {
    await expect(store.getThread('../../etc')).rejects.toThrow(/unsafe/)
  })

  it('skips a corrupt thread.json instead of failing the whole list', async () => {
    const good = createThread({ profileId: 'p', title: 'Good' }, { ids })
    await store.putThread(good)
    await mkdir(join(home, 'threads', 'broken'), { recursive: true })
    await writeFile(join(home, 'threads', 'broken', 'thread.json'), '{ not json', 'utf8')

    const all = await store.listThreads()
    expect(all.map((t) => t.title)).toEqual(['Good'])
  })

  it('leaves no temp files behind', async () => {
    const thread = createThread({ profileId: 'p', title: 'Atomic' }, { ids })
    await store.putThread(thread)

    const { readdir } = await import('node:fs/promises')
    const dir = (await readdir(join(home, 'threads')))[0]!
    const files = await readdir(join(home, 'threads', dir))
    expect(files).toEqual(['thread.json'])
  })
})

describe('FsStore — profiles', () => {
  it('round-trips a profile', async () => {
    const profile = createProfile({ name: 'Main', handle: '@me' }, { ids })
    await store.putProfile(profile)

    expect(await store.getProfile(profile.id)).toEqual(profile)
    expect(await store.listProfiles()).toHaveLength(1)
  })

  it('reuses the same file when a profile is renamed', async () => {
    const profile = createProfile({ name: 'Main', handle: '@me' }, { ids })
    await store.putProfile(profile)
    await store.putProfile({ ...profile, name: 'Renamed' })

    const { readdir } = await import('node:fs/promises')
    expect(await readdir(join(home, 'profiles'))).toEqual(['main.json'])
    expect((await store.getProfile(profile.id))?.name).toBe('Renamed')
  })
})
