import type { Platform } from './types.js'

/**
 * Per-platform defaults. A profile stores its own `charLimit`, so these are only the
 * starting point when you pick a platform — never a cap enforced behind your back.
 */
export const PLATFORM_LIMITS: Record<Platform, number> = {
  x: 280,
  bluesky: 300,
  mastodon: 500,
  custom: 280,
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  x: 'X',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  custom: 'Custom',
}

export const PLATFORMS: Platform[] = ['x', 'bluesky', 'mastodon', 'custom']

/**
 * Separator between a post's body and its numbering. Offered as a short list because
 * the raw strings ("\n\n" vs " ") are not something to type into a settings field.
 */
export const NUMBERING_SEPARATORS: { value: string; label: string }[] = [
  { value: '\n\n', label: 'Blank line' },
  { value: '\n', label: 'New line' },
  { value: ' ', label: 'Space' },
]
