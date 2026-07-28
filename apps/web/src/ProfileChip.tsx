import { PLATFORM_LABELS } from '@threader/core'
import type { Profile } from '@threader/core'
import { Avatar } from './Avatar.js'

type Props = {
  profile: Profile
  onOpen: () => void
}

/**
 * The account this thread will be posted as.
 *
 * Sits next to the title rather than top-right on purpose. A top-right avatar means
 * "who is logged in" — global, one at a time. A profile is a property of the thread
 * (`thread.profileId`), so switching it changes this thread and nothing else. Borrowing
 * the logged-in-user convention would say the opposite of what is true.
 *
 * Shows the handle, not the name: the handle is what identifies where the thread goes.
 * The name is the label you gave the profile to find it in a list, so it belongs in the
 * switcher and the tooltip.
 */
export function ProfileChip({ profile, onOpen }: Props) {
  return (
    <button
      type="button"
      className="chip"
      onClick={onOpen}
      title={
        `${profile.name} · ${PLATFORM_LABELS[profile.platform]} · ` +
        `${profile.charLimit} characters — click to change`
      }
    >
      <Avatar handle={profile.handle} name={profile.name} platform={profile.platform} />
      <span className="chip__handle">{profile.handle}</span>
    </button>
  )
}
