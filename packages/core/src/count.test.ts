import { describe, expect, it } from 'vitest'
import { countBluesky, countMastodon, countX, findUrls, graphemes } from './count.js'

describe('countX — plain text', () => {
  it('counts ASCII one per character', () => {
    expect(countX('hello')).toBe(5)
    expect(countX('')).toBe(0)
  })

  it('counts newlines and spaces', () => {
    expect(countX('a\n\nb')).toBe(4)
  })

  it('counts Latin accents as 1 after NFC normalization', () => {
    // Composed and decomposed forms must agree, or the counter disagrees with
    // itself depending on how the text was pasted.
    expect(countX('café')).toBe(4)
    expect(countX('café')).toBe(4)
  })

  it('counts Cyrillic and Greek as 1 — they are below U+1100', () => {
    expect(countX('привет')).toBe(6)
    expect(countX('γειά')).toBe(4)
  })
})

describe('countX — weighted ranges', () => {
  it('counts CJK as 2', () => {
    expect(countX('日本語')).toBe(6)
  })

  it('counts a simple emoji as 2, not its UTF-16 length', () => {
    expect('🙏'.length).toBe(2)
    expect(countX('🙏')).toBe(2)
  })

  it('counts a ZWJ emoji sequence as a single emoji', () => {
    // 👨‍👩‍👧‍👦 is 11 UTF-16 units and 7 code points, but one emoji: 2.
    const family = '👨‍👩‍👧‍👦'
    expect(family.length).toBe(11)
    expect(countX(family)).toBe(2)
  })

  it('counts a skin-tone modified emoji as one emoji', () => {
    expect(countX('👍🏽')).toBe(2)
  })

  it('counts a flag as one emoji', () => {
    expect(countX('🇦🇷')).toBe(2)
  })
})

describe('countX — URLs', () => {
  it('counts a short URL as 23, more than its literal length', () => {
    expect(countX('https://x.com')).toBe(23)
  })

  it('counts a long URL as 23, far less than its literal length', () => {
    const long = 'https://example.com/a/very/long/path?with=query&and=more#anchor'
    expect(long.length).toBeGreaterThan(50)
    expect(countX(long)).toBe(23)
  })

  it('counts a bare domain as a URL — X auto-links it', () => {
    // Undercounting here is the dangerous direction: it would let an over-limit
    // post through and fail at paste time.
    expect(countX('example.com')).toBe(23)
  })

  it('counts text around a URL correctly', () => {
    expect(countX('see https://x.com ok')).toBe(4 + 23 + 3)
  })

  it('does not count the domain half of an email as a URL', () => {
    expect(countX('me@example.com')).toBe(14)
  })

  it('excludes trailing sentence punctuation from the URL', () => {
    // "Visit example.com." — the period is prose, not part of the link.
    expect(countX('Visit example.com.')).toBe(6 + 23 + 1)
  })

  it('does not treat ordinary prose with periods as a link', () => {
    expect(countX('Node 20.10.1 works.')).toBe(19)
  })
})

describe('other platforms', () => {
  it('bluesky counts graphemes and does not shorten links', () => {
    expect(countBluesky('日本語')).toBe(3)
    expect(countBluesky('👨‍👩‍👧‍👦')).toBe(1)
    expect(countBluesky('https://x.com')).toBe(13)
  })

  it('mastodon counts graphemes but shortens links to 23', () => {
    expect(countMastodon('https://example.com/very/long/path')).toBe(23)
  })
})

describe('graphemes', () => {
  it('treats a ZWJ sequence as one cluster', () => {
    expect(graphemes('a👨‍👩‍👧‍👦b')).toEqual(['a', '👨‍👩‍👧‍👦', 'b'])
  })
})

describe('findUrls', () => {
  it('reports position and text for each URL', () => {
    expect(findUrls('a https://x.com b example.org c')).toEqual([
      { start: 2, end: 15, text: 'https://x.com' },
      { start: 18, end: 29, text: 'example.org' },
    ])
  })
})
