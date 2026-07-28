import type { Platform } from './types.js'

/**
 * Character counting (ADR-0006).
 *
 * `String.length` is wrong for X in three ways, and the dangerous direction is
 * UNDERCOUNTING — a post the app blessed gets rejected at paste time, mid-publish,
 * after earlier posts are already live. When in doubt, count more.
 *
 * X's rules (twitter-text v3 config):
 * - URLs are replaced by a t.co link and count as a flat 23, however long they are.
 * - Code points below U+1100 (plus a few punctuation ranges) weigh 1; everything
 *   else — CJK, emoji — weighs 2.
 * - Text is NFC-normalized first, so "e + combining acute" counts as 1, not 2.
 * - An emoji ZWJ sequence (👨‍👩‍👧‍👦) counts as one emoji, i.e. 2 — not 2 per component.
 */

export type CharCounter = (text: string) => number

export const TRANSFORMED_URL_LENGTH = 23

/** Ranges whose code points weigh 1. Everything outside them weighs 2. */
const LIGHT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2037],
]

function codePointWeight(cp: number): number {
  for (const [lo, hi] of LIGHT_RANGES) {
    if (cp >= lo && cp <= hi) return 1
  }
  return 2
}

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('en', { granularity: 'grapheme' })
    : null

/** Grapheme clusters — what a human calls "a character". */
export function graphemes(text: string): string[] {
  if (!segmenter) return [...text]
  return [...segmenter.segment(text)].map((s) => s.segment)
}

/**
 * A cluster containing a pictograph or a regional indicator is an emoji or flag,
 * and counts as a single weight-2 unit no matter how many code points it spans.
 */
const EMOJI_CLUSTER = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u

/**
 * TLDs recognised in bare domains like `example.com`. X auto-links these, so they
 * cost 23 — missing one means undercounting.
 *
 * Deliberately a curated list rather than the full IANA set: the full set makes
 * ordinary prose ("etc.so", "Node.js") register as links. Extend it when something
 * real is missed.
 */
const TLDS = [
  'com', 'net', 'org', 'edu', 'gov', 'io', 'dev', 'co', 'app', 'ai', 'me', 'xyz',
  'info', 'blog', 'news', 'page', 'site', 'link', 'cloud', 'tech', 'design',
  'studio', 'agency', 'tv', 'fm', 'sh', 'gg', 'ly', 'to', 'so',
  'uk', 'us', 'de', 'fr', 'es', 'it', 'nl', 'se', 'no', 'dk', 'fi', 'pl', 'pt',
  'ch', 'at', 'be', 'cz', 'gr', 'ie', 'il', 'ru', 'tr', 'za',
  'br', 'ar', 'mx', 'cl', 'uy', 'ca', 'jp', 'cn', 'kr', 'in', 'au', 'nz',
]

const LABEL = String.raw`[a-z0-9](?:[a-z0-9-]*[a-z0-9])?`
const URL_RE = new RegExp(
  [
    String.raw`(?:https?:\/\/|www\.)[^\s<>"']+`,
    String.raw`${LABEL}(?:\.${LABEL})*\.(?:${TLDS.join('|')})\b(?:\/[^\s<>"']*)?`,
  ].join('|'),
  'gi',
)

/** Trailing punctuation that reads as prose, not part of the link. */
const TRAILING_PUNCT = /[.,;:!?)\]}'"»]+$/

export type UrlMatch = { start: number; end: number; text: string }

/** Every URL in `text`, in order, with trailing prose punctuation excluded. */
export function findUrls(text: string): UrlMatch[] {
  const out: UrlMatch[] = []
  URL_RE.lastIndex = 0
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index
    // Not a URL if it is the domain half of an email address.
    if (start > 0 && text[start - 1] === '@') continue
    let matched = m[0]
    const trimmed = matched.replace(TRAILING_PUNCT, '')
    // A URL may legitimately end in a paren-heavy path; only trim when something
    // is left over that still looks like a link.
    if (trimmed.includes('.')) matched = trimmed
    out.push({ start, end: start + matched.length, text: matched })
  }
  return out
}

export function containsUrl(text: string): boolean {
  return findUrls(text).length > 0
}

function weighPlainText(text: string): number {
  let weight = 0
  for (const cluster of graphemes(text)) {
    if (EMOJI_CLUSTER.test(cluster)) {
      weight += 2
      continue
    }
    for (const ch of cluster) weight += codePointWeight(ch.codePointAt(0) ?? 0)
  }
  return weight
}

function countGraphemesPlain(text: string): number {
  return graphemes(text).length
}

/**
 * Builds a counter from the two things that vary between platforms: whether code
 * points are weighted, and what a URL costs (`null` = its literal length).
 */
function makeCounter(opts: { weighted: boolean; urlCost: number | null }): CharCounter {
  const weigh = opts.weighted ? weighPlainText : countGraphemesPlain
  return (text: string) => {
    const normalized = text.normalize('NFC')
    if (opts.urlCost === null) return weigh(normalized)

    let total = 0
    let cursor = 0
    for (const url of findUrls(normalized)) {
      total += weigh(normalized.slice(cursor, url.start))
      total += opts.urlCost
      cursor = url.end
    }
    return total + weigh(normalized.slice(cursor))
  }
}

/** X: weighted code points, URLs flat 23. */
export const countX: CharCounter = makeCounter({
  weighted: true,
  urlCost: TRANSFORMED_URL_LENGTH,
})

/** Bluesky: 300 graphemes, links counted at their literal length. */
export const countBluesky: CharCounter = makeCounter({ weighted: false, urlCost: null })

/** Mastodon: 500 graphemes, links flat 23. */
export const countMastodon: CharCounter = makeCounter({
  weighted: false,
  urlCost: TRANSFORMED_URL_LENGTH,
})

export function counterFor(platform: Platform): CharCounter {
  switch (platform) {
    case 'x':
      return countX
    case 'bluesky':
      return countBluesky
    case 'mastodon':
      return countMastodon
    case 'custom':
      return countBluesky
  }
}
