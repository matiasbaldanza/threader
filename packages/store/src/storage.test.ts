import { describe, expect, it } from 'vitest'
import { createThread } from '@threader/core'
import { MemoryStore } from './storage.js'

describe('MemoryStore', () => {
  it('round-trips a thread', async () => {
    const store = new MemoryStore()
    const thread = createThread({ profileId: 'p1', title: 'Reverse centaurs' })

    await store.putThread(thread)

    expect(await store.getThread(thread.id)).toEqual(thread)
    expect(await store.listThreads()).toHaveLength(1)

    await store.deleteThread(thread.id)
    expect(await store.getThread(thread.id)).toBeNull()
  })
})
