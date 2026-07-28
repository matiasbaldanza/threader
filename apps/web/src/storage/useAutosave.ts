import { useCallback, useEffect, useRef, useState } from 'react'
import { isBlankThread } from '@threader/core'
import type { Thread } from '@threader/core'
import type { Storage } from '@threader/store'

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/**
 * Debounced autosave. There is no save button — a writing tool that can lose work
 * because you forgot to press something is not doing its job.
 *
 * The snapshot is keyed by thread id, not just by value. Switching threads has to
 * count as "not yet saved" for the new one, or a freshly created thread inherits the
 * previous thread's saved state and gets written to disk while still empty.
 */
export function useAutosave(
  thread: Thread | null,
  store: Storage,
  delay = 600,
): { state: SaveState; markSaved: (thread: Thread) => void } {
  const [state, setState] = useState<SaveState>('idle')
  const lastSaved = useRef<{ id: string; json: string } | null>(null)

  const markSaved = useCallback((saved: Thread) => {
    lastSaved.current = { id: saved.id, json: JSON.stringify(saved) }
    setState('saved')
  }, [])

  useEffect(() => {
    if (!thread) return

    const json = JSON.stringify(thread)
    const snapshot = lastSaved.current
    const savedBefore = snapshot?.id === thread.id

    if (savedBefore && snapshot.json === json) return

    // Don't create a file for a thread nobody has written in yet: the folder name is
    // fixed at first save, so an empty one would be stuck as "untitled-thread"
    // forever. Once saved, keep saving — including back to empty, so the disk still
    // matches what you see.
    if (!savedBefore && isBlankThread(thread)) {
      setState('idle')
      return
    }

    setState('pending')
    const timer = setTimeout(() => {
      setState('saving')
      store
        .putThread(thread)
        .then(() => {
          lastSaved.current = { id: thread.id, json }
          setState('saved')
        })
        .catch((error: unknown) => {
          setState('error')
          console.error('autosave failed', error)
        })
    }, delay)

    return () => clearTimeout(timer)
  }, [thread, store, delay])

  return { state, markSaved }
}
