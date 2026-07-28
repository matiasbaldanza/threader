import { describe, expect, it } from 'vitest'
import { countX } from './count.js'
import { defaultNumbering } from './factories.js'
import { applyNumbering } from './numbering.js'
import { normalize, split, splitOnForcedBreaks, tokenize } from './split.js'
import type { NumberingConfig } from './types.js'

const cfg = (over: Partial<NumberingConfig> = {}): NumberingConfig => ({
  ...defaultNumbering,
  ...over,
})

/** The invariant that matters: every rendered post fits, numbering included. */
function expectAllFit(posts: string[], charLimit: number, numbering = cfg()) {
  posts.forEach((text, index) => {
    const rendered = applyNumbering(text, { index, total: posts.length }, numbering)
    expect(countX(rendered), `post ${index + 1}: ${JSON.stringify(rendered)}`)
      .toBeLessThanOrEqual(charLimit)
  })
}

describe('normalize', () => {
  it('collapses runs of blank lines and trims trailing whitespace', () => {
    expect(normalize('a   \n\n\n\nb\n')).toBe('a\n\nb')
  })

  it('normalizes CRLF', () => {
    expect(normalize('a\r\nb')).toBe('a\nb')
  })
})

describe('splitOnForcedBreaks', () => {
  it('splits on a line containing only ---', () => {
    expect(splitOnForcedBreaks('one\n---\ntwo')).toEqual(['one', 'two'])
  })

  it('ignores dashes that are part of a line', () => {
    expect(splitOnForcedBreaks('a --- b')).toEqual(['a --- b'])
  })

  it('drops empty segments from doubled markers', () => {
    expect(splitOnForcedBreaks('a\n---\n\n---\nb')).toEqual(['a', 'b'])
  })
})

describe('tokenize', () => {
  it('marks the gap following each word', () => {
    const tokens = tokenize('one two\nthree\n\nfour')
    expect(tokens.map((t) => [t.text, t.after])).toEqual([
      ['one', 'word'],
      ['two', 'line'],
      ['three', 'paragraph'],
      ['four', 'end'],
    ])
  })

  it('marks sentence ends', () => {
    const tokens = tokenize('Stop. Go on')
    expect(tokens[0]?.sentenceEnd).toBe(true)
    expect(tokens[1]?.sentenceEnd).toBe(false)
  })

  it('does not treat abbreviations as sentence ends', () => {
    expect(tokenize('e.g. This thing')[0]?.sentenceEnd).toBe(false)
    expect(tokenize('Node vs. Deno here')[1]?.sentenceEnd).toBe(false)
  })

  it('does not treat initials as sentence ends', () => {
    expect(tokenize('J. Smith wrote')[0]?.sentenceEnd).toBe(false)
  })

  it('does not break a sentence when the next word is lowercase', () => {
    expect(tokenize('version 20.10. then more')[1]?.sentenceEnd).toBe(false)
  })
})

describe('split — basics', () => {
  it('returns nothing for empty input', () => {
    expect(split('', { charLimit: 280 })).toEqual([])
    expect(split('   \n\n  ', { charLimit: 280 })).toEqual([])
  })

  it('leaves short text as a single post', () => {
    expect(split('just a short thought', { charLimit: 280 })).toEqual([
      'just a short thought',
    ])
  })

  it('loses no words', () => {
    const source = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ')
    const posts = split(source, { charLimit: 100 })
    expect(posts.join(' ').split(/\s+/)).toEqual(source.split(' '))
  })

  it('keeps every post within the limit once numbered', () => {
    const source = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ')
    const posts = split(source, { charLimit: 280 })
    expect(posts.length).toBeGreaterThan(1)
    expectAllFit(posts, 280)
  })
})

describe('split — forced breaks', () => {
  it('always starts a new post at ---', () => {
    const posts = split('first thought\n---\nsecond thought', { charLimit: 280 })
    expect(posts).toEqual(['first thought', 'second thought'])
  })

  it('never merges across a forced break, even when both would fit', () => {
    const posts = split('a\n---\nb\n---\nc', { charLimit: 280 })
    expect(posts).toEqual(['a', 'b', 'c'])
  })

  it('still splits a segment that is too long on its own', () => {
    const long = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ')
    const posts = split(`intro\n---\n${long}`, { charLimit: 100 })
    expect(posts[0]).toBe('intro')
    expect(posts.length).toBeGreaterThan(2)
    expectAllFit(posts, 100)
  })
})

describe('split — break preference', () => {
  it('prefers a paragraph boundary over filling the post', () => {
    const a = 'Paragraph one is reasonably long but not enormous here.'
    const b = 'Paragraph two follows and is also reasonably long here.'
    const posts = split(`${a}\n\n${b}`, { charLimit: 70 })
    expect(posts[0]).toBe(a)
    expect(posts[1]).toBe(b)
  })

  it('prefers a sentence boundary over breaking mid-sentence', () => {
    const source = 'First sentence here. Second sentence is quite a bit longer than that.'
    const posts = split(source, { charLimit: 45 })
    expect(posts[0]).toBe('First sentence here.')
  })

  it('breaks mid-sentence rather than leave a post nearly empty', () => {
    // The only sentence boundary is 4 chars in — backing off to it would waste
    // the whole post, so greedy word packing wins.
    const source = `Yes. ${'filler '.repeat(30)}end`
    const posts = split(source, { charLimit: 100, minFill: 0.5 })
    expect(posts[0]).not.toBe('Yes.')
    expectAllFit(posts, 100)
  })

  it('respects minFill = 0 by always taking the nicest boundary', () => {
    const source = 'Yes. Then a much longer stretch of words follows this one.'
    const posts = split(source, { charLimit: 50, minFill: 0 })
    expect(posts[0]).toBe('Yes.')
  })
})

describe('split — numbering budget', () => {
  it('reserves room for the numbering suffix', () => {
    // 40 chars of body would fit a 40 limit, but "\n\n1/2" costs 5 more.
    const source = 'abcde fghij klmno pqrst uvwxy zabcd efgh'
    expect(countX(source)).toBe(40)
    const posts = split(source, { charLimit: 40 })
    expect(posts.length).toBeGreaterThan(1)
    expectAllFit(posts, 40)
  })

  it('reserves nothing when numbering is disabled', () => {
    const source = 'abcde fghij klmno pqrst uvwxy zabcd efgh'
    const posts = split(source, { charLimit: 40, numbering: cfg({ format: '' }) })
    expect(posts).toEqual([source])
  })

  it('accounts for an emoji in the numbering format', () => {
    const numbering = cfg({ format: '🧵{n}/{total}' })
    const source = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')
    const posts = split(source, { charLimit: 120, numbering })
    expectAllFit(posts, 120, numbering)
  })

  it('gives post 1 a larger budget when it is unnumbered', () => {
    const numbering = cfg({ includeFirst: false })
    const source = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')
    const posts = split(source, { charLimit: 100, numbering })
    expectAllFit(posts, 100, numbering)
    expect(countX(posts[0]!)).toBeGreaterThan(countX(posts[1]!))
  })

  it('reaches a fixpoint when the total crosses a digit boundary', () => {
    // Around 9→10 posts the numbering widens from "9/9" to "9/10", shrinking the
    // budget, which can push the count up again. The result must still fit.
    const source = Array.from({ length: 300 }, (_, i) => `w${i}`).join(' ')
    const posts = split(source, { charLimit: 60 })
    expect(posts.length).toBeGreaterThan(9)
    expectAllFit(posts, 60)
  })
})

describe('split — things that must never be broken', () => {
  it('keeps a URL intact', () => {
    const url = 'https://example.com/a/very/long/path/that/goes/on?x=1&y=2'
    const source = `${'padding '.repeat(30)}${url} tail`
    const posts = split(source, { charLimit: 100 })
    expect(posts.some((p) => p.includes(url))).toBe(true)
    expectAllFit(posts, 100)
  })

  it('keeps handles and hashtags intact', () => {
    const source = `${'padding '.repeat(25)}@matiasbaldanza #reversecentaur tail`
    const posts = split(source, { charLimit: 80 })
    expect(posts.some((p) => p.includes('@matiasbaldanza'))).toBe(true)
    expect(posts.some((p) => p.includes('#reversecentaur'))).toBe(true)
  })

  it('slices a single token that cannot fit anywhere', () => {
    const blob = 'x'.repeat(500)
    const posts = split(blob, { charLimit: 100 })
    expect(posts.length).toBeGreaterThan(4)
    expect(posts.join('')).toBe(blob)
    expectAllFit(posts, 100)
  })

  it('does not slice emoji in half when it has to hard-slice', () => {
    const posts = split('🙏'.repeat(100), { charLimit: 30 })
    expectAllFit(posts, 30)
    // A broken surrogate pair would render as U+FFFD.
    expect(posts.join('')).not.toContain('�')
    expect(posts.join('')).toBe('🙏'.repeat(100))
  })
})

describe('split — weighted counting in practice', () => {
  it('packs fewer CJK characters per post than Latin ones', () => {
    const latin = split('ab '.repeat(200), { charLimit: 200 })
    const cjk = split('日本 '.repeat(200), { charLimit: 200 })
    expect(cjk.length).toBeGreaterThan(latin.length)
    expectAllFit(cjk, 200)
  })

  it('treats a long URL as only 23 characters when packing', () => {
    const url = `https://example.com/${'x'.repeat(200)}`
    const posts = split(`before ${url} after`, { charLimit: 100 })
    expect(posts).toHaveLength(1)
  })
})
