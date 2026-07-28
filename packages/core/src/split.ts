import type { CharCounter } from './count.js'
import { countX, graphemes } from './count.js'
import { numberingOverhead } from './numbering.js'
import { defaultNumbering } from './factories.js'
import type { NumberingConfig } from './types.js'

/** Splitting (docs/PLAN.md §4). Pure — no profile, no storage, no UI. */

export type SplitOptions = {
  charLimit: number
  numbering?: NumberingConfig
  count?: CharCounter
  /**
   * How full a post must be before the splitter is willing to back off to a nicer
   * boundary. At 0.5, it will end a post early at a paragraph break rather than
   * mid-sentence, but not if that leaves the post less than half full.
   */
  minFill?: number
  /**
   * Position of the first resulting post within the wider thread. Reflowing from
   * post 6 must budget post 6 as "6/12", not as "1/n" — otherwise a profile that
   * leaves post 1 unnumbered would hand the run a budget it does not have.
   */
  startIndex?: number
  /** Posts elsewhere in the thread, counted into `{total}`. */
  otherPosts?: number
}

/** A line containing only `---` is an explicit break the splitter never crosses. */
const FORCED_BREAK = /^[ \t]*---[ \t]*$/

/**
 * Structural gap following a token. This determines the JOINER used when tokens are
 * recombined, so it must stay faithful to the source layout. Which boundary is
 * *preferred* as a break point is a separate question — see `chooseBreak`.
 */
type Gap = 'word' | 'line' | 'paragraph' | 'end'

type Token = { text: string; after: Gap; sentenceEnd: boolean }

function joiner(after: Gap): string {
  switch (after) {
    case 'paragraph':
      return '\n\n'
    case 'line':
      return '\n'
    default:
      return ' '
  }
}

/**
 * Trailing periods that do not end a sentence. Without this, "e.g. this" and
 * "Node 20.10. Then" both break in the wrong place.
 */
const ABBREVIATIONS = new Set([
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.', 'st.', 'mt.',
  'e.g.', 'i.e.', 'etc.', 'vs.', 'approx.', 'est.', 'fig.', 'no.', 'vol.',
  'inc.', 'ltd.', 'co.', 'dept.', 'univ.', 'al.', 'cf.', 'pp.',
])

const SENTENCE_END = /[.!?…]["'”’)\]]*$/
const STARTS_SENTENCE = /^["'“‘(\[]*(?:\p{Lu}|\p{N}|\p{Extended_Pictographic})/u
/** A lone initial like "J." in "J. Smith". */
const INITIAL = /^\p{Lu}\.$/u

function endsSentence(word: string, next: string | undefined): boolean {
  if (!SENTENCE_END.test(word)) return false
  if (ABBREVIATIONS.has(word.toLowerCase())) return false
  if (INITIAL.test(word)) return false
  if (next === undefined) return true
  return STARTS_SENTENCE.test(next)
}

export function normalize(source: string): string {
  return source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Splits on forced `---` breaks. Each segment starts a new post. */
export function splitOnForcedBreaks(text: string): string[] {
  const segments: string[] = []
  let current: string[] = []
  for (const line of text.split('\n')) {
    if (FORCED_BREAK.test(line)) {
      segments.push(current.join('\n'))
      current = []
      continue
    }
    current.push(line)
  }
  segments.push(current.join('\n'))
  return segments.map((s) => s.trim()).filter((s) => s.length > 0)
}

/**
 * Words, each tagged with the gap that follows it. Splitting on whitespace is what
 * keeps URLs, @handles and #hashtags intact — they are never broken because they
 * are never divisible.
 */
export function tokenize(segment: string): Token[] {
  const tokens: Token[] = []
  const paragraphs = segment.split(/\n{2,}/)

  paragraphs.forEach((paragraph, pIndex) => {
    const isLastParagraph = pIndex === paragraphs.length - 1
    const lines = paragraph.split('\n')

    lines.forEach((line, lIndex) => {
      const isLastLine = lIndex === lines.length - 1
      const words = line.split(/[ \t]+/).filter((w) => w.length > 0)

      words.forEach((word, wIndex) => {
        const isLastWord = wIndex === words.length - 1
        const after: Gap =
          isLastWord && isLastLine && isLastParagraph
            ? 'end'
            : isLastWord && isLastLine
              ? 'paragraph'
              : isLastWord
                ? 'line'
                : 'word'

        tokens.push({
          text: word,
          after,
          sentenceEnd: endsSentence(word, words[wIndex + 1]),
        })
      })
    })
  })

  const last = tokens[tokens.length - 1]
  if (last) last.after = 'end'
  return tokens
}

/** Hard-slices a token too long to fit anywhere. Only reachable for unbroken runs. */
function sliceToFit(text: string, budget: number, count: CharCounter): [string, string] {
  const clusters = graphemes(text)
  let head = ''
  for (const cluster of clusters) {
    const next = head + cluster
    if (count(next) > budget) break
    head = next
  }
  // Budget too small for even one cluster — take one anyway so we cannot loop forever.
  if (head === '') head = clusters[0] ?? text
  return [head, text.slice(head.length)]
}

type Candidate = { end: number; text: string; token: Token }

/**
 * Of everything that fits, pick the nicest place to break: paragraph, then end of
 * sentence, then end of line — but only if the post stays at least `minFill` full.
 * Otherwise take the greedy maximum and break mid-sentence.
 */
function chooseBreak(
  fits: Candidate[],
  budget: number,
  minFill: number,
  count: CharCounter,
): Candidate {
  const greedy = fits[fits.length - 1]!
  if (greedy.token.after === 'end') return greedy

  const floor = budget * minFill
  const tiers: Array<(c: Candidate) => boolean> = [
    (c) => c.token.after === 'paragraph',
    (c) => c.token.sentenceEnd,
    (c) => c.token.after === 'line',
  ]

  for (const matches of tiers) {
    for (let i = fits.length - 1; i >= 0; i--) {
      const candidate = fits[i]!
      if (!matches(candidate)) continue
      if (count(candidate.text) >= floor) return candidate
    }
  }
  return greedy
}

function packSegment(
  tokens: Token[],
  posts: string[],
  budgetAt: (index: number) => number,
  count: CharCounter,
  minFill: number,
): void {
  let i = 0
  while (i < tokens.length) {
    const budget = Math.max(1, budgetAt(posts.length))
    const fits: Candidate[] = []
    let current = ''

    for (let j = i; j < tokens.length; j++) {
      const token = tokens[j]!
      const candidate =
        j === i ? token.text : current + joiner(tokens[j - 1]!.after) + token.text
      if (count(candidate) > budget) break
      current = candidate
      fits.push({ end: j, text: current, token })
    }

    if (fits.length === 0) {
      const token = tokens[i]!
      const [head, rest] = sliceToFit(token.text, budget, count)
      posts.push(head)
      tokens[i] = { ...token, text: rest }
      continue
    }

    const chosen = chooseBreak(fits, budget, minFill, count)
    posts.push(chosen.text)
    i = chosen.end + 1
  }
}

/**
 * Splits `source` into post bodies that fit the limit once numbering is added.
 *
 * The post count changes the width of `{total}` ("9/9" vs "9/12"), which changes
 * the budget, which can change the post count — so this iterates to a fixpoint.
 * On the rare oscillation it settles on the larger count, which is always safe.
 */
export function split(source: string, opts: SplitOptions): string[] {
  const count = opts.count ?? countX
  const numbering = opts.numbering ?? defaultNumbering
  const minFill = opts.minFill ?? 0.5

  const text = normalize(source)
  if (!text) return []

  const startIndex = opts.startIndex ?? 0
  const otherPosts = opts.otherPosts ?? 0

  const segments = splitOnForcedBreaks(text).map(tokenize)

  /** `local` is how many posts this run produces; the total also counts the rest. */
  const pack = (local: number): string[] => {
    const total = otherPosts + local
    const posts: string[] = []
    const budgetAt = (index: number) => {
      const absolute = startIndex + index
      // The end marker only costs the final post, and which post is final is not
      // known until packing finishes — reserving it here rather than appending it
      // afterwards is what keeps that post inside the limit. The fixpoint below
      // handles the case where reserving it forces one more post.
      const slot = { index: absolute, total, isLast: absolute === total - 1 }
      return opts.charLimit - numberingOverhead(slot, numbering, count)
    }
    for (const tokens of segments) {
      packSegment(
        tokens.map((t) => ({ ...t })),
        posts,
        budgetAt,
        count,
        minFill,
      )
    }
    return posts
  }

  /** Does the actual final post fit once the end marker is charged to it? */
  const lastFits = (list: string[]): boolean => {
    const text = list[list.length - 1]
    if (!text) return true
    const total = otherPosts + list.length
    const slot = { index: total - 1, total, isLast: true }
    return count(text) <= opts.charLimit - numberingOverhead(slot, numbering, count)
  }

  /**
   * The end marker is charged to whichever post turns out to be last — but that is
   * only known once packing has finished, and the fixpoint's assumed count can differ
   * from what it produced. When it does, the real final post was budgeted as an
   * ordinary one and the marker pushes it over.
   *
   * So repair it: re-pack that post alone against the correct final-post budget. Each
   * pass strictly shortens the last post, so this terminates, and it costs at most one
   * extra post rather than charging every post for a marker only one of them carries.
   */
  const repairLast = (list: string[]): string[] => {
    let result = list
    for (let guard = 0; guard < 4 && !lastFits(result); guard++) {
      const lastText = result[result.length - 1]!
      const startAbsolute = otherPosts + result.length - 1
      const assumedTotal = otherPosts + result.length + 1
      // Every post in the repaired tail is costed as if it were the final one. Which
      // of them ends up last is not knowable until packing finishes, and this is the
      // one place where guessing wrong puts a post over the limit. The pessimism is
      // confined to the tail — one or two posts — rather than the whole thread.
      const budgetAt = (index: number) => {
        const slot = { index: startAbsolute + index, total: assumedTotal, isLast: true }
        return opts.charLimit - numberingOverhead(slot, numbering, count)
      }

      const tail: string[] = []
      packSegment(tokenize(lastText), tail, budgetAt, count, minFill)
      // Nothing left to break apart — accept rather than loop forever.
      if (tail.length <= 1) return result
      result = [...result.slice(0, -1), ...tail]
    }
    return result
  }

  let local = Math.max(1, segments.length)
  let posts = pack(local)
  const seen = new Set<number>([local])

  for (let i = 0; i < 3 && posts.length !== local; i++) {
    if (seen.has(posts.length)) {
      local = Math.max(...seen, posts.length)
      posts = pack(local)
      break
    }
    local = posts.length
    seen.add(local)
    posts = pack(local)
  }

  return repairLast(posts)
}
