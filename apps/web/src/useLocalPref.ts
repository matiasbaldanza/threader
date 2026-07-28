import { useCallback, useState } from 'react'

/**
 * A view preference, remembered in localStorage.
 *
 * Deliberately not stored with the thread or the profile: whether the sidebar is open
 * is about this screen right now, not about the thread's content or the account's
 * voice. Losing it costs nothing, which is why it does not go near the server.
 */
export function useLocalPref<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`threader.${key}`)
      return stored === null ? initial : (JSON.parse(stored) as T)
    } catch {
      return initial
    }
  })

  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(`threader.${key}`, JSON.stringify(next))
      } catch {
        // Private browsing or a full quota — the preference just will not persist.
      }
    },
    [key],
  )

  return [value, update]
}
