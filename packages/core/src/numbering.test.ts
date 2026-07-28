import { describe, expect, it } from 'vitest'
import { countX } from './count.js'
import { defaultNumbering } from './factories.js'
import {
  applyNumbering,
  numberingApplies,
  numberingOverhead,
  renderNumbering,
} from './numbering.js'
import type { NumberingConfig } from './types.js'

const cfg = (over: Partial<NumberingConfig> = {}): NumberingConfig => ({
  ...defaultNumbering,
  ...over,
})

describe('renderNumbering', () => {
  it('substitutes n and total', () => {
    expect(renderNumbering(3, 12, cfg())).toBe('3/12')
  })

  it('supports an emoji format', () => {
    expect(renderNumbering(1, 5, cfg({ format: '🧵{n}/{total}' }))).toBe('🧵1/5')
  })

  it('returns nothing for an empty format', () => {
    expect(renderNumbering(1, 5, cfg({ format: '' }))).toBe('')
  })
})

describe('applyNumbering', () => {
  it('appends as a suffix by default', () => {
    expect(applyNumbering('hello', { index: 0, total: 3 }, cfg())).toBe('hello\n\n1/3')
  })

  it('prepends when configured as a prefix', () => {
    const c = cfg({ position: 'prefix', separator: ' ' })
    expect(applyNumbering('hello', { index: 0, total: 3 }, c)).toBe('1/3 hello')
  })

  it('leaves post 1 unnumbered when includeFirst is false', () => {
    const c = cfg({ includeFirst: false })
    expect(applyNumbering('hook', { index: 0, total: 3 }, c)).toBe('hook')
    expect(applyNumbering('second', { index: 1, total: 3 }, c)).toBe('second\n\n2/3')
  })

  it('leaves the closing post unnumbered by default', () => {
    const slot = { index: 3, total: 3, isClosing: true }
    expect(applyNumbering('repost pls', slot, cfg())).toBe('repost pls')
  })

  it('never mutates or parses numbers already in the body', () => {
    // "3/4 of users" is user text. Numbering is additive, never interpretive.
    const out = applyNumbering('3/4 of users agree', { index: 1, total: 9 }, cfg())
    expect(out).toBe('3/4 of users agree\n\n2/9')
  })
})

describe('numberingApplies', () => {
  it('is false when there is no format at all', () => {
    expect(numberingApplies({ index: 2, total: 5 }, cfg({ format: '' }))).toBe(false)
  })
})

describe('numberingOverhead', () => {
  it('measures the label plus its separator', () => {
    // "\n\n" is 2, "1/12" is 4.
    expect(numberingOverhead({ index: 0, total: 12 }, cfg(), countX)).toBe(6)
  })

  it('grows with the digit width of the total', () => {
    const narrow = numberingOverhead({ index: 0, total: 9 }, cfg(), countX)
    const wide = numberingOverhead({ index: 0, total: 100 }, cfg(), countX)
    expect(wide).toBeGreaterThan(narrow)
  })

  it('accounts for emoji in the format at weight 2', () => {
    const c = cfg({ format: '🧵{n}/{total}' })
    // 2 (separator) + 2 (emoji) + 4 ("1/12")
    expect(numberingOverhead({ index: 0, total: 12 }, c, countX)).toBe(8)
  })

  it('is zero where numbering does not apply', () => {
    const c = cfg({ includeFirst: false })
    expect(numberingOverhead({ index: 0, total: 5 }, c, countX)).toBe(0)
  })
})
