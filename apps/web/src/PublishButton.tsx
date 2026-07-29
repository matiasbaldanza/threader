import { publishProgress, publishState } from '@threader/core'
import type { Thread } from '@threader/core'

type Props = {
  thread: Thread
  disabled: boolean
  title: string
  onClick: () => void
}

/**
 * Always reads "Post".
 *
 * The label never changes to "Resume" or "Posting", because a word that grows and
 * shrinks moves everything beside it in the top bar. The ring carries the state
 * instead: grey and empty before you start, blue and filling while a run is paused
 * part-way, green and closed once the thread is out.
 */
export function PublishButton({ thread, disabled, title, onClick }: Props) {
  const state = publishState(thread)
  const progress = publishProgress(thread)

  const radius = 7
  const circumference = 2 * Math.PI * radius

  const label =
    state === 'published'
      ? 'Published'
      : state === 'publishing'
        ? `Paused at ${Math.round(progress * 100)}%`
        : 'Not published yet'

  return (
    <button
      type="button"
      className={`ghost publish publish--${state}`}
      onClick={onClick}
      disabled={disabled}
      title={`${title} — ${label}`}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle className="publish__track" cx="9" cy="9" r={radius} />
        <circle
          className="publish__fill"
          cx="9"
          cy="9"
          r={radius}
          strokeDasharray={`${circumference * progress} ${circumference}`}
          transform="rotate(-90 9 9)"
        />
      </svg>
      Post
      <span className="sr-only">— {label}</span>
    </button>
  )
}
