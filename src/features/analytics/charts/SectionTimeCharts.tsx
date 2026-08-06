import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalyticsSection } from '../../../shared/lib/types'
import { ANALYTICS_SECTIONS } from '../../../shared/state/slices/analytics'
import { CHART_COLORS, SECTION_COLORS, SECTION_LABELS, formatDurationMs, shortDayLabel } from '../chartTheme'

export function SectionTimeCharts({
  sections,
  stacked,
}: {
  sections: Array<{ section: AnalyticsSection; name: string; ms: number; minutes: number }>
  stacked: Array<Record<string, string | number>>
}) {
  if (!sections.length) {
    return <p className="analytics-empty">Времени по разделам пока нет.</p>
  }

  return (
    <div className="analytics-charts-grid" data-testid="analytics-chart-sections">
      <div className="analytics-chart">
        <h4 className="analytics-chart-title">Доли по разделам</h4>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={sections}
              dataKey="minutes"
              nameKey="name"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
            >
              {sections.map((row) => (
                <Cell key={row.section} fill={SECTION_COLORS[row.section]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, item) => [
                `${value} мин · ${formatDurationMs(Number(item?.payload?.ms ?? 0))}`,
                item?.payload?.name ?? '',
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="analytics-chart">
        <h4 className="analytics-chart-title">Минуты по разделам</h4>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={sections} layout="vertical" margin={{ left: 12, right: 12 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [`${value} мин`, 'Активно']} />
            <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
              {sections.map((row) => (
                <Cell key={row.section} fill={SECTION_COLORS[row.section]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="analytics-chart analytics-chart-wide">
        <h4 className="analytics-chart-title">Разделы по дням (14 дней)</h4>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stacked} margin={{ left: 0, right: 8 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="dayKey" tickFormatter={shortDayLabel} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
            <Tooltip labelFormatter={(label) => String(label)} />
            <Legend />
            {ANALYTICS_SECTIONS.map((section) => (
              <Bar
                key={section}
                dataKey={section}
                name={SECTION_LABELS[section]}
                stackId="sections"
                fill={SECTION_COLORS[section]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
