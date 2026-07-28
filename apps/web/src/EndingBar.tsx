import { useEffect, useRef } from 'react'
import { needsUrl } from '@threader/core'
import type { ClosingTemplate, Profile, RenderedPost, Thread } from '@threader/core'
import { CharMeter } from './compose/CharMeter.js'

type Props = {
  thread: Thread
  profile: Profile
  /** The rendered closing post, when the thread has one. */
  rendered: RenderedPost | undefined
  showCounts: boolean
  onChoose: (template: ClosingTemplate | null) => void
  onEdit: (text: string) => void
}

/**
 * How the thread ends (docs/PLAN.md §5).
 *
 * Two kinds, and they are alternatives: a closing post that asks the reader for
 * something, or nothing at all — in which case the profile's end marker, if it has
 * one, lands on the final post as "12/12 EOF".
 *
 * The marker is a profile setting rather than a per-thread choice on purpose: it is
 * part of an account's voice, not something to retype for every thread.
 */
export function EndingBar({
  thread,
  profile,
  rendered,
  showCounts,
  onChoose,
  onEdit,
}: Props) {
  const input = useRef<HTMLTextAreaElement>(null)

  // Grow to fit: a closing post whose {{url}} line is scrolled out of sight is the
  // one line you most need to see.
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [thread.closing?.text])

  const templates = profile.closingTemplates
  const selectedId = thread.closing ? (thread.closing.templateId ?? 'custom') : ''
  const marker = profile.numbering.endMarker

  return (
    <section className="ending">
      <header className="ending__head">
        <h3>Ending</h3>
        <label>
          <span className="sr-only">Closing post</span>
          <select
            value={selectedId}
            onChange={(e) => {
              const id = e.target.value
              onChoose(id ? (templates.find((t) => t.id === id) ?? null) : null)
            }}
          >
            <option value="">
              {marker ? `No closing post — ends "${marker}"` : 'No closing post'}
            </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
            {selectedId === 'custom' && <option value="custom">Edited</option>}
          </select>
        </label>
      </header>

      {thread.closing && rendered && (
        <article className={`card${rendered.overLimit ? ' card--over' : ''}`}>
          <div className="card__head">
            <span className="card__index">Closing post</span>
            <CharMeter chars={rendered.chars} limit={rendered.limit} showCount={showCounts} />
          </div>

          <textarea
            ref={input}
            className="card__input ending__input"
            value={thread.closing.text}
            onChange={(e) => onEdit(e.target.value)}
            aria-label="Closing post"
            rows={1}
          />

          {needsUrl(thread.closing.text) && (
            <p className="ending__note">
              <code>{'{{url}}'}</code> becomes the link to post 1, which does not exist
              until you publish it. It is already counted as 23 characters, the same as
              any link.
            </p>
          )}
        </article>
      )}

      {!thread.closing && templates.length === 0 && (
        <p className="ending__note">
          No closing templates on this profile yet. Add one in profile settings — a
          repost ask, a newsletter CTA, whatever this account uses.
        </p>
      )}
    </section>
  )
}
