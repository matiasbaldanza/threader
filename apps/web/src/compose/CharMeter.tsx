type Props = {
  chars: number
  limit: number
  /** Show the numeric count alongside the ring. Over the limit it shows regardless. */
  showCount?: boolean
}

/**
 * The ring fills as the post fills, and turns amber then red near the limit —
 * the same shape X uses, so it reads without explanation.
 *
 * Over the limit the number is the actionable part, so it appears whether or not
 * counts are switched on, and shows how far over rather than the running total.
 */
export function CharMeter({ chars, limit, showCount = false }: Props) {
  const ratio = limit > 0 ? chars / limit : 0
  const over = chars > limit
  const state = over ? 'over' : ratio > 0.9 ? 'close' : 'ok'

  const radius = 8
  const circumference = 2 * Math.PI * radius
  const dash = circumference * Math.min(ratio, 1)

  const label = over ? String(limit - chars) : `${chars}/${limit}`
  const visible = showCount || over

  return (
    <div className={`meter meter--${state}`} title={`${chars} of ${limit} characters`}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle className="meter__track" cx="10" cy="10" r={radius} />
        <circle
          className="meter__fill"
          cx="10"
          cy="10"
          r={radius}
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 10 10)"
        />
      </svg>
      {visible ? (
        <span className="meter__count">{label}</span>
      ) : (
        <span className="sr-only">
          {chars} of {limit} characters
        </span>
      )}
    </div>
  )
}
