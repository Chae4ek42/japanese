import { KANA_GROUPS, KANA_STATS_CARDS, getCardById } from '../data/kana'
import { getCardProblemScore, getStatsStatus, getTopConfusions } from '../lib/trainer'
import { formatLatency } from '../lib/format'
import { ActivityChart, LatencySparkline, MasteryMap } from './charts'
import { InfoTip } from './InfoTip'

export function StatsPanel({ globalStats, history, hyperparams, onResetStats, stats }) {
  const totalCards = KANA_STATS_CARDS.length
  const now = Date.now()

  const hardCards = [...KANA_STATS_CARDS]
    .filter((card) => stats[card.id].exposures > 0)
    .sort(
      (left, right) =>
        getCardProblemScore(stats[right.id], hyperparams, now) -
        getCardProblemScore(stats[left.id], hyperparams, now),
    )
    .slice(0, 10)

  const confusions = getTopConfusions(history, 6)

  const progressItems = [
    {
      label: 'Точность',
      value: `${globalStats.accuracy}%`,
      percent: globalStats.accuracy,
      tip: 'Доля верных ответов среди всех событий: верные, ошибки и подсказки.',
    },
    {
      label: 'Мастерство',
      value: `${globalStats.mastery}%`,
      percent: globalStats.mastery,
      tip: 'Оценка того, насколько уверенно вы знаете знак: растет от верных ответов (быстрые дают больше), падает от ошибок и подсказок. Среднее по всем знакам.',
    },
    {
      label: 'Выучено',
      value: `${globalStats.retiredCount} / ${totalCards}`,
      percent: Math.round((globalStats.retiredCount / totalCards) * 100),
      tip: 'Знаки с длинной серией чистых ответов и высоким мастерством. Они выпадают реже, чтобы не тратить время.',
    },
  ]

  return (
    <main className="panel stats-panel">
      <div className="section-heading">
        <h2>Статистика</h2>
      </div>

      <div className="metric-grid">
        <MetricCard label="Верных ответов" value={globalStats.totalResolved} />
        <MetricCard label="Подсказок" value={globalStats.totalHints} />
        <MetricCard
          label="Среднее время"
          value={formatLatency(globalStats.avgLatencyMs)}
          tip="Среднее время от показа знака до верного ответа."
        />
        <MetricCard
          label="Лучшая серия"
          value={globalStats.bestStreak}
          tip="Самая длинная серия верных ответов подряд на один знак."
        />
      </div>

      <section className="stats-subsection">
        <div className="infographic-grid">
          {progressItems.map((item) => (
            <article key={item.label} className="infographic-card" data-testid={`progress-${item.label}`}>
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
      </section>

      <div className="charts-grid">
        <section className="stats-subsection chart-card">
          <div className="subsection-heading">
            <h3>Активность за 14 дней</h3>
          </div>
          <ActivityChart daily={history.daily} />
        </section>

        <section className="stats-subsection chart-card">
          <div className="subsection-heading">
            <h3>Скорость ответа</h3>
          </div>
          <LatencySparkline recent={history.recent} />
        </section>
      </div>

      <section className="stats-subsection">
        <div className="subsection-heading">
          <h3>Карта мастерства</h3>
          <p className="subsection-note">Чем насыщеннее клетка, тем увереннее знак. Серые еще не тренировались.</p>
        </div>
        <div className="mastery-maps">
          <div>
            <span className="mastery-map-label">Хирагана</span>
            <MasteryMap groups={KANA_GROUPS} script="hiragana" statsMap={stats} />
          </div>
          <div>
            <span className="mastery-map-label">Катакана</span>
            <MasteryMap groups={KANA_GROUPS} script="katakana" statsMap={stats} />
          </div>
        </div>
      </section>

      {confusions.length ? (
        <section className="stats-subsection" data-testid="confusion-list">
          <div className="subsection-heading">
            <h3>Что вы путаете</h3>
            <p className="subsection-note">Знак, на котором ошиблись, и ответ, который вы вводили вместо него.</p>
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

      <section className="stats-subsection">
        <div className="subsection-heading">
          <h3>Проблемные карточки</h3>
        </div>

        {hardCards.length ? (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Символ</th>
                  <th>Ответ</th>
                  <th>
                    Точность <InfoTip text="Доля верных ответов среди всех событий по этому знаку." />
                  </th>
                  <th>
                    Мастерство <InfoTip text="Уверенность по знаку: растет от верных ответов, падает от ошибок и подсказок." />
                  </th>
                  <th>
                    Время <InfoTip text="Среднее время до верного ответа на этот знак." />
                  </th>
                  <th>
                    Статус <InfoTip align="end" text="«Нужно добить» — знак западает; «В процессе» — тренируется; «Стабильно» — выучен." />
                  </th>
                </tr>
              </thead>
              <tbody>
                {hardCards.map((card) => {
                  const cardStats = stats[card.id]
                  return (
                    <tr key={card.id}>
                      <td className="kana-cell">{card.symbol}</td>
                      <td>{card.primaryAnswer}</td>
                      <td>{cardStats.eventAccuracy}%</td>
                      <td>{Math.round(cardStats.mastery * 100)}%</td>
                      <td>{formatLatency(cardStats.avgLatencyMs)}</td>
                      <td>{getStatsStatus(cardStats, hyperparams)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="chart-empty">Пока нет тренированных карточек.</div>
        )}
      </section>

      <div className="footer-actions">
        <button type="button" className="ghost-button danger" onClick={onResetStats}>
          Сбросить всю статистику
        </button>
      </div>
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
