import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createProfile,
  createThread,
  mergePosts,
  movePost,
  reflowFrom,
  removePost,
  resplitFromSource,
  setLocked,
  setPostText,
  setSource,
  splitPost,
} from '@threader/core'
import type { Thread } from '@threader/core'
import { ComposeView } from './compose/ComposeView.js'
import { ArrangeView } from './arrange/ArrangeView.js'
import { HelpCard } from './HelpCard.js'

type Mode = 'compose' | 'arrange'

const HISTORY_LIMIT = 50

/**
 * Stage 3 — compose and arrange, with a hardcoded profile and in-memory state.
 * Persistence arrives in Stage 4, profiles in Stage 5 (docs/PLAN.md §8).
 */
export function App() {
  const profile = useMemo(
    () => createProfile({ name: 'Main', handle: '@matiasbaldanza' }),
    [],
  )
  const reflowOptions = useMemo(
    () => ({ charLimit: profile.charLimit, numbering: profile.numbering }),
    [profile],
  )

  const [thread, setThread] = useState<Thread>(() =>
    createThread({ profileId: profile.id, title: 'Untitled thread' }),
  )
  const [history, setHistory] = useState<Thread[]>([])
  const [mode, setMode] = useState<Mode>('compose')
  const [showCounts, setShowCounts] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  /** Every mutation goes through here, so undo covers all of them — including delete. */
  const apply = useCallback((next: (t: Thread) => Thread) => {
    setThread((current) => {
      const updated = next(current)
      if (updated === current) return current
      setHistory((past) => [...past, current].slice(-HISTORY_LIMIT))
      return updated
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((past) => {
      const previous = past[past.length - 1]
      if (!previous) return past
      setThread(previous)
      return past.slice(0, -1)
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  return (
    <div className="app">
      <header className="topbar">
        <h1>Threader</h1>
        <span className="topbar__profile">
          {profile.handle} · {profile.charLimit} chars · {profile.numbering.format}
        </span>

        <nav className="tabs" aria-label="Editing mode">
          {(['compose', 'arrange'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'is-on' : ''}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
            >
              {m === 'compose' ? 'Compose' : 'Arrange'}
            </button>
          ))}
        </nav>

        <div className="topbar__right">
          <button
            type="button"
            className="ghost"
            onClick={() => setHelpOpen(true)}
            title="What do these do?"
            aria-label="Help"
          >
            ?
          </button>
          <button
            type="button"
            className="ghost"
            onClick={undo}
            disabled={history.length === 0}
            title="Undo (⌘Z)"
          >
            Undo
          </button>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showCounts}
              onChange={(e) => setShowCounts(e.target.checked)}
            />
            Show counts
          </label>
        </div>
      </header>

      {mode === 'compose' ? (
        <ComposeView
          thread={thread}
          profile={profile}
          showCounts={showCounts}
          onSourceChange={(source) =>
            apply((t) => setSource(t, source, reflowOptions))
          }
          onResplit={() => apply((t) => resplitFromSource(t, reflowOptions))}
        />
      ) : (
        <ArrangeView
          thread={thread}
          profile={profile}
          showCounts={showCounts}
          onChange={(i, text) => apply((t) => setPostText(t, i, text))}
          onSplitAt={(i, offset) => apply((t) => splitPost(t, i, offset))}
          onMergeDown={(i) => apply((t) => mergePosts(t, i))}
          onMove={(i, direction) => apply((t) => movePost(t, i, i + direction))}
          onToggleLock={(i) =>
            apply((t) => setLocked(t, i, !t.posts[i]?.locked))
          }
          onReflow={(i) => apply((t) => reflowFrom(t, i, reflowOptions))}
          onDelete={(i) => apply((t) => removePost(t, i))}
        />
      )}

      {helpOpen && <HelpCard onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
