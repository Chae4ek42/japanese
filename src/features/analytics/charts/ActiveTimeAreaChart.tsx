import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_COLORS, shortDayLabel } from '../chartTheme'

export function ActiveTimeAreaChart({
  data,
}: {
  data: Array<{ dayKey: string; minutes: number; answers: number }>
}) {
  const hasData = data.some((row) => row.minutes > 0 || row.answers > 0)
  if (!hasData) {
    return <p className="analytics-empty">Недостаточно данных за последние дни.</p>
  }

  return (
    <div className="analytics-chart" data-testid="analytics-chart-activity">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="dayKey"
            tickFormatter={shortDayLabel}
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="min"
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            width={36}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="ans"
            orientation="right"
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            labelFormatter={(label) => String(label)}
            formatter={(value, name) => [
              Number(value),
              name === 'minutes' ? 'Минуты' : 'Ответы',
            ]}
          />
          <Area
            yAxisId="min"
            type="monotone"
            dataKey="minutes"
            name="minutes"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            fillOpacity={0.18}
            strokeWidth={2}
          />
          <Line
            yAxisId="ans"
            type="monotone"
            dataKey="answers"
            name="answers"
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
