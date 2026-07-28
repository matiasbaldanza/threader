import type { Platform } from '@threader/core'

/**
 * Single-letter platform mark. Deliberately not the real X / Bluesky / Mastodon
 * logos: those are trademarks, and shipping brand SVGs into the repo is the kind of
 * thing that is fine right up until it isn't. Swap these for the real marks later if
 * the letters ever bother you.
 */
const PLATFORM_MARK: Record<Platform, string> = {
  x: 'X',
  bluesky: 'B',
  mastodon: 'M',
  custom: '·',
}

/** Stable hue from the handle, so an account keeps the same colour across sessions. */
function hueFor(seed: string): number {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360
  return hash
}

function initialFor(handle: string, name: string): string {
  const source = handle.replace(/^@/, '') || name
  return [...source].find((c) => /\p{L}|\p{N}/u.test(c))?.toUpperCase() ?? '?'
}

type Props = {
  handle: string
  name: string
  platform: Platform
}

/**
 * Generated avatar — an initial on a colour derived from the handle. Real images wait
 * for Stage 8, which builds the upload endpoint and asset serving this would otherwise
 * have to duplicate.
 */
export function Avatar({ handle, name, platform }: Props) {
  return (
    <span
      className="avatar"
      style={{ '--avatar-hue': hueFor(handle || name) } as React.CSSProperties}
      aria-hidden="true"
    >
      {initialFor(handle, name)}
      <span className="avatar__badge">{PLATFORM_MARK[platform]}</span>
    </span>
  )
}
