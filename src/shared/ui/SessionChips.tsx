import type { SessionStats } from '../lib/types'
import { InfoTip } from './InfoTip'

export interface SessionChipsProps {
  sessionStats: SessionStats & { accuracy?: number }
  unit?: 'cards' | 'sentences'
  compact?: boolean
}

export function SessionChips({ sessionStats, unit = 'cards', compact = false }: SessionChipsProps) {
  const unitLabel = unit === 'sentences' ? pluralizeSentences(sessionStats.answered) : pluralizeCards(sessionStats.answered)
  const unitGenitive = unit === 'sentences' ? 'предложений' : 'карточек'

  return (
    <div className={compact ? 'session-chips is-compact' : 'session-chips'} data-testid="session-chips">
      <span className="session-chip">
        {sessionStats.answered} {unitLabel}
      </span>
      <span className="session-chip">
        {sessionStats.accuracy}% чисто{' '}
        {!compact ? <InfoTip
          align="end"
          text={`Доля ${unitGenitive} этой сессии, отвеченных без единой ошибки и без подсказки.`}
        /> : null}
      </span>
      <span className="session-chip">
        серия {sessionStats.streak}{' '}
        {!compact ? <InfoTip
          align="end"
          text={`Сколько ${unitGenitive} подряд отвечено чисто. Ошибка или подсказка обнуляет серию.`}
        /> : null}
      </span>
    </div>
  )
}

function pluralizeCards(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) {
    return 'карточка'
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'карточки'
  }
  return 'карточек'
}

function pluralizeSentences(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) {
    return 'предложение'
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'предложения'
  }
  return 'предложений'
}
