import { useMemo, useState } from 'react'
import { useAppState, useVocabState } from '../../shared/state/AppStateContext'
import type { AppPage } from '../../shared/lib/types'
import { collectMistakes } from './journal'
import './styles.css'

export function MistakesPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const state = useAppState()
  const vocab = useVocabState()
  const [query, setQuery] = useState('')
  const entries = useMemo(() => state ? collectMistakes(state) : [], [state])
  const needle = query.trim().toLocaleLowerCase('ru-RU')
  const visible = entries.filter((entry) => `${entry.title} ${entry.kana} ${entry.meaning}`.toLocaleLowerCase('ru-RU').includes(needle))
  const inSet = new Set(vocab?.trainingWordIds ?? [])
  const setName = vocab?.activeTrainingSet?.name ?? 'Основной'
  const missing = visible.filter((entry) => !inSet.has(entry.id)).map((entry) => entry.id)

  return <section className="mistakes-page" data-testid="mistakes-page">
    <header className="mistakes-heading">
      <h1>Трудности <span>{entries.length}</span></h1>
      <p>Слова, которые пока не закрепились. Последние ответы влияют сильнее старых; для оценки нужно хотя бы пять ответов.</p>
    </header>
    <div className="mistakes-toolbar">
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти слово" aria-label="Найти трудное слово" data-testid="mistakes-search" />
      <button type="button" className="text-button" disabled={!missing.length} onClick={() => vocab?.addTrainingWords(missing)}>Добавить все в набор</button>
    </div>
    <p className="mistakes-set-note">Активный набор: <strong>{setName}</strong>. Добавление в набор доступно независимо от «Моих слов».</p>
    {!visible.length ? <div className="mistakes-empty" data-testid="mistakes-empty">
      <h2>{entries.length ? 'Ничего не найдено' : 'Устойчивых трудностей пока нет'}</h2>
      <p>{entries.length ? 'Попробуйте другое написание или перевод.' : 'Продолжайте отвечать на слова. Единичные ошибки и слова без достаточного числа ответов здесь не появляются.'}</p>
      {!entries.length && <button type="button" className="text-button" onClick={() => onNavigate('mine')}>Открыть мои слова</button>}
    </div> : <div className="mistakes-list" role="list">
      {visible.map((entry) => <article className="mistake-row" key={entry.id} data-testid="mistake-card" role="listitem">
        <div className="mistake-word"><strong lang="ja">{entry.title}</strong><span lang="ja">{entry.kana}</span><p>{entry.meaning}</p></div>
        <div className="mistake-evidence" title="Ошибки среди последних сохранённых ответов. Недавние ответы имеют больший вес при отборе.">
          <span className="mistake-rate">{Math.round(entry.recentErrorRate * 100)}%</span>
          <span>взвешенных ошибок</span>
          <small>{entry.recentErrors} из {entry.recentCount} последних ответов</small>
        </div>
        <button type="button" className={inSet.has(entry.id) ? 'mistake-added' : 'text-button'} disabled={inSet.has(entry.id)} onClick={() => vocab?.addTrainingWords([entry.id])}>{inSet.has(entry.id) ? 'В наборе' : '+ В набор'}</button>
      </article>)}
    </div>}
    <p className="mistakes-data-note">Оценка использует до 15 последних ответов: вес уменьшается вдвое через каждые три ответа. Старые ошибки уходят из оценки после уверенной серии. Это сводка по словам, а не история отдельных ответов.</p>
  </section>
}
