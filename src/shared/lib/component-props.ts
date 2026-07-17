import type { ChangeEvent, KeyboardEvent, ReactNode, RefObject } from 'react'
import type {
  FeedbackState,
  Hyperparams,
  InputMode,
  KanaCard,
  KanaGroup,
  KanaPreferences,
  KanjiPreferences,
  NumbersPreferences,
  PracticeHistory,
  PracticeSession,
  RoundState,
  SessionStats,
  StatsRecord,
} from '../lib/types'
import type { KanaPracticePatch, KanaPracticeSlice } from '../state/AppStateContext'

export interface HomePageProps {
  onOpenKana: () => void
  onOpenKanji: () => void
  onOpenNumbers: () => void
  onOpenVocab: () => void
  onOpenVocabTrain: () => void
}

export interface KanaTrainerProps {
  preferences: KanaPreferences
  stats: Record<string, StatsRecord>
  onPatchPreferences: (patch: Partial<KanaPreferences>) => void
  onPatchHyperparam: (key: keyof Hyperparams, value: number) => void
  onPracticeUpdate: (recipe: (slice: KanaPracticeSlice) => KanaPracticePatch) => void
}

export interface PracticePanelProps {
  activeCard: KanaCard | null
  feedback: FeedbackState
  inputMode?: InputMode
  inputRef: RefObject<HTMLInputElement | null>
  inputValue: string
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onRevealHint: () => void
  onStop: () => void
  round: RoundState
  sessionStats: SessionStats & { accuracy?: number }
  showScriptLabel?: boolean
}

export interface SetupPanelProps {
  errorText: string
  onApplyGroups: (groups: string[]) => void
  onPatchHyperparam: (key: keyof Hyperparams, value: number) => void
  onPatchPreferences: (patch: Partial<KanaPreferences>) => void
  onStart: () => void
  onToggleFineTuning: () => void
  onToggleGroup: (groupId: string) => void
  preferences: KanaPreferences
  showFineTuning: boolean
}

export interface SelectionRowProps {
  onToggle: (groupId: string) => void
  scriptMode: KanaPreferences['scriptMode']
  selectedGroups: string[]
  slot: string
}

export interface KanjiPageProps {
  kanjiState: { learned: string[]; preferences: KanjiPreferences }
  myWords: string[]
  onToggleLearned: (character: string) => void
  onPatchPreferences: (patch: Partial<KanjiPreferences>) => void
  onToggleMyWord: (wordId: string) => void
}

export interface KanjiTrainerProps {
  character: string
  learned: string[]
  complexityFilter: boolean
  myWords: string[]
  onPatchPreferences: (patch: Partial<KanjiPreferences>) => void
  onToggleLearned: (character: string) => void
  onToggleMyWord: (wordId: string) => void
  onBack: () => void
  onOpenInfo?: (character: string) => void
}

export interface KanjiInfoCardProps {
  character: string
  learned?: boolean
  myWords?: string[]
  onClose: () => void
  onToggleLearned?: (character: string) => void
  onToggleMyWord?: (wordId: string) => void
  onStartPractice?: (character: string) => void
}

export interface GlossFootnotesProps {
  meanings: string[]
  testId?: string
}

export interface HighlightedReadingProps {
  writing: string
  kana: string
  focusKanji: string
  fallbackRomaji?: string
  testId?: string
}

export interface NumbersTrainerProps {
  numbersState: { preferences: NumbersPreferences; stats: Record<string, StatsRecord> }
  onPatchPreferences: (patch: Partial<NumbersPreferences>) => void
  onUpdateStats: (
    cardId: string,
    outcome: 'correct' | 'wrong' | 'hint' | 'seen',
    context: { now: number; latencyMs?: number; mistakesOnCard?: number; hintUsed?: boolean; inputMode?: InputMode },
  ) => void
}

export interface CheatTableProps {
  headers: string[]
  rows: Array<{ key: string | number; cells: Array<string | number> }>
  testId: string
}

export interface StatsPageProps {
  kanaStats: Record<string, StatsRecord>
  kanaHistory: PracticeHistory
  kanaHyperparams: Hyperparams
  numbersStats: Record<string, StatsRecord>
}

export interface MetricCardProps {
  label: string
  value: string | number
  tip?: string
}

export interface ActivityChartProps {
  daily: PracticeHistory['daily']
  days?: number
}

export interface LatencySparklineProps {
  recent: PracticeHistory['recent']
}

export interface MasteryMapProps {
  groups: KanaGroup[]
  script: 'hiragana' | 'katakana'
  statsMap: Record<string, StatsRecord>
}

export interface AppHeaderProps {
  currentPage: import('../lib/types').AppPage
  onNavigate: (page: import('../lib/types').AppPage) => void
  onResetStats: () => void
}

export interface InfoTipProps {
  text: string
  align?: 'center' | 'start' | 'end'
}

export interface PracticeShellProps {
  onStop: () => void
  sessionStats: SessionStats & { accuracy?: number }
  feedbackType?: FeedbackState['type']
  className?: string
  stageClassName?: string
  children?: ReactNode
}

export interface SessionChipsProps {
  sessionStats: SessionStats & { accuracy?: number }
}

export type { PracticeSession }
