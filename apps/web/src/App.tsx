import { useMemo } from 'react'
import { createProfile } from '@threader/core'
import { ComposeView } from './compose/ComposeView.js'

/**
 * Stage 2 — compose mode only, with a hardcoded profile. Real profiles and
 * persistence arrive in Stages 4 and 5 (docs/PLAN.md §8).
 */
export function App() {
  const profile = useMemo(
    () => createProfile({ name: 'Main', handle: '@matiasbaldanza' }),
    [],
  )

  return (
    <div className="app">
      <header className="topbar">
        <h1>Threader</h1>
        <span className="topbar__profile">
          {profile.handle} · {profile.charLimit} chars · {profile.numbering.format}
        </span>
      </header>
      <ComposeView profile={profile} />
    </div>
  )
}
