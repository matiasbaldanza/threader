import type { CharCounter } from './count.js'
import { counterFor } from './count.js'
import type { NumberingConfig, Post, Profile, Thread } from './types.js'

/**
 * Numbering is derived here and nowhere else (ADR-0003). `Post.text` is the body;
 * the string this module returns is what the counter measures and what the publish
 * wizard copies to the clipboard.
 */

/** Which slot in the thread a piece of text occupies. */
export type Slot = { index: number; total: number; isClosing?: boolean }

export function renderNumbering(n: number, total: number, cfg: NumberingConfig): string {
  if (!cfg.format) return ''
  return cfg.format.replaceAll('{n}', String(n)).replaceAll('{total}', String(total))
}

export function numberingApplies(slot: Slot, cfg: NumberingConfig): boolean {
  if (!cfg.format) return false
  if (slot.isClosing) return cfg.includeClosing
  if (slot.index === 0) return cfg.includeFirst
  return true
}

/** Body text plus its numbering — exactly what gets posted. */
export function applyNumbering(text: string, slot: Slot, cfg: NumberingConfig): string {
  if (!numberingApplies(slot, cfg)) return text
  const label = renderNumbering(slot.index + 1, slot.total, cfg)
  if (!label) return text
  return cfg.position === 'prefix' ? label + cfg.separator + text : text + cfg.separator + label
}

/**
 * What numbering costs at this slot, in characters. The splitter subtracts this
 * from the character limit to get the real budget for body text.
 *
 * Measured rather than computed, so the format string, the separator, and any
 * emoji inside the format are all accounted for automatically.
 */
export function numberingOverhead(
  slot: Slot,
  cfg: NumberingConfig,
  count: CharCounter,
): number {
  return count(applyNumbering('', slot, cfg))
}

export function renderPost(post: Post, slot: Slot, profile: Profile): string {
  return applyNumbering(post.text, slot, profile.numbering)
}

export type RenderedPost = {
  id: string
  /** Body plus numbering — the string to copy. */
  text: string
  chars: number
  limit: number
  overLimit: boolean
  isClosing: boolean
  published: boolean
}

/**
 * Total shown as `{total}`. The closing post is counted only when it is itself
 * numbered — otherwise "12/12" would name a post the reader never sees numbered.
 */
export function threadTotal(thread: Thread, profile: Profile): number {
  const closingCounts = thread.closing !== null && profile.numbering.includeClosing
  return thread.posts.length + (closingCounts ? 1 : 0)
}

export function renderThread(thread: Thread, profile: Profile): RenderedPost[] {
  const count = counterFor(profile.platform)
  const total = threadTotal(thread, profile)

  const rendered: RenderedPost[] = thread.posts.map((post, index) => {
    const text = renderPost(post, { index, total }, profile)
    const chars = count(text)
    return {
      id: post.id,
      text,
      chars,
      limit: profile.charLimit,
      overLimit: chars > profile.charLimit,
      isClosing: false,
      published: post.published !== null,
    }
  })

  if (thread.closing) {
    const slot = { index: thread.posts.length, total, isClosing: true }
    const text = applyNumbering(thread.closing.text, slot, profile.numbering)
    const chars = count(text)
    rendered.push({
      id: 'closing',
      text,
      chars,
      limit: profile.charLimit,
      overLimit: chars > profile.charLimit,
      isClosing: true,
      published: thread.closing.published !== null,
    })
  }

  return rendered
}
