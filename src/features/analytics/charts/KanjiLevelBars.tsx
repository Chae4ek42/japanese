import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_COLORS } from '../chartTheme'

export function KanjiLevelBars({
  byLevel,
}: {
  byLevel: Array<{ name: string; learned: number; remaining: number }>
}) {
  if (!byLevel.some((row) => row.learned + row.remaining > 0)) {
    return <p className="analytics-empty">Банк кандзи пуст.</p>
  }

  return (
    <div className="analytics-chart" data-testid="analytics-chart-kanji">
      <h4 className="analytics-chart-title">Кандзи по JLPT</h4>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={byLevel}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
          <Tooltip />
          <Legend />
          <Bar dataKey="learned" name="Выучено" stackId="k" fill={CHART_COLORS.strong} />
          <Bar dataKey="remaining" name="Осталось" stackId="k" fill={CHART_COLORS.muted} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
