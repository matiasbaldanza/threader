import { useMemo, useState } from 'react'
import { applyNumbering, counterFor, split } from '@threader/core'
import type { Profile } from '@threader/core'
import { PostCard } from './PostCard.js'

const PLACEHOLDER = `Write the whole thread as one piece of text.

Threader splits it at paragraph and sentence boundaries, and numbers it as you type.

Put --- on its own line to force a break exactly where you want one.`

type Props = {
  profile: Profile
  showCounts: boolean
}

/**
 * Compose mode (docs/PLAN.md §4). Source text is the single truth here; splits are
 * derived on every keystroke and never edited. Per-post editing — and the `detached`
 * flag that guards it — arrives with Arrange mode in Stage 3.
 */
export function ComposeView({ profile, showCounts }: Props) {
  const [source, setSource] = useState('')

  const count = useMemo(() => counterFor(profile.platform), [profile.platform])

  const posts = useMemo(
    () => split(source, { charLimit: profile.charLimit, numbering: profile.numbering }),
    [source, profile.charLimit, profile.numbering],
  )

  const rendered = useMemo(
    () =>
      posts.map((body, index) => {
        const text = applyNumbering(body, { index, total: posts.length }, profile.numbering)
        return { text, chars: count(text) }
      }),
    [posts, profile.numbering, count],
  )

  const overCount = rendered.filter((p) => p.chars > profile.charLimit).length

  return (
    <div className="compose">
      <section className="pane pane--source">
        <header className="pane__head">
          <h2>Draft</h2>
          <span className="pane__meta">{count(source)} characters</span>
        </header>
        <textarea
          className="editor"
          value={source}
          onChange={(e) => setSource(e.target.value)}
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
            {overCount > 0 && <strong className="warn"> · {overCount} over limit</strong>}
          </span>
        </header>

        <div className="preview">
          {rendered.length === 0 ? (
            <p className="empty">Posts will appear here as you write.</p>
          ) : (
            rendered.map((post, index) => (
              <PostCard
                key={index}
                text={post.text}
                index={index}
                total={rendered.length}
                chars={post.chars}
                limit={profile.charLimit}
                showCount={showCounts}
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}
