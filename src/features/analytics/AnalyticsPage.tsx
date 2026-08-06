import { useMemo } from 'react'
import { useAppState } from '../../shared/state/AppStateContext'
import { buildAnalyticsViewModel } from './analyticsAggregates'
import { formatDurationMs } from './chartTheme'
import { ActiveTimeAreaChart } from './charts/ActiveTimeAreaChart'
import { KanjiLevelBars } from './charts/KanjiLevelBars'
import { MasteryPie } from './charts/MasteryPie'
import { NamedBars } from './charts/NamedBars'
import { SectionTimeCharts } from './charts/SectionTimeCharts'
import { SimplePie } from './charts/SimplePie'
import { CHART_COLORS } from './chartTheme'
import './styles.css'

export function AnalyticsPage() {
  const appState = useAppState()
  const model = useMemo(
    () => (appState ? buildAnalyticsViewModel(appState) : null),
    [appState],
  )

  if (!appState || !model) return null

  return (
    <main className="analytics-page" data-testid="analytics-page">
      <section className="page-surface analytics-surface">
        <header className="analytics-hero">
          <div>
            <h2>Аналитика</h2>
            <p className="subsection-note">
              Активное время (без простоя) и прогресс по разделам. Глобальная статистика карточек
              сохраняется отдельно.
            </p>
          </div>
        </header>

        <section className="analytics-section" data-testid="analytics-overview">
          <h3>Обзор</h3>
          <div className="analytics-kpi-row">
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Сегодня</span>
              <strong>{formatDurationMs(model.overview.todayMs)}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">7 дней</span>
              <strong>{formatDurationMs(model.overview.weekMs)}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Всего</span>
              <strong>{formatDurationMs(model.overview.lifetimeMs)}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Серия дней</span>
              <strong>{model.overview.streak}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Ответов сегодня</span>
              <strong>{model.overview.todayAnswers}</strong>
            </article>
          </div>
          <ActiveTimeAreaChart data={model.activity} />
        </section>

        <section className="analytics-section" data-testid="analytics-time">
          <h3>Время по разделам</h3>
          <SectionTimeCharts sections={model.sections} stacked={model.stacked} />
        </section>

        <section className="analytics-section" data-testid="analytics-vocab">
          <h3>Слова</h3>
          <div className="analytics-kpi-row">
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Точность</span>
              <strong>{model.vocab.accuracy == null ? '—' : `${model.vocab.accuracy}%`}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Мои</span>
              <strong>{model.vocab.myWords}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Выученные</span>
              <strong>{model.vocab.learned}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Проблемные</span>
              <strong>{model.vocab.problem}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Новых сегодня</span>
              <strong>{model.vocab.newToday}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Due сейчас</span>
              <strong>{model.vocab.memory.counts.due}</strong>
            </article>
          </div>
          <div className="analytics-charts-grid">
            <MasteryPie mastery={model.vocab.mastery} title="Mastery слов" testId="analytics-chart-vocab-mastery" />
            <NamedBars
              data={model.vocab.accuracyBuckets}
              title="Точность по карточкам"
              testId="analytics-chart-vocab-accuracy"
            />
            <SimplePie
              data={model.vocab.memory.pie}
              title="SRS-состояния"
              testId="analytics-chart-vocab-srs"
            />
          </div>
        </section>

        <section className="analytics-section" data-testid="analytics-kanji">
          <h3>Кандзи</h3>
          <div className="analytics-kpi-row">
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Выучено</span>
              <strong>
                {model.kanji.totalLearned} / {model.kanji.bankTotal}
              </strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Jōyō</span>
              <strong>
                {model.kanji.joyo.learned} / {model.kanji.joyo.total}
              </strong>
            </article>
          </div>
          <KanjiLevelBars byLevel={model.kanji.byLevel} />
        </section>

        <section className="analytics-section" data-testid="analytics-kana">
          <h3>Кана</h3>
          <div className="analytics-kpi-row">
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Точность</span>
              <strong>{model.kana.accuracy == null ? '—' : `${model.kana.accuracy}%`}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Затронуто</span>
              <strong>{model.kana.touched}</strong>
            </article>
          </div>
          <div className="analytics-charts-grid">
            <MasteryPie mastery={model.kana.mastery} title="Mastery каны" testId="analytics-chart-kana-mastery" />
            <NamedBars
              data={model.kana.confusions}
              title="Частые путаницы"
              layout="vertical"
              color={CHART_COLORS.accent}
              testId="analytics-chart-kana-confusions"
              emptyText="Путаниц пока нет."
            />
          </div>
        </section>

        <section className="analytics-section" data-testid="analytics-numbers-context">
          <h3>Числа и контекст</h3>
          <div className="analytics-kpi-row">
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Числа · точность</span>
              <strong>{model.numbers.accuracy == null ? '—' : `${model.numbers.accuracy}%`}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Контекст · слова</span>
              <strong>{model.context.knownWords}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Контекст · грамматика</span>
              <strong>{model.context.knownGrammar}</strong>
            </article>
            <article className="analytics-kpi">
              <span className="analytics-kpi-label">Сессий контекста</span>
              <strong>{model.context.logEntries}</strong>
            </article>
          </div>
          <NamedBars
            data={model.numbers.clearsVsErrors}
            title="Числа: исходы"
            color={CHART_COLORS.secondary}
            testId="analytics-chart-numbers"
          />
        </section>

        <section className="analytics-section" data-testid="analytics-history">
          <h3>История (14 дней)</h3>
          {model.historyRows.length ? (
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>День</th>
                    <th>Активно</th>
                    <th>Ответы</th>
                    <th>Чисто</th>
                  </tr>
                </thead>
                <tbody>
                  {model.historyRows.map((row) => (
                    <tr key={row.dayKey}>
                      <td>{row.dayKey}</td>
                      <td>{formatDurationMs(row.totalActiveMs)}</td>
                      <td>{row.answers ?? 0}</td>
                      <td>{row.cleanAnswers ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="analytics-empty">Пока нет дневной истории.</p>
          )}
        </section>
      </section>
    </main>
  )
}
