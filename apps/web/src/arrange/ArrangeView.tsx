import { useMemo } from 'react'
import { applyNumbering, renderThread, threadTotal } from '@threader/core'
import type { Profile, Thread } from '@threader/core'
import { PostEditor } from './PostEditor.js'

type Props = {
  thread: Thread
  profile: Profile
  showCounts: boolean
  onChange: (index: number, text: string) => void
  onSplitAt: (index: number, offset: number) => void
  onMergeDown: (index: number) => void
  onMove: (index: number, direction: -1 | 1) => void
  onToggleLock: (index: number) => void
  onReflow: (index: number) => void
  onDelete: (index: number) => void
}

/**
 * Arrange mode (docs/PLAN.md §4). Every button here calls a pure operation in
 * `core` and renders the thread it returns — no thread logic lives in this file.
 */
export function ArrangeView(props: Props) {
  const { thread, profile } = props

  const rendered = useMemo(() => renderThread(thread, profile), [thread, profile])
  const total = threadTotal(thread, profile)
  const overCount = rendered.filter((p) => p.overLimit).length

  return (
    <section className="pane pane--arrange">
      <header className="pane__head">
        <h2>Posts</h2>
        <span className="pane__meta">
          {thread.posts.length} post{thread.posts.length === 1 ? '' : 's'}
          {overCount > 0 && (
            <strong className="warn"> · {overCount} over limit — cannot publish</strong>
          )}
        </span>
      </header>

      {thread.detached && (
        <p className="pane__note">
          These posts no longer come from your draft — you have edited them here.
          Rebuild them from the draft in Compose.
        </p>
      )}

      <div className="preview">
        {thread.posts.length === 0 ? (
          <p className="empty">Nothing to arrange yet. Write a draft in Compose first.</p>
        ) : (
          thread.posts.map((post, index) => {
            const view = rendered[index]
            // The numbering that will be appended, shown but not editable (ADR-0003).
            const label = applyNumbering('', { index, total }, profile.numbering).trim()
            return (
              <PostEditor
                key={post.id}
                body={post.text}
                numbering={label}
                index={index}
                total={thread.posts.length}
                chars={view?.chars ?? 0}
                limit={profile.charLimit}
                locked={post.locked}
                showCount={props.showCounts}
                canMergeDown={index < thread.posts.length - 1}
                onChange={(text) => props.onChange(index, text)}
                onSplitAt={(offset) => props.onSplitAt(index, offset)}
                onMergeDown={() => props.onMergeDown(index)}
                onMove={(direction) => props.onMove(index, direction)}
                onToggleLock={() => props.onToggleLock(index)}
                onReflow={() => props.onReflow(index)}
                onDelete={() => props.onDelete(index)}
              />
            )
          })
        )}
      </div>
    </section>
  )
}
