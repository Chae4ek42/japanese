import { useMemo, useState } from 'react'
import { useAppState } from '../../shared/state/AppStateContext'
import type { AppPage } from '../../shared/lib/types'
import { requestTargetedPractice, type PracticeSection } from '../../shared/lib/targetedPractice'
import { collectMistakes, filterMistakes, JOURNAL_SECTIONS, type JournalPeriod, type MistakeEntry } from './journal'
import { requestTheoryLesson } from '../theory/theoryNavigation'
import './styles.css'

function dateLabel(timestamp: number): string {
  return timestamp ? new Date(timestamp).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }) : 'Дата не сохранена'
}

export function MistakesPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const state = useAppState()
  const [section, setSection] = useState<PracticeSection | 'all'>('all')
  const [period, setPeriod] = useState<JournalPeriod>('30')
  const entries = useMemo(() => state ? collectMistakes(state) : [], [state])
  const visible = filterMistakes(entries, section, period, Date.now())

  function practice(entry: MistakeEntry) {
    requestTargetedPractice({ section: entry.section, cardIds: [entry.cardId, ...(entry.confusion ? [entry.confusion.cardId] : [])] })
    onNavigate(entry.section === 'vocab' ? 'train' : entry.section)
  }

  function reference(entry: MistakeEntry) {
    if (entry.section === 'particles' || entry.section === 'verbs') requestTheoryLesson(entry.section)
    onNavigate(entry.section === 'vocab' ? 'vocab' : 'theory')
  }

  return <section className="mistakes-page" data-testid="mistakes-page">
    <header className="mistakes-heading">
      <span className="mistakes-eyebrow">Повторение с опорой на практику</span>
      <h1>Журнал ошибок</h1>
      <p>Карточки, в которых возникали ошибки или требовалась подсказка. Выберите одну и закрепите её в короткой тренировке.</p>
    </header>
    <div className="mistakes-summary" aria-label="Сводка журнала">
      <div><strong>{entries.length}</strong><span>карточек с трудностями</span></div>
      <div><strong>{entries.reduce((sum, entry) => sum + entry.recentErrors, 0)}</strong><span>ошибок в последних ответах</span></div>
      <div><strong>{new Set(entries.map((entry) => entry.section)).size}</strong><span>разделов для повторения</span></div>
    </div>
    <div className="mistakes-filters">
      <label>Раздел<select value={section} onChange={(event) => setSection(event.target.value as PracticeSection | 'all')} data-testid="mistakes-section-filter">
        <option value="all">Все разделы</option>
        {Object.entries(JOURNAL_SECTIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <label>Последняя трудность<select value={period} onChange={(event) => setPeriod(event.target.value as JournalPeriod)} data-testid="mistakes-period-filter">
        <option value="7">За 7 дней</option><option value="30">За 30 дней</option><option value="all">За всё время</option>
      </select></label>
      <span className="mistakes-count" aria-live="polite">Карточек: {visible.length}</span>
    </div>
    <p className="mistakes-data-note">Это сводка по карточкам, а не история отдельных ответов. Счётчики накоплены за всё время; фильтр учитывает дату последней ошибки или подсказки. Последние ответы — до 15 на карточку. Подсказка показана отдельно от ошибки.</p>
    {!visible.length ? <div className="mistakes-empty" data-testid="mistakes-empty">
      <h2>{entries.length ? 'В выбранном периоде ничего нет' : 'Здесь появятся трудные карточки'}</h2>
      <p>{entries.length ? 'Выберите другой раздел или период «За всё время». Старые карточки без даты доступны там же.' : 'После тренировки журнал соберёт сохранённые ошибки и подсказки из каны, слов, чисел, частиц и глаголов.'}</p>
      {!entries.length && <button type="button" className="primary-button" onClick={() => onNavigate('train')}>Перейти к словам</button>}
    </div> : <div className="mistakes-list">
      {visible.map((entry) => <article className="mistake-card" key={entry.id} data-testid="mistake-card">
        <div className="mistake-card-top"><span className="mistake-section">{JOURNAL_SECTIONS[entry.section]}</span><time>{dateLabel(entry.lastDifficultyAt)}</time></div>
        <h2 lang="ja">{entry.title}</h2>
        <p className="mistake-answer"><span>Правильный ответ</span>{entry.answer}</p>
        <p className="mistake-detail">{entry.detail}</p>
        {entry.confusion && <p className="mistake-confusion">Путаница с {entry.confusion.label}: {entry.confusion.count} раз за всё время. Дата каждой путаницы не сохранена.</p>}
        <div className="mistake-stats">
          <span>Ошибки <strong>{entry.stats.errors}</strong></span><span>Подсказки <strong>{entry.stats.hints}</strong></span>
          <span>Верные ответы <strong>{entry.stats.clears}</strong></span><span>Показы <strong>{entry.stats.exposures}</strong></span>
          <span>Попытки ответа <strong>{entry.stats.wordPractice?.attempts ?? entry.stats.clears + entry.stats.errors}</strong></span>
          {entry.stats.recentAnswers?.length ? <span>Последние ответы <strong>{entry.recentErrors} ошибок / {entry.stats.recentAnswers.length}</strong></span> : null}
        </div>
        <details className="mistake-dates"><summary>Даты и прогресс</summary><p>Последняя ошибка: {dateLabel(entry.stats.lastErrorAt)}<br/>Последняя подсказка: {dateLabel(entry.stats.lastHintAt)}<br/>Текущая серия: {entry.stats.streak}. Лучшая: {entry.stats.bestStreak}.</p></details>
        <div className="mistake-actions">
          <button type="button" className="primary-button" onClick={() => practice(entry)}>Потренировать{entry.confusion ? ' пару' : ''}</button>
          <button type="button" className="text-button" onClick={() => reference(entry)}>{entry.section === 'vocab' ? 'Открыть словарь' : 'Теория и справка'}</button>
        </div>
      </article>)}
    </div>}
  </section>
}
