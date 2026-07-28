import { useMemo, useState } from 'react'
import { createProfile } from '@threader/core'
import { ComposeView } from './compose/ComposeView.js'

/**
 * Stage 2 — compose mode only, with a hardcoded profile. Real profiles and
 * persistence arrive in Stages 4 and 5 (docs/PLAN.md §8), at which point view
 * preferences like `showCounts` become profile settings rather than local state.
 */
export function App() {
  const profile = useMemo(
    () => createProfile({ name: 'Main', handle: '@matiasbaldanza' }),
    [],
  )
  const [showCounts, setShowCounts] = useState(false)

  return (
    <div className="app">
      <header className="topbar">
        <h1>Threader</h1>
        <span className="topbar__profile">
          {profile.handle} · {profile.charLimit} chars · {profile.numbering.format}
        </span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={showCounts}
            onChange={(e) => setShowCounts(e.target.checked)}
          />
          Show counts
        </label>
      </header>
      <ComposeView profile={profile} showCounts={showCounts} />
    </div>
  )
}
