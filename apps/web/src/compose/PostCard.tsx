import { CharMeter } from './CharMeter.js'

type Props = {
  /** Body plus numbering — exactly what will be posted. */
  text: string
  index: number
  total: number
  chars: number
  limit: number
}

export function PostCard({ text, index, total, chars, limit }: Props) {
  const over = chars > limit

  return (
    <article className={`card${over ? ' card--over' : ''}`}>
      <header className="card__head">
        <span className="card__index">
          {index + 1} <span className="card__of">of {total}</span>
        </span>
        <CharMeter chars={chars} limit={limit} />
      </header>
      {/* Preserves the newlines the splitter chose, including the numbering separator. */}
      <p className="card__body">{text}</p>
    </article>
  )
}
