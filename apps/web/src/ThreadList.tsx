import type { Thread } from '@threader/core'

type Props = {
  threads: Thread[]
  currentId: string | null
  onSelect: (id: string) => void
  onNew: () => void
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

export function ThreadList({ threads, currentId, onSelect, onNew, onDelete }: Props) {
  return (
    <aside className="sidebar">
      <header className="sidebar__head">
        <h2>Threads</h2>
        <button type="button" className="ghost" onClick={onNew} title="New thread">
          New
        </button>
      </header>

      <ul className="sidebar__list">
        {threads.length === 0 && <li className="sidebar__empty">No threads yet.</li>}
        {threads.map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              className={`sidebar__item${thread.id === currentId ? ' is-on' : ''}`}
              onClick={() => onSelect(thread.id)}
              aria-current={thread.id === currentId}
            >
              <span className="sidebar__title">{thread.title}</span>
              <span className="sidebar__meta">
                {thread.posts.length === 0
                  ? 'empty'
                  : `${thread.posts.length} post${thread.posts.length === 1 ? '' : 's'}`}
                {' · '}
                {when(thread.updatedAt)}
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
        ))}
      </ul>
    </aside>
  )
}
