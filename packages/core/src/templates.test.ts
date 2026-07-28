import { describe, expect, it } from 'vitest'
import { countX } from './count.js'
import { needsUrl, PLACEHOLDER_URL, resolveTemplate } from './templates.js'

describe('resolveTemplate', () => {
  it('fills in the values it has', () => {
    const out = resolveTemplate('{{handle}} wrote {{count}} posts about {{title}}', {
      handle: '@me',
      count: 9,
      title: 'centaurs',
    })
    expect(out).toBe('@me wrote 9 posts about centaurs')
  })

  it('uses the real URL once there is one', () => {
    expect(resolveTemplate('repost {{url}}', { url: 'https://x.com/me/status/1' })).toBe(
      'repost https://x.com/me/status/1',
    )
  })

  it('stands in for an unresolved url', () => {
    expect(resolveTemplate('repost {{url}}')).toBe(`repost ${PLACEHOLDER_URL}`)
  })

  it('makes an unresolved url cost what a real one will', () => {
    // The whole point of a URL-shaped placeholder: 23 either way, so a closing post
    // that measured fine before publishing still fits after.
    const before = countX(resolveTemplate('Repost the first post: {{url}}'))
    const after = countX(
      resolveTemplate('Repost the first post: {{url}}', {
        url: 'https://x.com/matiasbaldanza/status/1234567890123456789',
      }),
    )
    expect(before).toBe(after)
  })

  it('tolerates whitespace inside the braces', () => {
    expect(resolveTemplate('{{ handle }}', { handle: '@me' })).toBe('@me')
  })

  it('leaves unknown placeholders alone', () => {
    expect(resolveTemplate('{{nonsense}}')).toBe('{{nonsense}}')
  })
})

describe('needsUrl', () => {
  it('spots a template still waiting on post 1', () => {
    expect(needsUrl('repost {{url}}')).toBe(true)
    expect(needsUrl('no link here')).toBe(false)
  })
})
