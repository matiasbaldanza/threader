/**
 * Closing-post templates (docs/PLAN.md §5).
 *
 * A closing post is written before the thread exists, so `{{url}}` — the link back to
 * post 1 — cannot be resolved until post 1 is actually live. That is the whole reason
 * URL capture is step one of the publish wizard rather than an afterthought.
 */

export type TemplateVars = {
  /** Post 1's URL, or null while the thread is unpublished. */
  url?: string | null
  handle?: string
  count?: number
  title?: string
}

/**
 * Stand-in for an unresolved `{{url}}`.
 *
 * A real-looking URL rather than a word, so the character counter treats it the way X
 * will — a flat 23 — without anything having to special-case placeholders. Get this
 * wrong and a closing post that measured fine turns out to be over the limit at the
 * exact moment you are least able to fix it.
 */
export const PLACEHOLDER_URL = 'https://x.com/i/status/0'

const PATTERN = /\{\{\s*(url|handle|count|title)\s*\}\}/g

export function resolveTemplate(body: string, vars: TemplateVars = {}): string {
  return body.replace(PATTERN, (_match, name: string) => {
    switch (name) {
      case 'url':
        return vars.url ?? PLACEHOLDER_URL
      case 'handle':
        return vars.handle ?? ''
      case 'count':
        return vars.count === undefined ? '' : String(vars.count)
      case 'title':
        return vars.title ?? ''
      default:
        return ''
    }
  })
}

/** True when the text still depends on a URL nobody has yet. */
export function needsUrl(body: string): boolean {
  return /\{\{\s*url\s*\}\}/.test(body)
}
