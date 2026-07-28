import type { Profile, Thread } from '@threader/core'
import type { Storage } from '@threader/store'

/**
 * `Storage` over the local server. Same interface the filesystem implements, so the
 * app never learns whether it is talking to a disk, a memory map, or HTTP.
 */
export class HttpStore implements Storage {
  constructor(private readonly base = '/api') {}

  async #json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${response.status} ${detail}`)
    }
    return (await response.json()) as T
  }

  listThreads(): Promise<Thread[]> {
    return this.#json<Thread[]>('/threads')
  }

  async getThread(id: string): Promise<Thread | null> {
    try {
      return await this.#json<Thread>(`/threads/${encodeURIComponent(id)}`)
    } catch {
      return null
    }
  }

  async putThread(thread: Thread): Promise<void> {
    await this.#json(`/threads/${encodeURIComponent(thread.id)}`, {
      method: 'PUT',
      body: JSON.stringify(thread),
    })
  }

  async renameThread(id: string, title: string): Promise<void> {
    await this.#json(`/threads/${encodeURIComponent(id)}/rename`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    })
  }

  async deleteThread(id: string): Promise<void> {
    await this.#json(`/threads/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  listProfiles(): Promise<Profile[]> {
    return this.#json<Profile[]>('/profiles')
  }

  async getProfile(id: string): Promise<Profile | null> {
    const all = await this.listProfiles()
    return all.find((p) => p.id === id) ?? null
  }

  async putProfile(profile: Profile): Promise<void> {
    await this.#json(`/profiles/${encodeURIComponent(profile.id)}`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    })
  }
}
