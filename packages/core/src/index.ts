export type * from './types.js'

export {
  createPost,
  createProfile,
  createThread,
  defaultNumbering,
  deriveTitle,
  isBlankThread,
  withProfileDefaults,
  type Clock,
  type Ids,
} from './factories.js'

export {
  NUMBERING_SEPARATORS,
  PLATFORM_LABELS,
  PLATFORM_LIMITS,
  PLATFORMS,
} from './platforms.js'

export {
  containsUrl,
  countBluesky,
  countMastodon,
  countX,
  counterFor,
  findUrls,
  graphemes,
  TRANSFORMED_URL_LENGTH,
  type CharCounter,
  type UrlMatch,
} from './count.js'

export {
  needsUrl,
  PLACEHOLDER_URL,
  resolveTemplate,
  type TemplateVars,
} from './templates.js'

export {
  applyNumbering,
  numberingApplies,
  numberingOverhead,
  renderNumbering,
  renderPost,
  renderThread,
  threadTotal,
  type RenderedPost,
  type Slot,
} from './numbering.js'

export {
  normalize,
  split,
  splitOnForcedBreaks,
  tokenize,
  type SplitOptions,
} from './split.js'

export {
  abandonPublish,
  currentStep,
  isPublishing,
  needsFirstPostUrl,
  parseStatusUrl,
  publishBlockedReason,
  recordPublished,
  skipStep,
  startPublish,
  stepBack,
  stepCount,
  type PublishStep,
  type StatusUrl,
} from './publish.js'

export {
  joinBodies,
  mergePosts,
  movePost,
  postsFromBodies,
  reflowFrom,
  removePost,
  resplitFromSource,
  setClosing,
  setClosingText,
  setLocked,
  setPostText,
  setSource,
  splitPost,
  type OpContext,
  type ReflowOptions,
} from './operations.js'
