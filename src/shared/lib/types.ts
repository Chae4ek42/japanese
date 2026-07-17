export type ScriptMode = 'hiragana' | 'katakana' | 'both'
export type KanaPickMode = 'adaptive' | 'even' | 'problem'
export type InputMode = 'instant' | 'submit'
export type NumberMode = 'plain' | 'age'
export type NumberRangeId = '10' | '99' | '999'
export type NumbersPickMode = 'adaptive' | 'even'
export type AppPage = 'home' | 'kana' | 'kanji' | 'numbers' | 'vocab' | 'stats'
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

export interface KanjiPreferences {
  complexityFilter: boolean
}

export type VocabDrillMode = 'romaji' | 'choice'
export type VocabSource = 'level' | 'group' | 'mine'
export type VocabLevelFilter = 5 | 4 | 3
export type VocabPickMode = 'adaptive' | 'even'

export interface VocabPreferences {
  drillMode: VocabDrillMode
  source: VocabSource
  level: VocabLevelFilter
  groupId: string
  pickMode: VocabPickMode
  inputMode: InputMode
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
  preferences: VocabPreferences
  stats: Record<string, StatsRecord>
}

export interface AppState {
  version: 13
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

export interface KanjiInfo {
  id: string
  character: string
  level: number
  levelLabel: string
  strokes: number
  meanings: string[]
  onyomi: string[]
  kunyomi: string[]
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
