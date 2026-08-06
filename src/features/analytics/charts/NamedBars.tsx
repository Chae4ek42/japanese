import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_COLORS } from '../chartTheme'

export function NamedBars({
  data,
  title,
  color = CHART_COLORS.primary,
  layout = 'horizontal',
  testId,
  emptyText = 'Недостаточно данных.',
}: {
  data: Array<{ name: string; count: number }>
  title: string
  color?: string
  layout?: 'horizontal' | 'vertical'
  testId?: string
  emptyText?: string
}) {
  if (!data.some((row) => row.count > 0)) {
    return <p className="analytics-empty">{emptyText}</p>
  }

  const vertical = layout === 'vertical'

  return (
    <div className="analytics-chart" data-testid={testId}>
      <h4 className="analytics-chart-title">{title}</h4>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          layout={vertical ? 'vertical' : 'horizontal'}
          margin={{ left: vertical ? 8 : 0, right: 8 }}
        >
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={!vertical} horizontal={vertical} />
          {vertical ? (
            <>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11 }} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
            </>
          )}
          <Tooltip />
          <Bar dataKey="count" fill={color} radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
