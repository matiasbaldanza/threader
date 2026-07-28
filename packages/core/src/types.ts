/**
 * Domain types. See docs/PLAN.md §3.
 *
 * Two invariants worth restating here, because everything else depends on them:
 * - `Post.text` holds the body ONLY. Numbering is derived at render time (ADR-0003).
 * - Character limits are measured with `countChars`, never `String.length` (ADR-0006).
 */

export type Platform = 'x' | 'bluesky' | 'mastodon' | 'custom'

export type AssetKind = 'image' | 'gif' | 'video'

export type AssetRef = {
  id: string
  /** Relative to the thread folder, or to the profile library. */
  path: string
  kind: AssetKind
  alt?: string
}

export type PublishedRef = {
  url: string
  at: string
}

export type Post = {
  id: string
  /** Body only — numbering is never stored here. */
  text: string
  assets: AssetRef[]
  /** Reflow must not touch this post. */
  locked: boolean
  published: PublishedRef | null
}

export type ClosingPost = {
  /** Which profile template it came from, if any. */
  templateId: string | null
  /** Still contains {{url}} until the wizard resolves it at publish time. */
  text: string
  assets: AssetRef[]
  published: PublishedRef | null
}

export type PublishRun = {
  startedAt: string
  /** -1 = not started, n = at post n, posts.length = closing post. */
  cursor: number
  firstPostUrl: string | null
  completedAt: string | null
}

export type Thread = {
  id: string
  profileId: string
  /** For the thread list — never published. */
  title: string
  /** The original blob of text, before splitting. */
  source: string
  /** True once posts were edited individually (ADR-0004). */
  detached: boolean
  posts: Post[]
  closing: ClosingPost | null
  publishRun: PublishRun | null
  createdAt: string
  updatedAt: string
}

export type NumberingConfig = {
  /** e.g. "{n}/{total}", "🧵{n}/{total}", "{n}.", "" */
  format: string
  position: 'prefix' | 'suffix'
  /** "\n\n" for suffix, " " for prefix. */
  separator: string
  /** Some people leave post 1 unnumbered. */
  includeFirst: boolean
  includeClosing: boolean
}

export type ClosingTemplate = {
  id: string
  label: string
  /** Supports {{url}} {{handle}} {{count}} {{title}}. */
  body: string
}

/** Advisory lint only — never rewrites content. Stage 9. */
export type StyleRules = {
  maxEmojiPerPost?: number
  maxHashtagsPerPost?: number
  /** Links in post 1 suppress reach. */
  warnOnLinkInFirstPost?: boolean
  signOff?: string
}

export type Profile = {
  id: string
  name: string
  handle: string
  platform: Platform
  charLimit: number
  numbering: NumberingConfig
  closingTemplates: ClosingTemplate[]
  style: StyleRules
  libraryPath: string | null
}
