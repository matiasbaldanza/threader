import { useEffect } from 'react'

type Props = {
  onClose: () => void
}

/**
 * In-app help. The toolbar verbs are only obvious once you have met the problem
 * each one solves — "Keep as is" in particular means nothing until you know Tidy
 * exists — so the card explains them in the order you would actually hit them.
 */
export function HelpCard({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <div
        className="help"
        role="dialog"
        aria-modal="true"
        aria-label="How Threader works"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="help__head">
          <h2>How Threader works</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <section>
          <h3>Two ways to look at a thread</h3>
          <dl>
            <dt>Compose</dt>
            <dd>
              You are writing <em>text</em>. One box for the whole thread. Threader
              splits and numbers it as you type. Put <code>---</code> on its own line
              to force a break exactly where you want one.
            </dd>
            <dt>Arrange</dt>
            <dd>
              You are handling <em>posts</em>. Each one is its own card that you can
              edit, cut, join and reorder.
            </dd>
          </dl>
          <p className="help__note">
            Write in Compose. Go to Arrange when the automatic split got something
            almost right and you want to fix it by hand.
          </p>
        </section>

        <section>
          <h3>The buttons on each post</h3>
          <dl>
            <dt>Split here</dt>
            <dd>
              Breaks one post into two at your cursor. Click where you want the break
              first. Use it when a break lands somewhere that reads badly, or when a
              line deserves a post of its own.
            </dd>

            <dt>Merge ↓</dt>
            <dd>
              Pulls the post below up into this one. Use it when a break was not
              earning its keep, or a post is too thin to stand alone. Splitting
              mid-sentence and merging back gives you the sentence exactly as it was.
            </dd>

            <dt>Tidy ↓</dt>
            <dd>
              The cleanup button. After a few edits your posts go lumpy — one is 260
              characters, the next is 40. Tidy pours this post and the ones below it
              back together and re-splits them so they fill evenly. Posts above it are
              left alone.
            </dd>

            <dt>Keep as is</dt>
            <dd>
              Protects a post from Tidy. If you deliberately left a one-line punchline
              short, mark it kept and Tidy will skip over it — and stop there, so you
              can clean up one section without disturbing the next.
            </dd>

            <dt>↑ ↓ and ✕</dt>
            <dd>Move a post up or down, or delete it. Numbering always follows.</dd>
          </dl>
        </section>

        <section>
          <h3>Two things worth knowing</h3>
          <p>
            <strong>Numbering is never yours to type.</strong> It is added when the
            post is rendered, so it cannot go stale — reorder, split or merge freely
            and <code>1/9</code> fixes itself.
          </p>
          <p>
            <strong>Editing a post disconnects it from the draft.</strong> Otherwise
            the next keystroke in Compose would wipe out your hand edits. You can
            rebuild the posts from the draft whenever you like — Threader asks first.
          </p>
          <p>
            <strong>⌘Z undoes anything</strong>, including a deleted post.
          </p>
        </section>
      </div>
    </div>
  )
}
