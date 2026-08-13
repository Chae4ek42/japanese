import { useState, type ReactNode } from 'react'
import { PARTICLES_CHEAT_SHEET, VERB_FORMS_CHEAT_SHEET } from '../../data/cheatSheets'
import {
  CheatSheetActions,
  CheatSheetPopup,
  CheatSheetTrigger,
} from './CheatSheetPopup'

export type CheatSheetKind = 'particles' | 'verbs'

export function useCheatSheets() {
  const [sheet, setSheet] = useState<CheatSheetKind | null>(null)
  const [topicId, setTopicId] = useState<string | null>(null)

  function open(kind: CheatSheetKind, topic?: string | null) {
    setTopicId(topic ?? null)
    setSheet(kind)
  }

  function close() {
    setSheet(null)
    setTopicId(null)
  }

  return { sheet, topicId, open, close }
}

export type CheatSheetsState = ReturnType<typeof useCheatSheets>

const LABELS: Record<CheatSheetKind, string> = {
  particles: 'Шпаргалка: частицы',
  verbs: 'Шпаргалка: глаголы',
}

function triggerTestId(prefix: string, kind: CheatSheetKind): string {
  const suffix = kind === 'particles' ? 'open-particles-cheatsheet' : 'open-verbs-cheatsheet'
  return prefix ? `${prefix}-${suffix}` : suffix
}

export function CheatSheetTriggers({
  state,
  testIdPrefix,
  sheets = ['particles', 'verbs'],
  extra,
  wrap = true,
}: {
  state: CheatSheetsState
  testIdPrefix: string
  sheets?: CheatSheetKind[]
  extra?: ReactNode
  wrap?: boolean
}) {
  const buttons = (
    <>
      {sheets.map((kind) => (
        <CheatSheetTrigger
          key={kind}
          label={sheets.length === 1 ? 'Шпаргалка' : LABELS[kind]}
          testId={triggerTestId(testIdPrefix, kind)}
          onClick={() => state.open(kind)}
        />
      ))}
      {extra}
    </>
  )
  if (!wrap) return buttons
  return <CheatSheetActions>{buttons}</CheatSheetActions>
}

export function CheatSheetPopups({ state }: { state: CheatSheetsState }) {
  if (state.sheet === 'particles') {
    return (
      <CheatSheetPopup
        doc={PARTICLES_CHEAT_SHEET}
        initialTopicId={state.topicId}
        onClose={state.close}
      />
    )
  }
  if (state.sheet === 'verbs') {
    return <CheatSheetPopup doc={VERB_FORMS_CHEAT_SHEET} onClose={state.close} />
  }
  return null
}

/** Triggers + popups for pages that only need the two standard sheets. */
export function CheatSheetsBar({
  testIdPrefix,
  sheets = ['particles', 'verbs'],
  extra,
  state,
}: {
  testIdPrefix: string
  sheets?: CheatSheetKind[]
  extra?: ReactNode
  state?: CheatSheetsState
}) {
  const internal = useCheatSheets()
  const ui = state ?? internal
  return (
    <>
      <CheatSheetTriggers state={ui} testIdPrefix={testIdPrefix} sheets={sheets} extra={extra} />
      <CheatSheetPopups state={ui} />
    </>
  )
}
