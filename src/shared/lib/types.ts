export type ScriptMode = 'hiragana' | 'katakana' | 'both'
export type KanaPickMode = 'adaptive' | 'even' | 'problem'
export type InputMode = 'instant' | 'submit'
export type NumberMode = 'plain' | 'age'
export type NumberRangeId = '10' | '99' | '999'
export type NumbersPickMode = 'adaptive' | 'even'
export type AppPage =
  | 'home'
  | 'kana'
  | 'kanji'
  | 'numbers'
  | 'vocab'
  | 'mine'
  | 'train'
  | 'theory'
  | 'analytics'
  | 'accounts'

/** Sections that accumulate active-time analytics. */
export type AnalyticsSection =
  | 'home'
  | 'kana'
  | 'kanji'
  | 'numbers'
  | 'train'
  | 'vocab'
  | 'mine'
  | 'theory'

export interface AnalyticsDayBucket {
  dayKey: string
  totalActiveMs: number
  bySection: Partial<Record<AnalyticsSection, number>>
  answers?: number
  cleanAnswers?: number
}

export interface AnalyticsState {
  lifetimeActiveMs: number
  bySection: Record<AnalyticsSection, number>
  days: AnalyticsDayBucket[]
  activeDayStreak: number
  lastActiveDayKey: string | null
  updatedAt: number
}
export type PracticeView = 'setup' | 'practice'

export type TrainerOutcome = 'empty' | 'correct' | 'wrong' | 'pending' | 'seen' | 'hint'
export type StatsOutcome = 'correct' | 'wrong' | 'hint' | 'seen'
export type VocabDrillMode = 'romaji' | 'choice' | 'mixed'

export interface Hyperparams {
  masteryGain: number
  mistakePenalty: number
  hintPenalty: number
  retireStreak: number
  masteredWeight: number
  recentMistakeBoost: number
  recentMistakeHours: number
  problemThreshold: number
  queueSize: number
  targetLatencyMs: number
  confusionBoost: number
  unseenBoost: number
  seenOnlyBoostRatio: number
  staleBoost: number
  staleAfterHours: number
  staleRampHours: number
  /**
   * Soft-retire cards above this mastery even without a long streak.
   */
  knownMasteryThreshold: number
  /** Extra weight for cards not yet shown in the current session. */
  sessionFreshBoost: number
  /**
   * Weight sharpening for adaptive picks (< 1 concentrates on highest weights).
   * 1 = linear weights; ~0.55 strongly prefers weak/new cards.
   */
  weightTemperature: number
  /** Min cards between mistake-queue reintroductions. */
  mistakeQueueGap: number
  /** Probability of taking a due mistake-queue card when eligible. */
  mistakeQueueChance: number
}

export type RecentAnswerOutcome = 'correct' | 'wrong'

export interface StatsRecord {
  exposures: number
  clears: number
  errors: number
  hints: number
  streak: number
  bestStreak: number
  mastery: number
  avgLatencyMs: number
  fastestLatencyMs: number
  lastSeenAt: number
  lastClearAt: number
  lastErrorAt: number
  lastHintAt: number
  eventAccuracy: number
  /** Rolling window of correct/wrong for «Проблемные» (last 15). */
  recentAnswers?: RecentAnswerOutcome[]
}

export interface DailyHistoryRecord {
  clears: number
  errors: number
  hints: number
  latencySum: number
  latencyCount: number
}

export interface RecentLatencyEntry {
  t: number
  l: number
}

export interface PracticeHistory {
  daily: Record<string, DailyHistoryRecord>
  confusions: Record<string, number>
  recent: RecentLatencyEntry[]
}

export interface PracticeSession {
  poolIds: string[]
  recentHistory: string[]
  lastCardId: string | null
  mistakeQueue: string[]
  sinceQueuePick: number
  mode: KanaPickMode | NumbersPickMode
  /** How many times each card was shown in this practice session. */
  showCounts?: Record<string, number>
  /**
   * Remaining “skip turns” after a clean success — card stays out until the counter hits 0.
   * Decremented on each subsequent card show.
   */
  cooldowns?: Record<string, number>
  /** Adaptive-review v2 sequencer state (vocab). */
  review?: ReviewSessionState
}

export interface RoundState {
  shownAt: number
  mistakes: number
  hintUsed: boolean
  confusionLogged: boolean
  /** C1: at most one wrong stats write / again grade per round. */
  wrongRecorded?: boolean
  /** Soft typo forgiven this round → hard, not again. */
  typoForgiven?: boolean
  /** Explicit «don't know» pressed. */
  dontKnow?: boolean
}

export interface UpdateStatsContext {
  now: number
  latencyMs?: number
  mistakesOnCard?: number
  hintUsed?: boolean
  inputMode?: InputMode
  /** Drill mode for mode-aware latency / fluency. */
  drillMode?: VocabDrillMode
  answerLength?: number
}

/** 0 = recognition (choice), 1 = production (romaji). */
export type ReviewAspect = 0 | 1
export type ReviewGrade = 1 | 2 | 3 | 4
export type MemoryCardState = 'new' | 'learning' | 'review' | 'relearning' | 'leech'

export interface MemoryState {
  /** Stability in hours: interval where retention ≈ 0.9. */
  s: number
  /** Difficulty ∈ [0.05, 0.95]. */
  d: number
  /** Last successful/failed recall timestamp (not mere presentation). */
  lastAt: number
  /** Last time the card was shown on screen. */
  lastPresentedAt: number
  reps: number
  lapses: number
  state: MemoryCardState
  /** Migrated from mastery; tighten intervals until confirmed. */
  uncertain: boolean
  modelVersion: number
  createdAt: number
  leechUntil?: number
}

export interface ReviewPlanKnobs {
  targetRetention: number
  newPerDay: number
  sessionMinutes: number
}

export interface LatencyModel {
  mu: Record<'romaji' | 'choice' | 'mixed', number>
  beta: Record<'romaji' | 'choice' | 'mixed', number>
  samples: number
  /** Recent residual z = log(t) - log(Ê) for personal quantiles. */
  zSamples: number[]
}

export interface ReviewSessionState {
  turn: number
  planIds: string[]
  planIndex: number
  dueTurns: Record<string, number>
  inFlight: string[]
  goodStreaks: Record<string, number>
  graduatedIds: string[]
  seed: number
  mode: 'adaptive' | 'even'
  weightMultipliers: Record<string, number>
  answersInSession: number
  targetAnswers: number
  done: boolean
  /**
   * Max cards simultaneously in the working set.
   * Missing → `IN_FLIGHT_LIMIT` (5) for legacy live sessions / tests.
   * Drill sets a larger value so adaptive doesn't loop on five words.
   */
  inFlightLimit?: number
}

/** Compact append-only review log row (IndexedDB). */
export interface ReviewEvent {
  t: number
  c: string
  a: ReviewAspect
  g: ReviewGrade
  l: number
  e: number
  r: number
  s: number
  d: number
  m: 0 | 1 | 2
  /** Chosen wrong distractor id/text when available. */
  x?: string
}

export interface ReviewDayCounters {
  /** YYYY-MM-DD */
  dayKey: string
  newIntroduced: number
}

export interface KanaEntry {
  baseId: string
  slot: string
  hiragana: string
  katakana: string
  primaryAnswer: string
  answers: string[]
}

export interface KanaGroup {
  id: string
  shortLabel: string
  entries: KanaEntry[]
}

export interface KanaCard {
  id: string
  baseId: string
  groupId: string
  symbol: string
  script: 'hiragana' | 'katakana'
  scriptLabel: string
  primaryAnswer: string
  answers: string[]
}

export interface NumberReading {
  kanji: string
  kana: string
  romaji: string
}

export interface NumberCard {
  id: string
  value: number
  mode: NumberMode
  symbol: string
  kanji: string
  kana: string
  romaji: string
}

export interface KanaPreferences {
  scriptMode: ScriptMode
  selectedGroups: string[]
  mode: KanaPickMode
  inputMode: InputMode
  retryQueueEnabled: boolean
  hyperparams: Hyperparams
}

export interface NumbersPreferences {
  mode: NumberMode
  rangeId: NumberRangeId
  pickMode: NumbersPickMode
}

/** JLPT levels for filtering practice words (5 = N5 … 1 = N1). Empty = all levels. */
export type KanjiWordJlptLevel = 5 | 4 | 3 | 2 | 1

export interface KanjiPreferences {
  /** Word ids hidden from the practice set, keyed by kanji character. */
  hiddenWordsByKanji: Record<string, string[]>
  /**
   * Which JLPT levels of *words* to keep in practice.
   * Empty array = no JLPT filter (all words, including untagged).
   */
  wordJlptLevels: KanjiWordJlptLevel[]
}


export type VocabSource = 'level' | 'group' | 'mine' | 'kanji' | 'list' | 'problem'
export type VocabLevelFilter = 5 | 4 | 3 | 2 | 1
export type VocabPickMode = 'adaptive' | 'even'
/** Top-level train mode: free drill vs spaced repetition on «Мои слова». */
export type VocabSessionMode = 'drill' | 'srs'
/** Prompt shapes for mixed multiple-choice drills (renshuu-style). */
export type VocabPromptKind = 'meaning' | 'reading' | 'writing'

export interface VocabPreferences {
  /** Обычная тренировка vs интервальное повторение (только «Мои слова»). */
  sessionMode: VocabSessionMode
  drillMode: VocabDrillMode
  source: VocabSource
  level: VocabLevelFilter
  groupId: string
  pickMode: VocabPickMode
  inputMode: InputMode
  /**
   * Extra JLPT filter for group/mine/kanji/list sources (and catalog-style narrowing).
   * Empty = no extra filter. Ignored when source === 'level' (uses `level` alone).
   */
  wordJlptLevels: KanjiWordJlptLevel[]
  /**
   * Max words in the practice pool (legacy setup slice).
   * -1 = no limit. Prefer `newPerDay` for the v2 planner.
   */
  newWordLimit: number
  /**
   * When source is group/kanji/list: if true, practice the whole set including words
   * already in «Мои слова». If false, those words are excluded.
   */
  trainFullGroup: boolean
  /**
   * When source === 'mine': if true, include words marked as learned.
   * If false, only unlearned my-words are in the pool.
   */
  mineIncludeLearned: boolean
  /** Kanji characters selected for source === 'kanji' (order = practice order). */
  selectedKanji: string[]
  /** Target retention for due scheduling (0.85…0.95). Used in SRS mode. */
  targetRetention: number
  /** New cards introduced per day via the planner. Used in SRS mode. */
  newPerDay: number
  /** Soft session length in minutes → answer budget. Used in SRS mode. */
  sessionMinutes: number
  /** Use adaptive-review v2 planner/sequencer (default true). */
  reviewV2: boolean
  /**
   * Even pick mode: cards with fewer than this many session shows get `evenBoostFactor`.
   * 0 = no plateau boost (only soft 1/(1+shows)^power decay).
   */
  evenBoostShows: number
  /** Even pick mode: weight multiplier while showCount < evenBoostShows. */
  evenBoostFactor: number
  /** Even pick mode: exponent for soft decay 1/(1+shows)^power. */
  evenDecayPower: number
  /**
   * Which training set to practice when source === 'list'.
   * Falls back to activeTrainingSetId when missing/invalid.
   */
  trainingSetId: string
  /**
   * When false, words tagged (разг.)/(прост.) are excluded from the train pool.
   * Default true (include).
   */
  includeColloquial: boolean
  /**
   * When false, colloquial words are hidden in the dictionary catalog/search
   * (except the dedicated «Разговорные» category).
   * Default true (show).
   */
  showColloquial: boolean
}

export interface VocabTrainingSet {
  id: string
  name: string
  wordIds: string[]
  createdAt: number
  updatedAt: number
}

export interface KanjiWordReading {
  id?: string
  kana: string
  romaji: string
  meanings: string[]
  jlpt?: number
  common?: boolean
}

export interface VocabCard {
  id: string
  writing: string
  kana: string
  romaji: string
  answers: string[]
  meaning: string
  meanings: string[]
  jlpt?: number
  /** Reading variants when several JMDict entries share the writing. */
  readings?: KanjiWordReading[]
  /** All bank ids covered by this card. */
  variantIds?: string[]
}

export interface VocabState {
  myWords: string[]
  /**
   * User-created words (`custom:…`) and local field overrides for bank ids.
   * Bank overrides shadow `getWordById` when resolving pools.
   */
  customWords: Record<string, KanjiWord>
  /** Epoch ms when each id was added to `myWords` (newest sort). */
  myWordAddedAt: Record<string, number>
  /** Word ids permanently removed from vocab pools / catalog training. */
  hiddenWordIds: string[]
  /** My-word ids marked as learned («Выученные»). */
  learnedWordIds: string[]
  /** Named training sets; «+ В набор» writes to `activeTrainingSetId`. */
  trainingSets: VocabTrainingSet[]
  /** Target set for add/toggle from dictionary, kanji, mine, theory words. */
  activeTrainingSetId: string
  /** Words with recent errors:clears worse than 1:2 — source === 'problem'. */
  problemWordIds: string[]
  preferences: VocabPreferences
  stats: Record<string, StatsRecord>
  /**
   * Per (cardId:aspect) memory model state.
   * Keys from `memoryKey(cardId, aspect)`.
   */
  memory: Record<string, MemoryState>
  /** Online latency model for grade derivation. */
  latencyModel: LatencyModel
  /** Daily new-card intake counter. */
  reviewDay: ReviewDayCounters
  /** In-progress drill; survives navigation / remount. */
  liveSession: CardTrainerLiveSession | null
}

export interface AppState {
  version: 28
  kana: {
    preferences: KanaPreferences
    stats: Record<string, StatsRecord>
    history: PracticeHistory
    /** In-progress drill; survives navigation / remount. */
    liveSession: CardTrainerLiveSession | null
  }
  numbers: {
    preferences: NumbersPreferences
    stats: Record<string, StatsRecord>
  }
  kanji: {
    learned: string[]
    preferences: KanjiPreferences
  }
  vocab: VocabState
  analytics: AnalyticsState
}

/** @deprecated Use AppState — kept as alias during migration. */
export type AppStateV11 = AppState

export interface SessionStats {
  answered: number
  clean: number
  streak: number
}

/** Snapshot of an in-progress card trainer (kana / vocab). Survives navigation. */
export interface CardTrainerLiveSession {
  session: PracticeSession
  currentCardId: string | null
  view: PracticeView
  sessionStats: SessionStats
  /** Vocab-only: per-card weight multipliers for the live session. */
  weightMultipliers?: Record<string, number>
  /** Vocab-only: epoch ms when each card entered the session pool. */
  poolAddedAt?: Record<string, number>
  /** Vocab-only: skip navigation history. */
  navHistory?: string[]
  navIndex?: number
}

export type FeedbackType = 'idle' | 'success' | 'wrong' | 'hint' | 'error'

export interface FeedbackState {
  type: FeedbackType
  text: string
}

export type KanjiComponentRole = 'radical' | 'phonetic' | 'semantic' | 'grapheme' | 'other'

export interface KanjiComponentRef {
  id: string
  glyph: string
  role: KanjiComponentRole
  meaningRu: string
  nameRu?: string
}

export interface KanjiComponent {
  id: string
  glyph: string
  kind: 'kanji' | 'radical' | 'grapheme'
  meaningsRu: string[]
  mnemonicRu?: string
  strokes?: number
  usedIn: string[]
}

export interface KanjiInfo {
  id: string
  character: string
  /** JLPT level 5–1, or 0 when only listed as Jōyō without JLPT tag. */
  level: number
  levelLabel: string
  strokes: number
  meanings: string[]
  meaningsRu?: string[]
  onyomi: string[]
  kunyomi: string[]
  joyo?: boolean
  grade?: number
  radicalNumber?: number
  components?: KanjiComponentRef[]
  mnemonicRu?: string
  compositionNoteRu?: string
}

export interface KanjiWord {
  id?: string
  writing: string
  kana: string
  romaji: string
  meanings: string[]
  kanji: string[]
  jlpt?: number
  common?: boolean
  /**
   * All reading/meaning variants for this writing.
   * Present after merge; single-entry words may omit it (treat kana/romaji/meanings as the only reading).
   */
  readings?: KanjiWordReading[]
  /** All JMDict / custom ids covered by a merged word. */
  variantIds?: string[]
}

export interface KanjiBankMeta {
  builtAt: string
  sources: Record<string, string>
  counts: {
    kanji: number
    words: number
    components: number
    joyo: number
    n5: number
    n4: number
    n3: number
    n2: number
    n1: number
    joyoOnly: number
    withComponents: number
    readingFoundation?: number
    readingGroups?: Record<string, number>
    [key: string]: number | Record<string, number> | undefined
  }
}

export type ReadingSegmentRole = 'focus' | 'other' | 'shared' | 'okuri'

export interface ReadingSegment {
  chars: string
  kana: string
  role: ReadingSegmentRole
  source?: string
  romaji?: string
}

/** Per-kanji (or shared-group) coloring for writing + reading alignment. */
export interface ColoredReadingSegment {
  chars: string
  kana: string
  romaji: string
  /** Palette slot; `-1` = okurigana / non-kanji. */
  colorIndex: number
  role: ReadingSegmentRole
  source?: string
}

export interface GlossFootnote {
  marker: string
  text: string
}

export interface ConfusionEntry {
  fromId: string
  toId: string
  count: number
}

export interface GlobalStatsSummary {
  totalEvents: number
  totalResolved: number
  totalHints: number
  cleanAnswers: number
  mastery: number
  bestStreak: number
  problemCount: number
  retiredCount: number
  avgLatencyMs: number
  accuracy: number
}
