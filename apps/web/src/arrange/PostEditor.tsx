import { useEffect, useRef, useState } from 'react'
import { CharMeter } from '../compose/CharMeter.js'

type Props = {
  body: string
  numbering: string
  index: number
  total: number
  chars: number
  limit: number
  locked: boolean
  showCount: boolean
  canMergeDown: boolean
  onChange: (text: string) => void
  onSplitAt: (offset: number) => void
  onMergeDown: () => void
  onMove: (direction: -1 | 1) => void
  onToggleLock: () => void
  onReflow: () => void
  onDelete: () => void
}

export function PostEditor(props: Props) {
  const { chars, limit, locked, index, total } = props
  const over = chars > limit

  const ref = useRef<HTMLTextAreaElement>(null)
  const [caret, setCaret] = useState(0)

  // Grow to fit rather than scroll — a post you cannot see whole is hard to judge.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [props.body])

  const trackCaret = () => setCaret(ref.current?.selectionStart ?? 0)
  const canSplit = caret > 0 && caret < props.body.length

  return (
    <article
      className={`card card--edit${over ? ' card--over' : ''}${locked ? ' card--locked' : ''}`}
    >
      <header className="card__head">
        <span className="card__index">
          {index + 1} <span className="card__of">of {total}</span>
          {locked && (
            <span className="card__kept" title="Kept as is — Tidy skips this post">
              kept
            </span>
          )}
        </span>
        <CharMeter chars={chars} limit={limit} showCount={props.showCount} />
      </header>

      <textarea
        ref={ref}
        className="card__input"
        value={props.body}
        onChange={(e) => props.onChange(e.target.value)}
        onSelect={trackCaret}
        onKeyUp={trackCaret}
        onClick={trackCaret}
        aria-label={`Post ${index + 1} of ${total}`}
        rows={1}
      />

      {props.numbering && <p className="card__numbering">{props.numbering}</p>}

      <footer className="card__tools">
        <button
          type="button"
          onClick={() => props.onMove(-1)}
          disabled={index === 0}
          title="Move up"
          aria-label="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => props.onMove(1)}
          disabled={index === total - 1}
          title="Move down"
          aria-label="Move down"
        >
          ↓
        </button>
        <span className="card__sep" />
        <button
          type="button"
          onClick={() => props.onSplitAt(caret)}
          disabled={!canSplit}
          title={
            canSplit
              ? 'Break this post in two at the cursor'
              : 'Click in the text where you want the break first'
          }
        >
          Split here
        </button>
        <button
          type="button"
          onClick={props.onMergeDown}
          disabled={!props.canMergeDown}
          title="Pull the post below up into this one"
        >
          Merge ↓
        </button>
        <button
          type="button"
          onClick={props.onReflow}
          disabled={locked}
          title="Re-pack this post and the ones below it so they fill evenly, stopping at the first kept post"
        >
          Tidy ↓
        </button>
        <span className="card__sep" />
        <button
          type="button"
          onClick={props.onToggleLock}
          className={locked ? 'is-on' : ''}
          title={
            locked
              ? 'Stop keeping this post — Tidy can reshape it again'
              : 'Keep this post exactly as it is — Tidy will skip over it'
          }
          aria-pressed={locked}
        >
          Keep as is
        </button>
        <button
          type="button"
          onClick={props.onDelete}
          className="danger"
          title="Delete this post"
          aria-label="Delete post"
        >
          ✕
        </button>
      </footer>
    </article>
  )
}
