import { getDayKey } from '../lib/trainer'
import { formatLatency } from '../lib/format'

const DAY_MS = 86_400_000

export function ActivityChart({ daily, days = 14 }) {
  const now = Date.now()
  const items = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayTs = now - offset * DAY_MS
    const key = getDayKey(dayTs)
    const record = daily[key]
    items.push({
      key,
      label: new Date(dayTs).getDate(),
      clears: record?.clears ?? 0,
      misses: (record?.errors ?? 0) + (record?.hints ?? 0),
    })
  }

  const maxTotal = Math.max(...items.map((item) => item.clears + item.misses), 1)
  const hasData = items.some((item) => item.clears + item.misses > 0)

  if (!hasData) {
    return <div className="chart-empty">Начните тренировку — здесь появится активность по дням.</div>
  }

  const width = 280
  const height = 96
  const gap = 4
  const barWidth = (width - gap * (items.length - 1)) / items.length

  return (
    <div className="chart-block" data-testid="activity-chart">
      <svg viewBox={`0 0 ${width} ${height + 16}`} role="img" aria-label="Ответы по дням">
        {items.map((item, index) => {
          const total = item.clears + item.misses
          const x = index * (barWidth + gap)
          const clearHeight = (item.clears / maxTotal) * height
          const missHeight = (item.misses / maxTotal) * height
          return (
            <g key={item.key}>
              {total === 0 ? (
                <rect x={x} y={height - 2} width={barWidth} height={2} rx={1} fill="#ececec" />
              ) : (
                <>
                  <rect
                    x={x}
                    y={height - missHeight}
                    width={barWidth}
                    height={missHeight}
                    rx={2}
                    fill="var(--chart-miss)"
                  />
                  <rect
                    x={x}
                    y={height - missHeight - clearHeight}
                    width={barWidth}
                    height={clearHeight}
                    rx={2}
                    fill="var(--chart-main)"
                  />
                </>
              )}
              {index % 2 === 0 ? (
                <text x={x + barWidth / 2} y={height + 12} textAnchor="middle" className="chart-axis-label">
                  {item.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        <span><i className="legend-dot legend-main" /> верные</span>
        <span><i className="legend-dot legend-miss" /> ошибки и подсказки</span>
      </div>
    </div>
  )
}

export function LatencySparkline({ recent }) {
  if (recent.length < 2) {
    return <div className="chart-empty">После нескольких верных ответов здесь появится тренд скорости.</div>
  }

  const width = 280
  const height = 72
  const values = recent.map((entry) => entry.l)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const range = Math.max(maxValue - minValue, 1)
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - minValue) / range) * (height - 8) - 4
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const lastTen = values.slice(-10)
  const avgRecent = Math.round(lastTen.reduce((sum, value) => sum + value, 0) / lastTen.length)

  return (
    <div className="chart-block" data-testid="latency-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Время ответа">
        <polyline points={points} fill="none" stroke="var(--chart-main)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div className="chart-legend">
        <span>последние {values.length} верных</span>
        <span>сейчас ~{formatLatency(avgRecent)}</span>
      </div>
    </div>
  )
}

export function MasteryMap({ groups, script, statsMap }) {
  return (
    <div className="mastery-map" data-testid={`mastery-map-${script}`}>
      {groups.map((group) => (
        <div key={group.id} className="mastery-column">
          {group.entries.map((entry) => {
            const cardId = `${script}:${entry.baseId}`
            const stats = statsMap[cardId]
            const mastery = stats?.mastery ?? 0
            const untouched = !stats || stats.exposures === 0
            return (
              <span
                key={cardId}
                className={untouched ? 'mastery-cell is-untouched' : 'mastery-cell'}
                style={untouched ? undefined : { '--mastery': mastery }}
                title={`${script === 'hiragana' ? entry.hiragana : entry.katakana} · ${entry.primaryAnswer} · ${Math.round(mastery * 100)}%`}
              >
                {script === 'hiragana' ? entry.hiragana : entry.katakana}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
