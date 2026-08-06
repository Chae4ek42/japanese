import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_COLORS } from '../chartTheme'

const PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.learning,
  CHART_COLORS.strong,
  CHART_COLORS.accent,
  CHART_COLORS.weak,
  CHART_COLORS.muted,
]

export function SimplePie({
  data,
  title,
  testId,
}: {
  data: Array<{ name: string; value: number }>
  title: string
  testId?: string
}) {
  if (!data.some((row) => row.value > 0)) {
    return <p className="analytics-empty">Недостаточно данных.</p>
  }

  return (
    <div className="analytics-chart" data-testid={testId}>
      <h4 className="analytics-chart-title">{title}</h4>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={88}>
            {data.map((row, index) => (
              <Cell key={row.name} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
