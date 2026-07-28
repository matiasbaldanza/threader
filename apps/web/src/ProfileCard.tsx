import { useEffect, useState } from 'react'
import {
  applyNumbering,
  countX,
  counterFor,
  NUMBERING_SEPARATORS,
  PLATFORM_LABELS,
  PLATFORM_LIMITS,
  PLATFORMS,
} from '@threader/core'
import type { Platform, Profile } from '@threader/core'

type Props = {
  profiles: Profile[]
  selectedId: string
  onSelect: (id: string) => void
  onChange: (profile: Profile) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onClose: () => void
}

/**
 * Profile settings (docs/PLAN.md §8, Stage 5).
 *
 * Every numbering control shows its effect on a sample post rather than describing it,
 * because the interesting part is what the reader will see — and because the numbering
 * eats into the character budget, which is hard to picture from a format string.
 */
export function ProfileCard({
  profiles,
  selectedId,
  onSelect,
  onChange,
  onCreate,
  onDelete,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const profile = profiles.find((p) => p.id === selectedId) ?? profiles[0]
  if (!profile) return null

  const set = (patch: Partial<Profile>) => onChange({ ...profile, ...patch })
  const setNumbering = (patch: Partial<Profile['numbering']>) =>
    onChange({ ...profile, numbering: { ...profile.numbering, ...patch } })

  const setTemplate = (index: number, next: Profile['closingTemplates'][number]) =>
    set({
      closingTemplates: profile.closingTemplates.map((t, i) => (i === index ? next : t)),
    })

  const removeTemplate = (index: number) =>
    set({ closingTemplates: profile.closingTemplates.filter((_, i) => i !== index) })

  const addTemplate = () =>
    set({
      closingTemplates: [
        ...profile.closingTemplates,
        {
          id: globalThis.crypto.randomUUID(),
          label: 'New template',
          body: 'If this was useful, repost the first post 🙏\n\n{{url}}',
        },
      ],
    })

  const count = counterFor(profile.platform)
  const sample = applyNumbering(
    'The body of a post in the middle of the thread.',
    { index: 2, total: 12 },
    profile.numbering,
  )
  const overhead = count(applyNumbering('', { index: 2, total: 12 }, profile.numbering))

  return (
    <div className="scrim scrim--right" onClick={onClose} role="presentation">
      <div
        className="help profile drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Profile settings"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="help__head">
          <h2>Profiles</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="profile__switcher">
          <label>
            <span className="sr-only">Profile</span>
            <select value={profile.id} onChange={(e) => onSelect(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.handle}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost" onClick={onCreate}>
            New profile
          </button>
        </div>

        <section>
          <h3>Account</h3>
          <div className="field">
            <label htmlFor="p-name">Name</label>
            <input
              id="p-name"
              value={profile.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="p-handle">Handle</label>
            <input
              id="p-handle"
              value={profile.handle}
              onChange={(e) => set({ handle: e.target.value })}
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label htmlFor="p-platform">Platform</label>
            <select
              id="p-platform"
              value={profile.platform}
              onChange={(e) => {
                const platform = e.target.value as Platform
                // Move the limit with the platform unless it was customised away
                // from that platform's default.
                const wasDefault = profile.charLimit === PLATFORM_LIMITS[profile.platform]
                set({
                  platform,
                  ...(wasDefault ? { charLimit: PLATFORM_LIMITS[platform] } : {}),
                })
              }}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="p-limit">Character limit</label>
            <input
              id="p-limit"
              type="number"
              min={20}
              max={100000}
              value={profile.charLimit}
              onChange={(e) => set({ charLimit: Number(e.target.value) || 1 })}
            />
          </div>
        </section>

        <section>
          <h3>Numbering</h3>
          <div className="field">
            <label htmlFor="p-format">Format</label>
            <input
              id="p-format"
              value={profile.numbering.format}
              onChange={(e) => setNumbering({ format: e.target.value })}
              placeholder="{n}/{total}"
              spellCheck={false}
            />
          </div>
          <p className="help__note">
            <code>{'{n}'}</code> is the post number, <code>{'{total}'}</code> the count.
            Leave it empty for no numbering at all.
          </p>

          <div className="field">
            <label htmlFor="p-position">Position</label>
            <select
              id="p-position"
              value={profile.numbering.position}
              onChange={(e) =>
                setNumbering({ position: e.target.value as 'prefix' | 'suffix' })
              }
            >
              <option value="suffix">After the post</option>
              <option value="prefix">Before the post</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="p-separator">Separated by</label>
            <select
              id="p-separator"
              value={profile.numbering.separator}
              onChange={(e) => setNumbering({ separator: e.target.value })}
            >
              {NUMBERING_SEPARATORS.map((s) => (
                <option key={s.label} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <label className="toggle toggle--row">
            <input
              type="checkbox"
              checked={profile.numbering.includeFirst}
              onChange={(e) => setNumbering({ includeFirst: e.target.checked })}
            />
            Number the first post
          </label>
          <label className="toggle toggle--row">
            <input
              type="checkbox"
              checked={profile.numbering.includeClosing}
              onChange={(e) => setNumbering({ includeClosing: e.target.checked })}
            />
            Number the closing post
          </label>

          <h3>Preview</h3>
          <pre className="profile__preview">{sample}</pre>
          <p className="help__note">
            Numbering costs <strong>{overhead}</strong> of your{' '}
            <strong>{profile.charLimit}</strong> characters, leaving{' '}
            <strong>{profile.charLimit - overhead}</strong> for the post itself.
            {profile.platform === 'x' && countX('🙏') === 2 && (
              <> Emoji in the format count as 2.</>
            )}
          </p>
        </section>

        <section>
          <h3>Ending</h3>
          <div className="field">
            <label htmlFor="p-marker">End marker</label>
            <input
              id="p-marker"
              value={profile.numbering.endMarker}
              onChange={(e) => setNumbering({ endMarker: e.target.value })}
              placeholder="EOF"
              spellCheck={false}
            />
          </div>
          <p className="help__note">
            Added to the last post — <code>12/12 EOF</code> — for threads that just stop.
            Leave it empty for nothing. A thread with a closing post never shows it: a
            closing post already is the ending.
          </p>

          <h3>Closing templates</h3>
          {profile.closingTemplates.map((template, index) => (
            <div className="template" key={template.id}>
              <div className="field">
                <label htmlFor={`t-label-${template.id}`}>Label</label>
                <input
                  id={`t-label-${template.id}`}
                  value={template.label}
                  onChange={(e) =>
                    setTemplate(index, { ...template, label: e.target.value })
                  }
                />
              </div>
              <textarea
                className="template__body"
                value={template.body}
                onChange={(e) =>
                  setTemplate(index, { ...template, body: e.target.value })
                }
                aria-label={`${template.label} body`}
                rows={3}
              />
              <p className="notice__actions">
                <button type="button" onClick={() => removeTemplate(index)}>
                  Remove
                </button>
              </p>
            </div>
          ))}
          <p className="notice__actions">
            <button type="button" onClick={addTemplate}>
              Add template
            </button>
          </p>
          <p className="help__note">
            <code>{'{{url}}'}</code> is the link to post 1, <code>{'{{handle}}'}</code>,{' '}
            <code>{'{{count}}'}</code> and <code>{'{{title}}'}</code> are also available.
          </p>
        </section>

        <section>
          <h3>Danger</h3>
          {confirmingDelete ? (
            <p className="notice__actions">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  onDelete(profile.id)
                  setConfirmingDelete(false)
                }}
              >
                Delete “{profile.name}”
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </p>
          ) : (
            <p className="notice__actions">
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={profiles.length <= 1}
                title={
                  profiles.length <= 1
                    ? 'The last profile cannot be deleted — threads point at it'
                    : undefined
                }
              >
                Delete this profile
              </button>
            </p>
          )}
          <p className="help__note">
            Threads keep their own copy of the text. Deleting a profile only removes its
            settings; threads using it fall back to the first profile.
          </p>
        </section>
      </div>
    </div>
  )
}
