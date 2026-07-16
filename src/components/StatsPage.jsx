import { useMemo } from 'react'
import { KANA_GROUPS, KANA_STATS_CARDS, getCardById } from '../data/kana'
import { createNumberCard, formatAgePrompt, NUMBER_HYPERPARAMS } from '../data/numbers'
import { formatLatency } from '../lib/format'
import {
  getCardProblemScore,
  getGlobalStats,
  getStatsStatus,
  getTopConfusions,
} from '../lib/trainer'
import { ActivityChart, LatencySparkline, MasteryMap } from './charts'
import { InfoTip } from './InfoTip'

export function StatsPage({ kanaStats, kanaHistory, kanaHyperparams, numbersStats }) {
  const now = Date.now()
  const kanaGlobal = useMemo(
    () => getGlobalStats(KANA_STATS_CARDS, kanaStats, kanaHyperparams),
    [kanaStats, kanaHyperparams],
  )

  const hardKanaCards = useMemo(
    () =>
      [...KANA_STATS_CARDS]
        .filter((card) => kanaStats[card.id].exposures > 0)
        .sort(
          (left, right) =>
            getCardProblemScore(kanaStats[right.id], kanaHyperparams, now) -
            getCardProblemScore(kanaStats[left.id], kanaHyperparams, now),
        )
        .slice(0, 10),
    [kanaStats, kanaHyperparams, now],
  )

  const confusions = getTopConfusions(kanaHistory, 6)

  const practicedNumberCards = useMemo(() => {
    return Object.keys(numbersStats)
      .filter((cardId) => numbersStats[cardId].exposures > 0)
      .map((cardId) => {
        const [mode, rawValue] = cardId.split(':')
        const value = Number(rawValue)
        if (!mode || Number.isNaN(value)) {
          return { id: cardId, label: cardId }
        }
        try {
          const card = createNumberCard(value, mode)
          return { id: cardId, label: card.symbol, reading: card.romaji }
        } catch {
          return {
            id: cardId,
            label: mode === 'age' ? formatAgePrompt(value) : String(value),
          }
        }
      })
  }, [numbersStats])

  const numbersGlobal = useMemo(() => {
    if (!practicedNumberCards.length) {
      return null
    }
    return getGlobalStats(
      practicedNumberCards.map((card) => ({ id: card.id })),
      numbersStats,
      NUMBER_HYPERPARAMS,
    )
  }, [practicedNumberCards, numbersStats])

  const hardNumberCards = useMemo(
    () =>
      [...practicedNumberCards]
        .sort(
          (left, right) =>
            getCardProblemScore(numbersStats[right.id], NUMBER_HYPERPARAMS, now) -
            getCardProblemScore(numbersStats[left.id], NUMBER_HYPERPARAMS, now),
        )
        .slice(0, 10),
    [practicedNumberCards, numbersStats, now],
  )

  const kanaProgressItems = [
    {
      label: 'Точность',
      value: `${kanaGlobal.accuracy}%`,
      percent: kanaGlobal.accuracy,
      tip: 'Доля верных ответов среди всех событий: верные, ошибки и подсказки.',
    },
    {
      label: 'Мастерство',
      value: `${kanaGlobal.mastery}%`,
      percent: kanaGlobal.mastery,
      tip: 'Средняя уверенность по всем знакам каны.',
    },
    {
      label: 'Стабильно',
      value: `${kanaGlobal.retiredCount} / ${KANA_STATS_CARDS.length}`,
      percent: Math.round((kanaGlobal.retiredCount / KANA_STATS_CARDS.length) * 100),
      tip: 'Знаки с длинной серией чистых ответов и высоким мастерством.',
    },
  ]

  return (
    <main className="stats-page">
      <section className="panel stats-panel" data-testid="stats-page">
        <div className="section-heading">
          <h2>Статистика</h2>
        </div>

        <section className="stats-subsection">
          <div className="subsection-heading">
            <h3>Кана</h3>
          </div>

          <div className="metric-grid">
            <MetricCard label="Верных ответов" value={kanaGlobal.totalResolved} />
            <MetricCard label="Подсказок" value={kanaGlobal.totalHints} />
            <MetricCard
              label="Среднее время"
              value={formatLatency(kanaGlobal.avgLatencyMs)}
              tip="Среднее время от показа знака до верного ответа."
            />
            <MetricCard
              label="Лучшая серия"
              value={kanaGlobal.bestStreak}
              tip="Самая длинная серия верных ответов подряд на один знак."
            />
          </div>

          <div className="infographic-grid">
            {kanaProgressItems.map((item) => (
              <article key={item.label} className="infographic-card" data-testid={`kana-progress-${item.label}`}>
                <div className="infographic-head">
                  <span>
                    {item.label} <InfoTip text={item.tip} />
                  </span>
                  <strong>{item.value}</strong>
                </div>
                <div className="infographic-track" aria-hidden="true">
                  <div className="infographic-fill" style={{ width: `${item.percent}%` }} />
                </div>
              </article>
            ))}
          </div>

          <div className="charts-grid">
            <section className="chart-card">
              <div className="subsection-heading">
                <h4>Активность за 14 дней</h4>
              </div>
              <ActivityChart daily={kanaHistory.daily} />
            </section>

            <section className="chart-card">
              <div className="subsection-heading">
                <h4>Скорость ответа</h4>
              </div>
              <LatencySparkline recent={kanaHistory.recent} />
            </section>
          </div>

          <div className="subsection-heading">
            <h4>Карта мастерства</h4>
            <p className="subsection-note">Чем насыщеннее клетка, тем увереннее знак.</p>
          </div>
          <div className="mastery-maps">
            <div>
              <span className="mastery-map-label">Хирагана</span>
              <MasteryMap groups={KANA_GROUPS} script="hiragana" statsMap={kanaStats} />
            </div>
            <div>
              <span className="mastery-map-label">Катакана</span>
              <MasteryMap groups={KANA_GROUPS} script="katakana" statsMap={kanaStats} />
            </div>
          </div>

          {confusions.length ? (
            <section data-testid="confusion-list">
              <div className="subsection-heading">
                <h4>Что вы путаете</h4>
              </div>
              <div className="confusion-grid">
                {confusions.map((entry) => {
                  const fromCard = getCardById(entry.fromId)
                  const toCard = getCardById(entry.toId)
                  if (!fromCard || !toCard) {
                    return null
                  }
                  return (
                    <article key={`${entry.fromId}-${entry.toId}`} className="confusion-card">
                      <span className="confusion-pair">
                        <strong>{fromCard.symbol}</strong>
                        <i aria-hidden="true">→</i>
                        <strong>{toCard.symbol}</strong>
                      </span>
                      <span className="confusion-meta">
                        вместо {fromCard.primaryAnswer} вводили {toCard.primaryAnswer} · ×{entry.count}
                      </span>
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}

          {hardKanaCards.length ? (
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Символ</th>
                    <th>Ответ</th>
                    <th>Точность</th>
                    <th>Мастерство</th>
                    <th>Время</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {hardKanaCards.map((card) => {
                    const cardStats = kanaStats[card.id]
                    return (
                      <tr key={card.id}>
                        <td className="kana-cell">{card.symbol}</td>
                        <td>{card.primaryAnswer}</td>
                        <td>{cardStats.eventAccuracy}%</td>
                        <td>{Math.round(cardStats.mastery * 100)}%</td>
                        <td>{formatLatency(cardStats.avgLatencyMs)}</td>
                        <td>{getStatsStatus(cardStats, kanaHyperparams)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="chart-empty">Пока нет тренированных знаков каны.</div>
          )}
        </section>

        <section className="stats-subsection" data-testid="numbers-stats">
          <div className="subsection-heading">
            <h3>Числа и возраст</h3>
          </div>

          {numbersGlobal ? (
            <>
              <div className="metric-grid">
                <MetricCard label="Верных ответов" value={numbersGlobal.totalResolved} />
                <MetricCard label="Подсказок" value={numbersGlobal.totalHints} />
                <MetricCard label="Точность" value={`${numbersGlobal.accuracy}%`} />
                <MetricCard
                  label="Среднее время"
                  value={formatLatency(numbersGlobal.avgLatencyMs)}
                />
              </div>

              {hardNumberCards.length ? (
                <div className="table-shell">
                  <table>
                    <thead>
                      <tr>
                        <th>Задание</th>
                        <th>Чтение</th>
                        <th>Точность</th>
                        <th>Мастерство</th>
                        <th>Время</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hardNumberCards.map((card) => {
                        const cardStats = numbersStats[card.id]
                        return (
                          <tr key={card.id}>
                            <td>{card.label}</td>
                            <td>{card.reading ?? '—'}</td>
                            <td>{cardStats.eventAccuracy}%</td>
                            <td>{Math.round(cardStats.mastery * 100)}%</td>
                            <td>{formatLatency(cardStats.avgLatencyMs)}</td>
                            <td>{getStatsStatus(cardStats, NUMBER_HYPERPARAMS)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : (
            <div className="chart-empty">Пока нет тренированных чисел.</div>
          )}
        </section>
      </section>
    </main>
  )
}

function MetricCard({ label, value, tip }) {
  return (
    <article className="metric-card" data-testid={`metric-${label}`}>
      <span>
        {label}
        {tip ? <> <InfoTip text={tip} /></> : null}
      </span>
      <strong>{value}</strong>
    </article>
  )
}
