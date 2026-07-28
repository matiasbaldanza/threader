import { PLATFORM_LABELS } from '@threader/core'
import type { Profile, Thread } from '@threader/core'
import { Avatar } from './Avatar.js'

type Props = {
  threads: Thread[]
  profiles: Profile[]
  currentId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function when(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function ThreadList({ threads, profiles, currentId, onSelect, onDelete }: Props) {
  /**
   * Only worth showing once there is more than one account: with a single profile the
   * badge is the same mark on every row, costing width in a narrow panel and saying
   * nothing. With two it stops you opening the company account by mistake.
   */
  const showProfile = profiles.length > 1
  const byId = new Map(profiles.map((p) => [p.id, p]))

  return (
    <aside className="sidebar">
      {/* "New" lives in the top bar, not here — it has to stay reachable when this
          panel is collapsed. */}
      <header className="sidebar__head">
        <h2>Threads</h2>
      </header>

      <ul className="sidebar__list">
        {threads.length === 0 && <li className="sidebar__empty">No threads yet.</li>}
        {threads.map((thread) => {
          const profile = byId.get(thread.profileId)
          return (
          <li key={thread.id}>
            <button
              type="button"
              className={`sidebar__item${thread.id === currentId ? ' is-on' : ''}`}
              onClick={() => onSelect(thread.id)}
              aria-current={thread.id === currentId}
              // The meta line truncates in a 15rem panel; hover gives it back, and
              // spells out the platform the badge only hints at with a letter.
              title={
                profile
                  ? `${thread.title} — ${profile.handle} · ${PLATFORM_LABELS[profile.platform]}`
                  : thread.title
              }
            >
              {showProfile && profile && (
                <Avatar
                  handle={profile.handle}
                  name={profile.name}
                  platform={profile.platform}
                />
              )}
              <span className="sidebar__text">
              <span className="sidebar__title">{thread.title}</span>
              <span className="sidebar__meta">
                {showProfile && profile ? `${profile.handle} · ` : ''}
                {thread.posts.length === 0
                  ? 'empty'
                  : `${thread.posts.length} post${thread.posts.length === 1 ? '' : 's'}`}
                {' · '}
                {when(thread.updatedAt)}
              </span>
              </span>
            </button>
            <button
              type="button"
              className="sidebar__delete"
              onClick={() => onDelete(thread.id)}
              title={`Delete "${thread.title}"`}
              aria-label={`Delete ${thread.title}`}
            >
              ✕
            </button>
          </li>
          )
        })}
      </ul>
    </aside>
  )
}
