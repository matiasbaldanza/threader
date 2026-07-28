type Props = {
  chars: number
  limit: number
}

/**
 * The ring fills as the post fills, and turns amber then red near the limit —
 * the same shape X uses, so it reads without explanation.
 */
export function CharMeter({ chars, limit }: Props) {
  const ratio = limit > 0 ? chars / limit : 0
  const remaining = limit - chars
  const state = chars > limit ? 'over' : ratio > 0.9 ? 'close' : 'ok'

  const radius = 8
  const circumference = 2 * Math.PI * radius
  const dash = circumference * Math.min(ratio, 1)

  return (
    <div className={`meter meter--${state}`} title={`${chars} of ${limit} characters`}>
      {/* Once over the limit the number matters more than the ring. */}
      {state === 'over' ? (
        <span className="meter__count">{remaining}</span>
      ) : (
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
      )}
      <span className="sr-only">
        {chars} of {limit} characters
      </span>
    </div>
  )
}
