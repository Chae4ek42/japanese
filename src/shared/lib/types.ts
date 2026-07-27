export type ScriptMode = 'hiragana' | 'katakana' | 'both'
export type KanaPickMode = 'adaptive' | 'even' | 'problem'
export type InputMode = 'instant' | 'submit'
export type NumberMode = 'plain' | 'age'
export type NumberRangeId = '10' | '99' | '999'
export type NumbersPickMode = 'adaptive' | 'even'
export type AppPage = 'home' | 'kana' | 'kanji' | 'numbers' | 'vocab' | 'context'
export type PracticeView = 'setup' | 'practice'

export type TrainerOutcome = 'empty' | 'correct' | 'wrong' | 'pending' | 'seen' | 'hint'
export type StatsOutcome = 'correct' | 'wrong' | 'hint' | 'seen'

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
}

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
}

export interface RoundState {
  shownAt: number
  mistakes: number
  hintUsed: boolean
  confusionLogged: boolean
}

export interface UpdateStatsContext {
  now: number
  latencyMs?: number
  mistakesOnCard?: number
  hintUsed?: boolean
  inputMode?: InputMode
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
  complexityFilter: boolean
  /** Word ids hidden from the practice set, keyed by kanji character. */
  hiddenWordsByKanji: Record<string, string[]>
  /**
   * Which JLPT levels of *words* to keep in practice.
   * Empty array = no JLPT filter (all words, including untagged).
   */
  wordJlptLevels: KanjiWordJlptLevel[]
}


export type VocabDrillMode = 'romaji' | 'choice'
export type VocabSource = 'level' | 'group' | 'mine'
export type VocabLevelFilter = 5 | 4 | 3 | 2 | 1
export type VocabPickMode = 'adaptive' | 'even'

export interface VocabPreferences {
  drillMode: VocabDrillMode
  source: VocabSource
  level: VocabLevelFilter
  groupId: string
  pickMode: VocabPickMode
  inputMode: InputMode
  /**
   * Extra JLPT filter for group/mine sources (and catalog-style narrowing).
   * Empty = no extra filter. Ignored when source === 'level' (uses `level` alone).
   */
  wordJlptLevels: KanjiWordJlptLevel[]
  /**
   * Max brand-new words (stats.exposures === 0) in the practice pool.
   * 0 = no limit. Already-seen words from the set stay available for review.
   */
  newWordLimit: number
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
}

export interface VocabState {
  myWords: string[]
  /** User-created words keyed by id (`custom:…`). */
  customWords: Record<string, KanjiWord>
  preferences: VocabPreferences
  stats: Record<string, StatsRecord>
}

export interface ContextPreferences {
  groupId: string
  /** Allow one unknown grammar tag when picking a sentence. */
  allowOneNewGrammar: boolean
  /** How many new words to keep in the active learning batch (1–5). */
  batchSize: number
  /** Max unknown (new) words allowed inside one sentence (1–batchSize). */
  maxNewPerSentence: number
}

export interface ContextHistoryPage {
  sentence: ContextSentence
  revealed: boolean
}

export interface ContextSession {
  groupId: string
  batchIds: string[]
  pages: ContextHistoryPage[]
  pageIndex: number
  recentSentenceIds: string[]
  wordsLearnedIds: string[]
  startedAt: number
  status: 'active' | 'done'
}

export interface ContextTrainingLogEntry {
  id: string
  groupId: string
  startedAt: number
  endedAt?: number
  wordsLearnedIds: string[]
  sentencesSeen: number
  outcome: 'active' | 'completed' | 'abandoned'
}

export interface ContextState {
  knownWordIds: string[]
  knownGrammarIds: string[]
  preferences: ContextPreferences
  /** Generated LLM sentences cached by target word id (newest last). */
  generatedCache: Record<string, ContextSentence[]>
  /** In-progress drill; survives navigation / remount. */
  session: ContextSession | null
  /** Recent finished or abandoned sessions (newest last). */
  trainingLog: ContextTrainingLogEntry[]
}

export interface ContextSentence {
  id: string
  text: string
  reading?: string
  glossRu: string
  wordIds: string[]
  grammarIds: string[]
  themeHints?: string[]
  source?: 'seed' | 'tatoeba' | 'llm'
}

export interface AppState {
  version: 19
  kana: {
    preferences: KanaPreferences
    stats: Record<string, StatsRecord>
    history: PracticeHistory
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
  context: ContextState
}

/** @deprecated Use AppState — kept as alias during migration. */
export type AppStateV11 = AppState

export interface SessionStats {
  answered: number
  clean: number
  streak: number
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
}

export interface KanjiBankMeta {
  builtAt: string
  sources: Record<string, string>
  counts: Record<string, number>
}

export type ReadingSegmentRole = 'focus' | 'other' | 'shared' | 'okuri'

export interface ReadingSegment {
  chars: string
  kana: string
  role: ReadingSegmentRole
  source?: string
  romaji?: string
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
