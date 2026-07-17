import type { SessionChipsProps } from '../../shared/lib/component-props'
import { InfoTip } from './InfoTip'

export function SessionChips({ sessionStats }: SessionChipsProps) {
  return (
    <div className="session-chips" data-testid="session-chips">
      <span className="session-chip">
        {sessionStats.answered} {pluralizeCards(sessionStats.answered)}
      </span>
      <span className="session-chip">
        {sessionStats.accuracy}% чисто{' '}
        <InfoTip align="end" text="Доля карточек этой сессии, отвеченных без единой ошибки и без подсказки." />
      </span>
      <span className="session-chip">
        серия {sessionStats.streak}{' '}
        <InfoTip align="end" text="Сколько карточек подряд отвечено чисто. Ошибка или подсказка обнуляет серию." />
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
