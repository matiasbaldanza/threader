import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  currentStep,
  needsFirstPostUrl,
  parseStatusUrl,
  renderThread,
  stepCount,
} from '@threader/core'
import type { Profile, Thread } from '@threader/core'
import { copyText, type CopyResult } from './clipboard.js'

type Props = {
  thread: Thread
  profile: Profile
  onRecord: (url?: string) => void
  onBack: () => void
  onClose: () => void
}

const COMPOSE_URL = 'https://x.com/compose/post'

/**
 * The publish wizard (docs/PLAN.md §6, ADR-0002).
 *
 * One thing on screen at a time, and it moves sideways as you go — the thread is a
 * sequence, so the wizard reads like one. Threader never touches the network: it
 * prepares the next thing and waits.
 *
 * A URL is asked for exactly once, and only when it is actually needed: post 1, when
 * the closing post links back to it. Collecting a URL after every post would be a tab
 * switch and a paste each time to gather data nothing reads.
 *
 * Every step persists through the caller's autosave, so closing the tab at post 7 and
 * coming back resumes at post 7 (ADR-0007).
 */
export function PublishWizard({ thread, profile, onRecord, onBack, onClose }: Props) {
  const rendered = useMemo(() => renderThread(thread, profile), [thread, profile])
  const step = currentStep(thread)
  const total = stepCount(thread)
  const cursor = thread.publishRun?.cursor ?? 0

  const view =
    step.kind === 'post'
      ? rendered[step.index]
      : step.kind === 'closing'
        ? rendered.find((p) => p.isClosing)
        : undefined
  const text = view?.text ?? ''

  const [copied, setCopied] = useState<CopyResult | null>(null)
  const [url, setUrl] = useState('')
  const [touched, setTouched] = useState(false)

  // Which way the panel slides, so going back reads as going back.
  const previous = useRef(cursor)
  const direction = cursor >= previous.current ? 'fwd' : 'back'
  useEffect(() => {
    previous.current = cursor
  }, [cursor])

  const copy = useCallback(async () => {
    setCopied(await copyText(text))
  }, [text])

  useEffect(() => {
    setCopied(null)
    setUrl('')
    setTouched(false)
    // Auto-copy on arrival: the whole point is that the next thing is already on the
    // clipboard when you switch to X.
    if (text) void copy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, text])

  const wantsUrl = step.kind === 'post' && step.index === 0 && needsFirstPostUrl(thread)
  const parsed = parseStatusUrl(url)
  const mismatch = parsed !== null && profile.handle.toLowerCase() !== parsed.handle.toLowerCase()
  const canAdvance = !wantsUrl || parsed !== null

  if (step.kind === 'done') {
    return <Summary thread={thread} onClose={onClose} />
  }

  const isFirst = step.kind === 'post' && step.index === 0
  const isClosing = step.kind === 'closing'

  const heading = isClosing ? 'The closing post' : `Post ${cursor + 1}`
  const instruction = isFirst
    ? `Post this on ${profile.handle} as a new post.`
    : `Reply to post ${cursor}${isClosing ? ' — this is the last one' : ''}.`

  const openUrl = isFirst ? COMPOSE_URL : (thread.publishRun?.firstPostUrl ?? COMPOSE_URL)
  const openLabel = isFirst ? 'Open the X composer' : 'Open your thread on X'

  return (
    <div className="scrim wizard__scrim" role="presentation">
      <div className="wizard" role="dialog" aria-modal="true" aria-label="Publish thread">
        <header className="wizard__bar">
          <span className="wizard__progress" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`dot${i < cursor ? ' dot--done' : i === cursor ? ' dot--now' : ''}`}
              />
            ))}
          </span>
          <span className="wizard__count">
            {cursor + 1} of {total}
          </span>
          <button type="button" className="ghost" onClick={onClose}>
            Pause
          </button>
        </header>

        {/* Keyed on the step so each one animates in from the side it came from. */}
        <div key={cursor} className={`wizard__panel wizard__panel--${direction}`}>
          <h2 className="wizard__title">{heading}</h2>
          <p className="wizard__instruction">{instruction}</p>

          <pre className="wizard__text">{text}</pre>

          <div className="wizard__actions">
            <button type="button" className="btn" onClick={() => void copy()}>
              {copied === 'copied' ? 'Copied ✓' : 'Copy'}
            </button>
            <a className="btn btn--primary" href={openUrl} target="_blank" rel="noreferrer">
              {openLabel} ↗
            </a>
          </div>

          {copied === 'failed' && (
            <p className="wizard__warn">
              Could not reach the clipboard — select the text above and copy it by hand.
            </p>
          )}

          {wantsUrl && (
            <div className="wizard__ask">
              <label htmlFor="post-url">
                Paste the link to this post — the closing post links back to it, so
                readers land at the top of the thread rather than the middle.
              </label>
              <div className="wizard__url">
                <input
                  id="post-url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value)
                    setTouched(true)
                  }}
                  placeholder={`https://x.com/${profile.handle.replace('@', '')}/status/…`}
                  spellCheck={false}
                />
              </div>
              {touched && url.trim() !== '' && !parsed && (
                <p className="wizard__warn">
                  That does not look like a post URL — it should end in{' '}
                  <code>/status/…</code>.
                </p>
              )}
              {mismatch && (
                <p className="wizard__warn">
                  That URL is on {parsed.handle}, but this thread targets {profile.handle}.
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="wizard__foot">
          <button type="button" className="btn" onClick={onBack} disabled={cursor === 0}>
            ← Back
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onRecord(wantsUrl ? url.trim() : undefined)}
            disabled={!canAdvance}
            title={canAdvance ? undefined : 'Paste the link to this post first'}
          >
            {cursor + 1 === total ? 'Finish' : 'Posted — next →'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function Summary({ thread, onClose }: { thread: Thread; onClose: () => void }) {
  const at = thread.publishRun?.completedAt
  const url = thread.publishRun?.firstPostUrl

  return (
    <div className="scrim wizard__scrim" role="presentation">
      <div className="wizard" role="dialog" aria-modal="true" aria-label="Thread published">
        <div className="wizard__panel wizard__panel--fwd">
          <h2 className="wizard__title">Thread published 🎉</h2>
          <p className="wizard__instruction">
            {thread.posts.length} post{thread.posts.length === 1 ? '' : 's'}
            {thread.closing ? ' and a closing post' : ''}
            {at ? ` · ${new Date(at).toLocaleString()}` : ''}
          </p>

          {url && (
            <>
              <pre className="wizard__text">{url}</pre>
              <div className="wizard__actions">
                <button type="button" className="btn" onClick={() => void copyText(url)}>
                  Copy the link
                </button>
                <a className="btn btn--primary" href={url} target="_blank" rel="noreferrer">
                  Open the thread ↗
                </a>
              </div>
            </>
          )}
        </div>

        <footer className="wizard__foot">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}
