import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_COLORS } from '../chartTheme'

const COLORS = [CHART_COLORS.weak, CHART_COLORS.learning, CHART_COLORS.strong, CHART_COLORS.muted]

export function MasteryPie({
  mastery,
  title = 'Mastery',
  testId,
}: {
  mastery: { weak: number; learning: number; strong: number; untouched?: number }
  title?: string
  testId?: string
}) {
  const data = [
    { name: 'Слабо', value: mastery.weak },
    { name: 'Учится', value: mastery.learning },
    { name: 'Уверенно', value: mastery.strong },
    ...(mastery.untouched ? [{ name: 'Не трогали', value: mastery.untouched }] : []),
  ].filter((row) => row.value > 0)

  if (!data.length) {
    return <p className="analytics-empty">Нет карточек со статистикой.</p>
  }

  return (
    <div className="analytics-chart" data-testid={testId}>
      <h4 className="analytics-chart-title">{title}</h4>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={88}>
            {data.map((row, index) => (
              <Cell key={row.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
