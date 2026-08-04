import type { SessionStats } from '../lib/types'
import { InfoTip } from './InfoTip'

export interface SessionChipsProps {
  sessionStats: SessionStats & { accuracy?: number }
  unit?: 'cards' | 'sentences'
}

export function SessionChips({ sessionStats, unit = 'cards' }: SessionChipsProps) {
  const unitLabel = unit === 'sentences' ? pluralizeSentences(sessionStats.answered) : pluralizeCards(sessionStats.answered)
  const unitGenitive = unit === 'sentences' ? 'предложений' : 'карточек'

  return (
    <div className="session-chips" data-testid="session-chips">
      <span className="session-chip">
        {sessionStats.answered} {unitLabel}
      </span>
      <span className="session-chip">
        {sessionStats.accuracy}% чисто{' '}
        <InfoTip
          align="end"
          text={`Доля ${unitGenitive} этой сессии, отвеченных без единой ошибки и без подсказки.`}
        />
      </span>
      <span className="session-chip">
        серия {sessionStats.streak}{' '}
        <InfoTip
          align="end"
          text={`Сколько ${unitGenitive} подряд отвечено чисто. Ошибка или подсказка обнуляет серию.`}
        />
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
