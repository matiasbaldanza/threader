import type { CharCounter } from './count.js'
import { counterFor } from './count.js'
import { resolveTemplate } from './templates.js'
import type { NumberingConfig, Post, Profile, Thread } from './types.js'

/**
 * Numbering is derived here and nowhere else (ADR-0003). `Post.text` is the body;
 * the string this module returns is what the counter measures and what the publish
 * wizard copies to the clipboard.
 */

/**
 * Which slot in the thread a piece of text occupies.
 *
 * `isLast` marks the final thing the reader will see, which is where the end marker
 * goes. Exactly one slot in a thread should carry it — the closing post when there is
 * one, otherwise the last ordinary post.
 */
export type Slot = {
  index: number
  total: number
  isClosing?: boolean
  isLast?: boolean
}

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

/**
 * The end marker rides on the final post's numbering: `12/12 EOF`. It is suppressed
 * on a closing post, because a closing post already says "this is the end" — the two
 * endings are alternatives, never both.
 */
function endMarkerFor(slot: Slot, cfg: NumberingConfig): string {
  if (!cfg.endMarker || !slot.isLast || slot.isClosing) return ''
  return cfg.endMarker
}

/** Body text plus its numbering and any end marker — exactly what gets posted. */
export function applyNumbering(text: string, slot: Slot, cfg: NumberingConfig): string {
  const numbering = numberingApplies(slot, cfg)
    ? renderNumbering(slot.index + 1, slot.total, cfg)
    : ''
  const marker = endMarkerFor(slot, cfg)

  const label = numbering && marker
    ? numbering + cfg.endMarkerSeparator + marker
    : numbering || marker

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

  // Exactly one slot is the end of the thread: the closing post if there is one,
  // otherwise the final ordinary post.
  const lastPostIndex = thread.closing ? -1 : thread.posts.length - 1

  const rendered: RenderedPost[] = thread.posts.map((post, index) => {
    const text = renderPost(post, { index, total, isLast: index === lastPostIndex }, profile)
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
    const slot = { index: thread.posts.length, total, isClosing: true, isLast: true }
    // Placeholders resolve for display and for counting; {{url}} stands in as a real
    // URL so it costs the 23 characters it will cost once published.
    const resolved = resolveTemplate(thread.closing.text, {
      url: thread.closing.published?.url ?? null,
      handle: profile.handle,
      count: thread.posts.length,
      title: thread.title,
    })
    const text = applyNumbering(resolved, slot, profile.numbering)
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
