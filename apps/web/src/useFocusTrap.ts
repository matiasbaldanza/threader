import { useEffect, type RefObject } from 'react'

/**
 * Everything the browser will stop on with Tab. Queried fresh on every keypress
 * rather than cached, because a dialog's controls come and go — the URL field only
 * exists on post 1, the confirm bar only while confirming.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Keeps Tab inside a dialog.
 *
 * Without this, tabbing past the last control walks off into the page behind the
 * scrim — you keep pressing Tab, nothing visible moves, and the thing you are typing
 * into is a form you cannot see. Wrapping at both ends is what makes a modal actually
 * modal for the keyboard, not just for the mouse.
 *
 * Listens on the window in capture, so it still works when focus has escaped the
 * container entirely; in that case the next Tab pulls it back in.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const root = ref.current
      if (!root) return

      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        // `offsetParent` is null for anything display:none or detached. The active
        // element is kept regardless so the wrap maths stays consistent.
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (items.length === 0) return

      const first = items[0]!
      const last = items[items.length - 1]!
      const active = document.activeElement as HTMLElement | null

      if (!active || !root.contains(active)) {
        e.preventDefault()
        first.focus()
        return
      }

      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [ref])
}
