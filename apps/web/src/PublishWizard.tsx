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
import { useFocusTrap } from './useFocusTrap.js'

type Props = {
  thread: Thread
  profile: Profile
  onRecord: (url?: string) => void
  onBack: () => void
  onReset: () => void
  onClose: () => void
}

const COMPOSE_URL = 'https://x.com/compose/post'

/**
 * The publish wizard (docs/PLAN.md §6, ADR-0002).
 *
 * One thing on screen at a time, moving sideways as you go — the thread is a sequence,
 * so the wizard reads like one. Threader never touches the network: it prepares the
 * next thing and waits.
 *
 * The dialog keeps a fixed height on purpose. Steps differ in length, and a panel that
 * resizes moves the primary button out from under the cursor between steps — in a flow
 * you run a dozen times in a row, that is the difference between rhythm and hunting.
 *
 * Closing is always a pause, never a cancel: the run is on disk after every step
 * (ADR-0007), so Escape, the backdrop and the Pause button all simply step out.
 */
export function PublishWizard({
  thread,
  profile,
  onRecord,
  onBack,
  onReset,
  onClose,
}: Props) {
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
  const [confirmingReset, setConfirmingReset] = useState(false)

  const dialog = useRef<HTMLDivElement>(null)
  const urlInput = useRef<HTMLInputElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const handedOff = useRef(false)

  useFocusTrap(dialog)

  /*
   * Which way the panel slides. Latched at the render where the cursor changed, not
   * derived each render: any later re-render of the same step (the copy effect settling,
   * a hot reload) would otherwise recompute it as "forward" and the class would stop
   * matching the direction you actually travelled.
   */
  const previous = useRef(cursor)
  const slide = useRef<'fwd' | 'back'>('fwd')
  if (cursor !== previous.current) {
    slide.current = cursor > previous.current ? 'fwd' : 'back'
    previous.current = cursor
  }
  const direction = slide.current

  const done = step.kind === 'done'
  const wantsUrl = step.kind === 'post' && step.index === 0 && needsFirstPostUrl(thread)
  const parsed = parseStatusUrl(url)
  const mismatch =
    parsed !== null && profile.handle.toLowerCase() !== parsed.handle.toLowerCase()
  const canAdvance = !wantsUrl || parsed !== null

  /** Copying is the hand-off: send focus wherever the next action actually is. */
  const copy = useCallback(async () => {
    const result = await copyText(text)
    setCopied(result)
    if (result !== 'copied') return
    if (wantsUrl) urlInput.current?.focus()
    else nextButton.current?.focus()
  }, [text, wantsUrl])

  useEffect(() => {
    setCopied(null)
    setUrl('')
    setTouched(false)
    handedOff.current = false
    if (text) void copy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, text])

  // Once the pasted URL is a real post URL there is nothing left to type, so hand focus
  // to the button. Guarded so it fires once and cannot fight you mid-edit.
  useEffect(() => {
    if (parsed && !handedOff.current) {
      handedOff.current = true
      nextButton.current?.focus()
    }
    if (!parsed) handedOff.current = false
  }, [parsed])

  const advance = useCallback(() => {
    if (!canAdvance) return
    onRecord(wantsUrl ? url.trim() : undefined)
  }, [canAdvance, onRecord, wantsUrl, url])

  /**
   * Shortcuts live on the window, not the dialog.
   *
   * Focus does not reliably sit inside the dialog: a click on the backdrop's padding,
   * or a hot reload, leaves it on `body`, and a dialog-scoped handler then never fires.
   * Measured, not assumed — arrow keys died exactly that way.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      const tag = (e.target as HTMLElement | null)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (typing || done) return

      /*
       * Bare arrows. Modified arrows were the first attempt and are unusable: on
       * macOS, Cmd+Left is the browser's Back, so the page never sees it.
       */
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        advance()
      }
      if (e.key === 'ArrowLeft' && cursor > 0) {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, advance, onBack, cursor, done])

  /** Enter needs the event target, so it stays scoped to the dialog. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const inTextarea = (e.target as HTMLElement).tagName === 'TEXTAREA'
    if (e.key !== 'Enter' || (inTextarea && !e.metaKey && !e.ctrlKey)) return
    e.preventDefault()
    if (done) onClose()
    else advance()
  }

  const isFirst = step.kind === 'post' && step.index === 0
  const isClosing = step.kind === 'closing'
  const firstUrl = thread.publishRun?.firstPostUrl ?? null

  const heading = done
    ? 'Thread published 🎉'
    : isClosing
      ? 'The closing post'
      : `Post ${cursor + 1}`

  const instruction = done
    ? `${thread.posts.length} post${thread.posts.length === 1 ? '' : 's'}${
        thread.closing ? ' and a closing post' : ''
      }${
        thread.publishRun?.completedAt
          ? ` · ${new Date(thread.publishRun.completedAt).toLocaleString()}`
          : ''
      }`
    : isFirst
      ? `Post this on ${profile.handle} as a new post.`
      : `Reply to post ${cursor}${isClosing ? ' — this is the last one' : ''}.`

  const openUrl = isFirst ? COMPOSE_URL : (firstUrl ?? COMPOSE_URL)
  const openLabel = isFirst ? 'Open the X composer' : 'Open your thread on X'
  const shown = done ? (firstUrl ?? '') : text

  return (
    <div
      className="scrim wizard__scrim"
      role="presentation"
      onClick={onClose}
      onKeyDown={onKeyDown}
    >
      <div
        ref={dialog}
        className="wizard"
        role="dialog"
        aria-modal="true"
        aria-label="Publish thread"
        // Clicks inside must not reach the backdrop, or every button would close it.
        onClick={(e) => e.stopPropagation()}
      >
        <header className="wizard__bar">
          <span className="wizard__progress" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`dot${
                  done || i < cursor ? ' dot--done' : i === cursor ? ' dot--now' : ''
                }`}
              />
            ))}
          </span>
          <span className="wizard__count">
            {done ? 'done' : `${cursor + 1} of ${total}`}
          </span>
          {!done && (
            <button
              type="button"
              className="ghost ghost--quiet"
              onClick={() => setConfirmingReset(true)}
            >
              Start over
            </button>
          )}
          <button type="button" className="ghost" onClick={onClose}>
            {done ? 'Close' : 'Pause'}
          </button>
        </header>

        {confirmingReset && (
          <div className="wizard__confirm">
            <p>
              Start again from post 1? Threader will forget that anything was posted.
              <strong> Posts already on X stay there</strong> — it cannot delete them, so
              remove them yourself first if that is what you meant.
            </p>
            <p className="notice__actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onReset()
                  setConfirmingReset(false)
                }}
              >
                Start over
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setConfirmingReset(false)}
              >
                Cancel
              </button>
            </p>
          </div>
        )}

        {/* Keyed on the step so each one animates in from the side it came from. */}
        <div
          key={done ? 'done' : cursor}
          className={`wizard__panel wizard__panel--${direction}`}
        >
          <h2 className="wizard__title">{heading}</h2>
          <p className="wizard__instruction">{instruction}</p>

          {shown && <pre className="wizard__text">{shown}</pre>}

          {shown && (
            <div className="wizard__actions">
              <button type="button" className="btn" onClick={() => void copy()}>
                {copied === 'copied' ? 'Copied ✓' : 'Copy'}
              </button>
              <a
                className="btn btn--primary"
                href={openUrl}
                target="_blank"
                rel="noreferrer"
              >
                {done ? 'Open the thread' : openLabel} ↗
              </a>
            </div>
          )}

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
              <input
                ref={urlInput}
                id="post-url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setTouched(true)
                }}
                placeholder={`https://x.com/${profile.handle.replace('@', '')}/status/…`}
                spellCheck={false}
              />
              {touched && url.trim() !== '' && !parsed && (
                <p className="wizard__warn">
                  That does not look like a post URL — it should end in{' '}
                  <code>/status/…</code>.
                </p>
              )}
              {mismatch && (
                <p className="wizard__warn">
                  That URL is on {parsed.handle}, but this thread targets{' '}
                  {profile.handle}.
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="wizard__foot">
          {done ? (
            <>
              <span />
              <button
                type="button"
                className="btn btn--primary"
                ref={nextButton}
                onClick={onClose}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                onClick={onBack}
                disabled={cursor === 0}
                title="Back (←)"
              >
                ← Back
              </button>
              <button
                type="button"
                className="btn btn--primary"
                ref={nextButton}
                onClick={advance}
                disabled={!canAdvance}
                title={
                  canAdvance ? 'Enter, or →' : 'Paste the link to this post first'
                }
              >
                {cursor + 1 === total ? 'Finish' : 'Posted — next →'}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
