import { resolve, sep } from 'node:path'

/**
 * Path safety for everything under THREADER_HOME (ADR-0005).
 *
 * The local server takes paths from HTTP requests. Without this, a thread id of
 * `../../../.ssh/id_rsa` would read or overwrite whatever it liked. Every path that
 * originates outside this process goes through `resolveWithin`.
 */
export function resolveWithin(root: string, ...segments: string[]): string {
  const base = resolve(root)
  const target = resolve(base, ...segments)
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error(`path escapes THREADER_HOME: ${target}`)
  }
  return target
}

/** Rejects anything that could traverse or address a parent directory. */
export function assertSafeId(id: string): string {
  if (!id || id.includes('/') || id.includes('\\') || id.includes('\0') || id === '.' || id === '..') {
    throw new Error(`unsafe id: ${JSON.stringify(id)}`)
  }
  return id
}

/**
 * Folder-name-safe version of a title.
 *
 * Kept short on purpose: the folder only has to be recognisable in `ls` and in a
 * file picker, not to reproduce the title \u2014 the real title lives in thread.json and
 * can be as long as it likes. Truncation lands on a word boundary, because
 * `persistence-is-the-boring-feature-that-makes-eve` reads worse than
 * `persistence-is-the-boring`. Collisions get a numeric suffix from the caller.
 */
export function slugify(text: string, fallback = 'untitled', maxLength = 28): string {
  const full = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (full.length <= maxLength) return full || fallback

  const cut = full.slice(0, maxLength + 1)
  const lastBreak = cut.lastIndexOf('-')
  // Fall back to a hard cut when the first word alone is longer than the limit.
  const trimmed = (lastBreak > 0 ? cut.slice(0, lastBreak) : full.slice(0, maxLength))
    .replace(/-+$/, '')

  return trimmed || fallback
}
