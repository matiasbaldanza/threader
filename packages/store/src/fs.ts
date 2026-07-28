import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Profile, Thread } from '@threader/core'
import type { Storage } from './storage.js'
import { assertSafeId, resolveWithin, slugify } from './paths.js'

/**
 * Plain JSON on disk (ADR-0005):
 *
 *   <home>/profiles/<slug>.json
 *   <home>/threads/<yyyy-mm-dd>-<slug>/thread.json
 *                                     /assets/        (Stage 8)
 *
 * Folder names are human-readable on purpose — a future CLI reads the same files, and
 * the whole thing stays greppable and git-friendly if you want thread history.
 */

export function defaultHome(): string {
  return process.env['THREADER_HOME'] ?? join(homedir(), 'threader')
}

/**
 * Writes go to a temp file and are then renamed, which is atomic on the same
 * filesystem. Autosave fires on every keystroke pause — a crash mid-write must never
 * leave a half-written thread.json where a whole thread used to be.
 */
async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}`
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tmp, path)
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    // Missing, unreadable, or corrupt — treated the same. A single bad file must not
    // take down the whole thread list.
    return null
  }
}

export class FsStore implements Storage {
  readonly home: string
  /** id → directory name. Rebuilt by `listThreads`, so a stale entry is self-healing. */
  #dirs = new Map<string, string>()

  constructor(home: string = defaultHome()) {
    this.home = resolveWithin(home)
  }

  get threadsDir(): string {
    return join(this.home, 'threads')
  }

  get profilesDir(): string {
    return join(this.home, 'profiles')
  }

  async init(): Promise<void> {
    await mkdir(this.threadsDir, { recursive: true })
    await mkdir(this.profilesDir, { recursive: true })
  }

  // ── threads ──────────────────────────────────────────────────────────────

  async listThreads(): Promise<Thread[]> {
    let entries: string[]
    try {
      entries = await readdir(this.threadsDir)
    } catch {
      return []
    }

    const threads: Thread[] = []
    this.#dirs.clear()
    for (const dir of entries) {
      const thread = await readJson<Thread>(join(this.threadsDir, dir, 'thread.json'))
      if (!thread?.id) continue
      this.#dirs.set(thread.id, dir)
      threads.push(thread)
    }
    // Most recently touched first — the thread list is a "what was I doing" list.
    return threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getThread(id: string): Promise<Thread | null> {
    assertSafeId(id)
    const dir = await this.#dirFor(id)
    if (!dir) return null
    return readJson<Thread>(resolveWithin(this.threadsDir, dir, 'thread.json'))
  }

  async putThread(thread: Thread): Promise<void> {
    assertSafeId(thread.id)
    const dir = (await this.#dirFor(thread.id)) ?? (await this.#createDir(thread))
    const path = resolveWithin(this.threadsDir, dir, 'thread.json')
    await mkdir(join(this.threadsDir, dir), { recursive: true })
    await writeJsonAtomic(path, thread)
    this.#dirs.set(thread.id, dir)
  }

  async deleteThread(id: string): Promise<void> {
    assertSafeId(id)
    const dir = await this.#dirFor(id)
    if (!dir) return
    await rm(resolveWithin(this.threadsDir, dir), { recursive: true, force: true })
    this.#dirs.delete(id)
  }

  /**
   * Renames the thread's folder to match `title`, keeping the original creation date
   * prefix so the folder still sorts by when the thread was started.
   *
   * Called only for deliberate title edits, never for the title auto-following the
   * draft's first line — otherwise the folder would churn through `this/`,
   * `this-is/`, `this-is-the/` as you type an opening sentence.
   */
  async renameThread(id: string, title: string): Promise<void> {
    assertSafeId(id)
    const dir = await this.#dirFor(id)
    if (!dir) return

    // Keep the date the folder was created with; only the slug part follows the title.
    const datePrefix = /^(\d{4}-\d{2}-\d{2})-/.exec(dir)?.[1]
    const date = datePrefix ?? new Date().toISOString().slice(0, 10)
    const base = `${date}-${slugify(title)}`
    if (base === dir) return

    let taken: Set<string>
    try {
      taken = new Set(await readdir(this.threadsDir))
    } catch {
      return
    }
    taken.delete(dir)

    let target = base
    for (let n = 2; taken.has(target); n++) target = `${base}-${n}`

    await rename(resolveWithin(this.threadsDir, dir), resolveWithin(this.threadsDir, target))
    this.#dirs.set(id, target)
  }

  /** Directory for a thread's assets. Created on demand in Stage 8. */
  async assetsDir(id: string): Promise<string | null> {
    assertSafeId(id)
    const dir = await this.#dirFor(id)
    return dir ? resolveWithin(this.threadsDir, dir, 'assets') : null
  }

  async #dirFor(id: string): Promise<string | undefined> {
    if (this.#dirs.has(id)) return this.#dirs.get(id)
    await this.listThreads()
    return this.#dirs.get(id)
  }

  /**
   * `2026-07-28-reverse-centaurs`. The name is fixed when the thread is first saved
   * and never changes afterwards, even if the title does — renaming would break asset
   * paths and any link you had to the folder.
   */
  async #createDir(thread: Thread): Promise<string> {
    const date = (thread.createdAt || new Date().toISOString()).slice(0, 10)
    const base = `${date}-${slugify(thread.title)}`

    let taken: Set<string>
    try {
      taken = new Set(await readdir(this.threadsDir))
    } catch {
      taken = new Set()
    }

    if (!taken.has(base)) return base
    for (let n = 2; ; n++) {
      const candidate = `${base}-${n}`
      if (!taken.has(candidate)) return candidate
    }
  }

  // ── profiles ─────────────────────────────────────────────────────────────

  async listProfiles(): Promise<Profile[]> {
    let entries: string[]
    try {
      entries = await readdir(this.profilesDir)
    } catch {
      return []
    }

    const profiles: Profile[] = []
    for (const file of entries) {
      if (!file.endsWith('.json')) continue
      const profile = await readJson<Profile>(join(this.profilesDir, file))
      if (profile?.id) profiles.push(profile)
    }
    return profiles.sort((a, b) => a.name.localeCompare(b.name))
  }

  async getProfile(id: string): Promise<Profile | null> {
    assertSafeId(id)
    const all = await this.listProfiles()
    return all.find((p) => p.id === id) ?? null
  }

  async putProfile(profile: Profile): Promise<void> {
    assertSafeId(profile.id)
    await mkdir(this.profilesDir, { recursive: true })
    const existing = await this.#profileFile(profile.id)
    const file = existing ?? `${slugify(profile.name, profile.id)}.json`
    await writeJsonAtomic(resolveWithin(this.profilesDir, file), profile)
  }

  async #profileFile(id: string): Promise<string | null> {
    let entries: string[]
    try {
      entries = await readdir(this.profilesDir)
    } catch {
      return null
    }
    for (const file of entries) {
      if (!file.endsWith('.json')) continue
      const profile = await readJson<Profile>(join(this.profilesDir, file))
      if (profile?.id === id) return file
    }
    return null
  }
}
