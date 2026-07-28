import type { Profile, Thread } from '@threader/core'

/**
 * The one seam between thread logic and where bytes live (ADR-0005).
 *
 * Isomorphic on purpose — this module must stay free of Node APIs, because the web
 * app imports it for the type and for `MemoryStore`. The filesystem implementation
 * lives behind the `@threader/store/fs` entry point instead.
 */
export type Storage = {
  listThreads(): Promise<Thread[]>
  getThread(id: string): Promise<Thread | null>
  putThread(thread: Thread): Promise<void>
  deleteThread(id: string): Promise<void>

  listProfiles(): Promise<Profile[]>
  getProfile(id: string): Promise<Profile | null>
  putProfile(profile: Profile): Promise<void>
}

export class MemoryStore implements Storage {
  #threads = new Map<string, Thread>()
  #profiles = new Map<string, Profile>()

  async listThreads(): Promise<Thread[]> {
    return [...this.#threads.values()]
  }

  async getThread(id: string): Promise<Thread | null> {
    return this.#threads.get(id) ?? null
  }

  async putThread(thread: Thread): Promise<void> {
    this.#threads.set(thread.id, thread)
  }

  async deleteThread(id: string): Promise<void> {
    this.#threads.delete(id)
  }

  async listProfiles(): Promise<Profile[]> {
    return [...this.#profiles.values()]
  }

  async getProfile(id: string): Promise<Profile | null> {
    return this.#profiles.get(id) ?? null
  }

  async putProfile(profile: Profile): Promise<void> {
    this.#profiles.set(profile.id, profile)
  }
}
