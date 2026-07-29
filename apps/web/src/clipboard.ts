/**
 * Clipboard writing for the publish wizard.
 *
 * ## Plain text, deliberately
 *
 * X's composer was reported to collapse pasted newlines into spaces, which would have
 * defeated the copy step entirely — the numbering separator is a blank line, and any
 * paragraph inside a post would arrive as one slab.
 *
 * It was measured rather than assumed: `docs/experiments/clipboard-line-breaks.html`
 * writes the same sample eight ways. **Plain text with `\n\n` pastes into X with its
 * line breaks intact.** So this writes `text/plain` and nothing else.
 *
 * An earlier version also wrote a `text/html` flavour, on the theory that a
 * contenteditable which flattens plain text might honour block elements. That is not
 * merely unnecessary — it hands the composer a second, untested path it might prefer.
 * `toHtml` is kept because it is the first thing to reach for if this ever regresses;
 * the experiment page documents what to try and in what order.
 */

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/**
 * Newlines as block structure rather than `<br>` — editors that normalise pasted HTML
 * tend to preserve `<div>` boundaries more reliably, and a blank line survives as an
 * empty block instead of being collapsed.
 *
 * Unused today. See the note above.
 */
export function toHtml(text: string): string {
  const blocks = text.split('\n').map((line) => {
    const escaped = escapeHtml(line)
    return `<div>${escaped === '' ? '<br>' : escaped}</div>`
  })
  return blocks.join('')
}

export type CopyResult = 'copied' | 'failed'

/**
 * Puts `text` on the clipboard.
 *
 * Returns whether it landed, because "Copied ✓" is a claim the wizard makes to you and
 * it should only make the one that is true — a silent failure here means you paste
 * whatever was on the clipboard before.
 */
export async function copyText(text: string): Promise<CopyResult> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return 'failed'

  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    // Denied, or no user activation. The wizard shows the text either way, so it can
    // still be selected and copied by hand.
    return 'failed'
  }
}
