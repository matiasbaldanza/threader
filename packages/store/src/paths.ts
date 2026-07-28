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

/** Folder-name-safe version of a title, for human-readable thread directories. */
export function slugify(text: string, fallback = 'untitled'): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  return slug || fallback
}
