import { useMemo, useState } from 'react'
import { counterFor, renderThread } from '@threader/core'
import type { ClosingTemplate, Profile, Thread } from '@threader/core'
import { PostCard } from './PostCard.js'
import { EndingBar } from '../EndingBar.js'

const PLACEHOLDER = `Write the whole thread as one piece of text.

Threader splits it at paragraph and sentence boundaries, and numbers it as you type.

Put --- on its own line to force a break exactly where you want one.`

type Props = {
  thread: Thread
  profile: Profile
  showCounts: boolean
  onSourceChange: (source: string) => void
  onResplit: () => void
  onChooseEnding: (template: ClosingTemplate | null) => void
  onEditClosing: (text: string) => void
}

/**
 * Compose mode (docs/PLAN.md §4). While the thread is attached, the source is the
 * truth and posts follow it on every keystroke. Once detached — see ADR-0004 — the
 * posts stop following, and getting them back in sync is an explicit, confirmed act.
 */
export function ComposeView({
  thread,
  profile,
  showCounts,
  onSourceChange,
  onResplit,
  onChooseEnding,
  onEditClosing,
}: Props) {
  const [confirming, setConfirming] = useState(false)

  const count = useMemo(() => counterFor(profile.platform), [profile.platform])
  const rendered = useMemo(() => renderThread(thread, profile), [thread, profile])

  const posts = rendered.filter((p) => !p.isClosing)
  const overCount = rendered.filter((p) => p.overLimit).length

  return (
    <div className="compose">
      <section className="pane pane--source">
        <header className="pane__head">
          <h2>Draft</h2>
          <span className="pane__meta">{count(thread.source)} characters</span>
        </header>

        {thread.detached && (
          <div className="notice">
            <p>
              You have edited the posts by hand, so they no longer follow this draft.
              Keep writing here and the posts will stay as they are — rebuilding them
              will <strong>throw those edits away</strong>.
            </p>
            {confirming ? (
              <p className="notice__actions">
                <button type="button" className="danger" onClick={onResplit}>
                  Throw away my edits and rebuild
                </button>
                <button type="button" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </p>
            ) : (
              <p className="notice__actions">
                <button type="button" onClick={() => setConfirming(true)}>
                  Rebuild posts from draft
                </button>
              </p>
            )}
          </div>
        )}

        <textarea
          className="editor"
          value={thread.source}
          onChange={(e) => onSourceChange(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck
          autoFocus
          aria-label="Thread draft"
        />
        <footer className="pane__foot">
          <code>---</code> on its own line forces a break
        </footer>
      </section>

      <section className="pane pane--preview">
        <header className="pane__head">
          <h2>Thread</h2>
          <span className="pane__meta">
            {posts.length === 0
              ? 'nothing yet'
              : `${posts.length} post${posts.length === 1 ? '' : 's'}`}
            {thread.closing ? ' + closing' : ''}
            {overCount > 0 && <strong className="warn"> · {overCount} over limit</strong>}
          </span>
        </header>

        <div className="preview">
          {posts.length === 0 ? (
            <p className="empty">Posts will appear here as you write.</p>
          ) : (
            posts
              .map((post, index, list) => (
                <PostCard
                  key={post.id}
                  text={post.text}
                  index={index}
                  total={list.length}
                  chars={post.chars}
                  limit={post.limit}
                  showCount={showCounts}
                />
              ))
          )}

          <EndingBar
            thread={thread}
            profile={profile}
            rendered={rendered.find((p) => p.isClosing)}
            showCounts={showCounts}
            onChoose={onChooseEnding}
            onEdit={onEditClosing}
          />
        </div>
      </section>
    </div>
  )
}
