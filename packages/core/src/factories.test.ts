import { describe, expect, it } from 'vitest'
import {
  createPost,
  createProfile,
  createThread,
  defaultNumbering,
  deriveTitle,
  withProfileDefaults,
} from './factories.js'

const ids = () => 'fixed-id'
const clock = () => '2026-07-27T00:00:00.000Z'

describe('createThread', () => {
  it('starts empty, attached, and unpublished', () => {
    const thread = createThread({ profileId: 'p1' }, { ids, clock })

    expect(thread).toMatchObject({
      id: 'fixed-id',
      profileId: 'p1',
      posts: [],
      closing: null,
      publishRun: null,
      detached: false,
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z',
    })
  })
})

describe('createPost', () => {
  it('holds body text only, with no numbering baked in', () => {
    const post = createPost('First thing 1/5', { ids })

    // The "1/5" here is literal user text — the factory must not parse, strip,
    // or otherwise interpret numbering. Numbering is derived at render (ADR-0003).
    expect(post.text).toBe('First thing 1/5')
    expect(post.locked).toBe(false)
    expect(post.published).toBeNull()
  })
})

describe('createProfile', () => {
  it('defaults to X at 280 with a repost-ask closing template', () => {
    const profile = createProfile({ name: 'Main', handle: '@matiasbaldanza' }, { ids })

    expect(profile.platform).toBe('x')
    expect(profile.charLimit).toBe(280)
    expect(profile.numbering.format).toBe('{n}/{total}')
    expect(profile.closingTemplates[0]?.body).toContain('{{url}}')
  })
})

describe('deriveTitle', () => {
  it('uses the first non-empty line', () => {
    expect(deriveTitle('\n\n  Reverse centaurs  \n\nmore text')).toBe('Reverse centaurs')
  })

  it('truncates a long first line', () => {
    const title = deriveTitle('x'.repeat(100))
    expect(title).toHaveLength(58)
    expect(title.endsWith('…')).toBe(true)
  })

  it('falls back for an empty draft', () => {
    expect(deriveTitle('   \n\n ')).toBe('Untitled thread')
  })
})

describe('withProfileDefaults', () => {
  it('fills in settings a profile saved by an older version lacks', () => {
    // A file written before end markers existed: the key is simply absent, and
    // undefined reads as "off" everywhere downstream.
    const stored = {
      ...createProfile({ name: 'Old', handle: '@old' }, { ids }),
      numbering: {
        format: '{n}/{total}',
        position: 'suffix',
        separator: '\n\n',
        includeFirst: true,
        includeClosing: false,
      },
    } as never

    const profile = withProfileDefaults(stored)
    expect(profile.numbering.endMarker).toBe('')
    expect(profile.numbering.endMarkerSeparator).toBe(' ')
  })

  it('does not overwrite settings that are present', () => {
    const profile = withProfileDefaults({
      ...createProfile({ name: 'New', handle: '@new' }, { ids }),
      numbering: { ...defaultNumbering, endMarker: 'FIN' },
    })
    expect(profile.numbering.endMarker).toBe('FIN')
  })
})
