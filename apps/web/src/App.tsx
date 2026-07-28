import { createProfile } from '@threader/core'

/**
 * Stage 0 placeholder. Compose mode lands in Stage 2 (docs/PLAN.md §8) — this
 * screen exists only to prove the workspace wiring: the web app importing the
 * headless core.
 */
export function App() {
  const profile = createProfile({ name: 'Main', handle: '@matiasbaldanza' })

  return (
    <main>
      <h1>Threader</h1>
      <p className="muted">Stage 0 — scaffold. Compose mode arrives in Stage 2.</p>
      <dl>
        <dt>Profile</dt>
        <dd>
          {profile.name} · {profile.handle}
        </dd>
        <dt>Platform</dt>
        <dd>{profile.platform}</dd>
        <dt>Character limit</dt>
        <dd>{profile.charLimit}</dd>
        <dt>Numbering</dt>
        <dd>
          <code>{profile.numbering.format}</code> ({profile.numbering.position})
        </dd>
      </dl>
    </main>
  )
}
