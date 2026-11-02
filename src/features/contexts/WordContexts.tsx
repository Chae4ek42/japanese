import { useState } from 'react'
import type { AppPage, KanjiWord } from '../../shared/lib/types'
import { useContextsState } from '../../shared/state/contexts-slice'
import { wordVariantIds } from '../vocab/mergeHomographs'
import { contextSourceLabel } from './practice'
import './styles.css'

export function WordContexts({ word, onNavigate }: { word: KanjiWord; onNavigate?: (page: AppPage) => void }) {
  const contexts = useContextsState()
  const [sentence, setSentence] = useState('')
  const [surface, setSurface] = useState(word.writing || word.kana)
  const [reading, setReading] = useState('')
  const [translation, setTranslation] = useState('')
  const ids = wordVariantIds(word)
  const examples = contexts?.examples.filter((item) => ids.includes(item.wordId)) ?? []
  const valid = Boolean(sentence.trim() && surface.trim() && sentence.includes(surface.trim()))
  return <details className="word-contexts"><summary>Предложения со словом ({examples.length})</summary>
    {examples.map((example) => <article key={example.id}><p lang="ja">{example.sentence}</p><p>{contextSourceLabel(example)}</p>{example.translation ? <p>{example.translation}</p> : null}<button className="text-button" onClick={() => contexts?.removeExample(example.id)}>Удалить пример</button></article>)}
    <form onSubmit={(event) => { event.preventDefault(); if (!valid || !contexts || !ids[0]) return; contexts.addExamples([{ wordId: ids[0], sentence: sentence.trim(), surface: surface.trim(), reading: reading.trim() || undefined, translation: translation.trim() || undefined, meaning: word.meanings[0], sourceKind: 'manual' }]); setSentence(''); setReading(''); setTranslation('') }}>
      <label>Ваше предложение<textarea value={sentence} onChange={(event) => setSentence(event.target.value)} /></label>
      <label>Слово точно как в предложении<input value={surface} onChange={(event) => setSurface(event.target.value)} /></label>
      <label>Чтение этой формы (необязательно)<input value={reading} onChange={(event) => setReading(event.target.value)} /></label>
      <label>Ваш перевод (необязательно)<input value={translation} onChange={(event) => setTranslation(event.target.value)} /></label>
      {sentence && !valid ? <p>Укажите слово, которое дословно встречается в предложении.</p> : null}
      <button className="ghost-button" disabled={!valid}>Сохранить свой пример</button>
    </form>
    {onNavigate ? <button className="text-button" onClick={() => onNavigate('contexts')}>Практика в предложениях</button> : null}
  </details>
}
