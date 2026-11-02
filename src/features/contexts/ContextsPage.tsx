import { useRef, useState } from 'react'
import type { AppPage, WordContext } from '../../shared/lib/types'
import { useContextsState } from '../../shared/state/contexts-slice'
import { acceptsContextAnswer, contextCloze, contextSourceLabel } from './practice'
import './styles.css'

export function ContextsPage({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const contexts = useContextsState()
  const [index, setIndex] = useState(0)
  const examples = contexts?.examples ?? []
  const example = examples[index % Math.max(1, examples.length)]
  return <main className="contexts-page">
    <header><p>Практика в предложениях</p><h2>Слова в контексте</h2><p>Восстановите исходное слово, включая его форму в предложении. Возможны другие уместные слова: здесь проверяется совпадение с оригиналом, а не грамматика.</p></header>
    {example && contexts ? <>
      <p>{index % examples.length + 1} / {examples.length} · Сохранено примеров: {examples.length}</p>
      <ContextExercise key={`${example.id}-${index}`} example={example} onAttempt={(correct) => contexts.recordAttempt(example.id, correct)} />
      <button className="primary-button" onClick={() => setIndex((value) => value + 1)}>Следующий пример</button>
      <p>Попытки в этом примере: {contexts.stats[example.id]?.attempts ?? 0} · Без подсказки верно: {contexts.stats[example.id]?.correct ?? 0}</p>
    </> : <p>Пока нет примеров. Добавьте слово из текста или своё предложение в карточке слова.</p>}
    <button className="ghost-button" onClick={() => onNavigate('reader')}>Открыть чтение</button>
  </main>
}

function ContextExercise({ example, onAttempt }: { example: WordContext; onAttempt: (correct: boolean) => void }) {
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<'correct' | 'different' | 'hint' | null>(null)
  const settled = useRef(false)
  function settle(hint = false) {
    if (settled.current || (!hint && !answer.trim())) return
    settled.current = true
    const correct = !hint && acceptsContextAnswer(example, answer)
    onAttempt(correct)
    setResult(hint ? 'hint' : correct ? 'correct' : 'different')
  }
  return <section className="context-exercise">
    <p>{contextSourceLabel(example)}</p>
    <h3>Восстановите исходное слово</h3>
    <p className="context-sentence" lang="ja">{contextCloze(example)}</p>
    <form onSubmit={(event) => { event.preventDefault(); settle() }}>
      <label>Слово в форме из текста (японское написание, кана или ромадзи)<input autoComplete="off" value={answer} disabled={Boolean(result)} onChange={(event) => setAnswer(event.target.value)} /></label>
      <div className="context-actions"><button className="primary-button" disabled={Boolean(result) || !answer.trim()}>Проверить</button><button type="button" className="ghost-button" disabled={Boolean(result)} onClick={() => settle(true)}>Показать ответ</button></div>
    </form>
    {result ? <div role="status"><p>{result === 'correct' ? 'Верно, исходное слово восстановлено.' : result === 'hint' ? 'Ответ показан. Эта попытка не считается верной.' : 'Ответ отличается от оригинала. Это не оценка грамматической допустимости вашего варианта.'}</p><p lang="ja">{example.sentence}</p><p>{example.surface}{example.reading ? ` (${example.reading})` : ''}{example.meaning ? ` — ${example.meaning}` : ''}</p>{example.translation ? <p>{example.translation}</p> : null}</div> : null}
  </section>
}
