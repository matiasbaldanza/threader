import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createProfile,
  createThread,
  deriveTitle,
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
import type { Profile, Thread } from '@threader/core'
import { ComposeView } from './compose/ComposeView.js'
import { ArrangeView } from './arrange/ArrangeView.js'
import { HelpCard } from './HelpCard.js'
import { ThreadList } from './ThreadList.js'
import { HttpStore } from './storage/httpStore.js'
import { useLocalPref } from './useLocalPref.js'
import { useAutosave } from './storage/useAutosave.js'

type Mode = 'compose' | 'arrange'

const HISTORY_LIMIT = 50

/** Until Stage 5, the profile is whatever the server seeded, under a fixed id. */
const FALLBACK_PROFILE = createProfile(
  { name: 'Main', handle: '@you' },
  { ids: () => 'default' },
)

/**
 * Stage 4 — threads live on disk and save themselves (docs/PLAN.md §8). Profiles are
 * still read-only here; editing them is Stage 5.
 */
export function App() {
  const store = useMemo(() => new HttpStore(), [])

  const [profile, setProfile] = useState<Profile>(FALLBACK_PROFILE)
  const [threads, setThreads] = useState<Thread[]>([])
  const [thread, setThread] = useState<Thread | null>(null)
  const [history, setHistory] = useState<Thread[]>([])
  const [mode, setMode] = useState<Mode>('compose')
  const [showCounts, setShowCounts] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useLocalPref('sidebarOpen', true)
  const [helpOpen, setHelpOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { state: saveState, markSaved } = useAutosave(thread, store)

  const reflowOptions = useMemo(
    () => ({ charLimit: profile.charLimit, numbering: profile.numbering }),
    [profile],
  )

  /** Switching threads must not let ⌘Z reach back into a different thread. */
  const open = useCallback(
    (next: Thread) => {
      setThread(next)
      setHistory([])
      markSaved(next)
    },
    [markSaved],
  )

  const newThread = useCallback(() => {
    setThread((current) => {
      const fresh = createThread({ profileId: profile.id })
      setHistory([])
      // A brand new thread is not on disk yet, so it must NOT be marked saved.
      setThreads((list) => (current ? [current, ...list.filter((t) => t.id !== current.id)] : list))
      return fresh
    })
  }, [profile.id])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [profiles, list] = await Promise.all([
          store.listProfiles(),
          store.listThreads(),
        ])
        if (cancelled) return
        if (profiles[0]) setProfile(profiles[0])
        setThreads(list)
        if (list[0]) {
          setThread(list[0])
          markSaved(list[0])
        } else {
          setThread(createThread({ profileId: profiles[0]?.id ?? FALLBACK_PROFILE.id }))
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            'Cannot reach the local server. Start it with `pnpm dev`, which runs both.',
          )
          setThread(createThread({ profileId: FALLBACK_PROFILE.id }))
        }
        console.error(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [store, markSaved])

  /** Keeps the sidebar in step with the thread being edited. */
  useEffect(() => {
    if (!thread) return
    setThreads((list) => {
      const rest = list.filter((t) => t.id !== thread.id)
      return [thread, ...rest].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    })
  }, [thread])

  const apply = useCallback((next: (t: Thread) => Thread) => {
    setThread((current) => {
      if (!current) return current
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
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        setSidebarOpen(!sidebarOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, sidebarOpen, setSidebarOpen])

  const selectThread = useCallback(
    async (id: string) => {
      const found = await store.getThread(id)
      if (found) open(found)
    },
    [store, open],
  )

  const deleteThread = useCallback(
    async (id: string) => {
      await store.deleteThread(id)
      const list = await store.listThreads()
      setThreads(list)
      if (thread?.id === id) {
        if (list[0]) open(list[0])
        else open(createThread({ profileId: profile.id }))
      }
    },
    [store, thread?.id, open, profile.id],
  )

  /**
   * Deliberate title edits rename the thread's folder on disk; the title
   * auto-following the draft's first line does not. Otherwise the folder would churn
   * through `this/`, `this-is/`, `this-is-the/` as you type an opening sentence.
   *
   * Debounced well past the autosave interval so a rename lands once you stop typing,
   * not once per keystroke.
   */
  const renameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const renameTitle = useCallback(
    (title: string) => {
      apply((t) => ({ ...t, title }))
      const id = thread?.id
      if (!id) return
      if (renameTimer.current) clearTimeout(renameTimer.current)
      renameTimer.current = setTimeout(() => {
        store.renameThread?.(id, title).catch((error: unknown) => {
          // The thread itself is safe either way — only its folder name is stale.
          console.error('folder rename failed', error)
        })
      }, 1200)
    },
    [apply, store, thread?.id],
  )

  useEffect(() => () => {
    if (renameTimer.current) clearTimeout(renameTimer.current)
  }, [])

  const changeSource = useCallback(
    (source: string) => {
      apply((t) => {
        const next = setSource(t, source, reflowOptions)
        // The title follows the draft until you name the thread yourself.
        const auto = t.title === 'Untitled thread' || t.title === deriveTitle(t.source)
        return auto ? { ...next, title: deriveTitle(source) } : next
      })
    },
    [apply, reflowOptions],
  )

  if (!thread) {
    return <div className="app loading">Loading…</div>
  }

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="ghost ghost--icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={`${sidebarOpen ? 'Hide' : 'Show'} threads (\u2318\\)`}
          aria-label={`${sidebarOpen ? 'Hide' : 'Show'} thread list`}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? '\u2337' : '\u2338'}
        </button>
        <h1>Threader</h1>
        <input
          className="topbar__title"
          value={thread.title}
          onChange={(e) => renameTitle(e.target.value)}
          aria-label="Thread title"
          spellCheck={false}
        />

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
          <SaveIndicator state={saveState} />
          <button type="button" className="ghost" onClick={newThread} title="New thread">
            New
          </button>
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

      {error && <p className="banner banner--error">{error}</p>}

      <div className="workspace">
        {sidebarOpen && (
        <ThreadList
          threads={threads}
          currentId={thread.id}
          onSelect={(id) => void selectThread(id)}
          onDelete={(id) => void deleteThread(id)}
        />
        )}

        {mode === 'compose' ? (
          <ComposeView
            thread={thread}
            profile={profile}
            showCounts={showCounts}
            onSourceChange={changeSource}
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
            onToggleLock={(i) => apply((t) => setLocked(t, i, !t.posts[i]?.locked))}
            onReflow={(i) => apply((t) => reflowFrom(t, i, reflowOptions))}
            onDelete={(i) => apply((t) => removePost(t, i))}
          />
        )}
      </div>

      {helpOpen && <HelpCard onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

function SaveIndicator({ state }: { state: ReturnType<typeof useAutosave>['state'] }) {
  const label =
    state === 'saved'
      ? 'Saved'
      : state === 'saving' || state === 'pending'
        ? 'Saving…'
        : state === 'error'
          ? 'Not saved'
          : ''
  if (!label) return null
  return (
    <span className={`save save--${state}`} role="status">
      {label}
    </span>
  )
}
