import { useRef } from 'react'
import type { ContextSentence, KanjiWord } from '../../shared/lib/types'
import { kanaToRomaji } from '../../shared/lib/kana'
import { pickQuizMeaning } from '../../shared/lib/jmdict-gloss'
import { speakJapanese } from '../../shared/lib/speech'
import { useSwipeGestures } from '../../shared/lib/useSwipeGestures'
import { ShortcutNote } from '../../shared/ui/ShortcutNote'
import { ContextSentenceText } from './ContextSentenceText'

export interface ContextPracticeProps {
  coverageLabel: string
  batchWords: KanjiWord[]
  sentenceNewWords: KanjiWord[]
  sentence: ContextSentence | null
  revealed: boolean
  status: 'ready' | 'loading-llm' | 'missing' | 'done'
  note: string
  myWords: string[]
  canGoPrev: boolean
  onReveal: () => void
  onKnowWord: (wordId: string) => void
  onKnowAll: () => void
  onLater: () => void
  onPrevSentence: () => void
  onNextSentence: () => void
  onBackToSetup: () => void
  onAddRandomWord: () => void
  onAddRandomGrammar: () => void
  onToggleMyWord: (wordId: string) => void
  onOpenKanji: (character: string) => void
}

function wordGloss(word: KanjiWord): string {
  return pickQuizMeaning(word.meanings) || word.meanings[0] || ''
}

export function ContextPractice({
  coverageLabel,
  batchWords,
  sentenceNewWords,
  sentence,
  revealed,
  status,
  note,
  myWords,
  canGoPrev,
  onReveal,
  onKnowWord,
  onKnowAll,
  onLater,
  onPrevSentence,
  onNextSentence,
  onBackToSetup,
  onAddRandomWord,
  onAddRandomGrammar,
  onToggleMyWord,
  onOpenKanji,
}: ContextPracticeProps) {
  const stageRef = useRef<HTMLElement>(null)
  useSwipeGestures(stageRef, {
    onSwipeLeft: onPrevSentence,
    onSwipeRight: onNextSentence,
    onSwipeDown: onReveal,
  })

  const highlightWritings = sentenceNewWords
    .map((word) => word.writing || word.kana)
    .filter(Boolean)
  const romaji = sentence?.reading ? kanaToRomaji(sentence.reading) : ''
  const mySet = new Set(myWords)
  const activeNewIds = new Set(sentenceNewWords.map((word) => word.id).filter(Boolean))

  return (
    <section ref={stageRef} className="context-drill has-mobile-swipes" data-testid="context-drill">
      <header className="context-drill-head">
        <div className="context-drill-head-copy">
          <p className="context-eyebrow">Тренировка</p>
          <p className="context-progress" data-testid="context-coverage">
            {coverageLabel}
          </p>
        </div>
        <button type="button" className="ghost-button" data-testid="context-back-setup" onClick={onBackToSetup}>
          Настройки
        </button>
      </header>

      {batchWords.length ? (
        <div className="context-batch" data-testid="context-batch">
          <div className="context-section-label-row">
            <span className="context-batch-label">В работе</span>
            <span className="context-batch-count">{batchWords.length}</span>
          </div>
          <ul className="context-batch-list">
            {batchWords.map((word) => {
              const gloss = wordGloss(word)
              const isActive = word.id ? activeNewIds.has(word.id) : false
              return (
                <li key={word.id} className={isActive ? 'is-active' : undefined}>
                  <div className="context-batch-head">
                    <span className="context-batch-writing">{word.writing}</span>
                    {word.kana ? <span className="context-batch-kana">{word.kana}</span> : null}
                  </div>
                  {gloss ? <span className="context-batch-meaning">{gloss}</span> : null}
                </li>
              )
            })}
          </ul>
          <div className="context-inject-row">
            <button
              type="button"
              className="ghost-button"
              data-testid="context-add-word"
              onClick={onAddRandomWord}
            >
              + слово
            </button>
            <button
              type="button"
              className="ghost-button"
              data-testid="context-add-grammar"
              onClick={onAddRandomGrammar}
            >
              + грамматика
            </button>
          </div>
        </div>
      ) : (
        <div className="context-inject-row context-inject-row-solo">
          <button
            type="button"
            className="ghost-button"
            data-testid="context-add-word"
            onClick={onAddRandomWord}
          >
            + слово
          </button>
          <button
            type="button"
            className="ghost-button"
            data-testid="context-add-grammar"
            onClick={onAddRandomGrammar}
          >
            + грамматика
          </button>
        </div>
      )}

      {status === 'loading-llm' ? (
        <div className="context-stage context-stage-muted">
          <p className="context-empty">Генерация предложения…</p>
        </div>
      ) : null}

      {status === 'done' ? (
        <div className="context-stage context-stage-muted" data-testid="context-done">
          <p className="context-empty">{note || 'Все слова темы отмечены как известные.'}</p>
        </div>
      ) : null}

      {sentence && status !== 'done' ? (
        <>
          <div className="context-stage">
            <ContextSentenceText
              text={sentence.text}
              highlightWritings={highlightWritings}
              onOpenKanji={onOpenKanji}
            />

            <div className="context-nav-row">
              <button
                type="button"
                className="ghost-button"
                data-testid="context-prev-sentence"
                disabled={!canGoPrev}
                onClick={onPrevSentence}
              >
                ← Назад
              </button>
              <button
                type="button"
                className="ghost-button"
                data-testid="context-speak"
                onClick={() => speakJapanese(sentence.text)}
              >
                Произнести
              </button>
              <button
                type="button"
                className="ghost-button"
                data-testid="context-next-sentence"
                onClick={onNextSentence}
              >
                Вперёд →
              </button>
            </div>

            <ShortcutNote
              className="context-keys-hint"
              keyboard={
                <>
                  <kbd>←</kbd>
                  <kbd>→</kbd> предложения · <kbd>Space</kbd> перевод и чтение
                </>
              }
              swipe={<>Свайп влево/вправо — предложения · вниз — перевод и чтение</>}
            />

            {revealed ? (
              <div className="context-reveal-block">
                {sentence.reading ? (
                  <p className="context-reading" data-testid="context-reading">
                    {sentence.reading}
                  </p>
                ) : null}
                {romaji ? (
                  <p className="context-romaji" data-testid="context-romaji">
                    {romaji}
                  </p>
                ) : null}
                <p className="context-gloss" data-testid="context-gloss">
                  {sentence.glossRu}
                </p>
              </div>
            ) : null}
          </div>

          {sentenceNewWords.length ? (
            <div className="context-new-words" data-testid="context-target">
              <span className="context-batch-label">Новые в предложении</span>
              <ul className="context-new-words-list">
                {sentenceNewWords.map((word) => {
                  const inMine = word.id ? mySet.has(word.id) : false
                  const gloss = wordGloss(word)
                  return (
                    <li key={word.id ?? word.writing}>
                      <div className="context-new-word-main">
                        <strong>{word.writing}</strong>
                        {word.kana ? <span className="context-new-word-kana">{word.kana}</span> : null}
                        {gloss ? <span className="context-new-word-meaning">{gloss}</span> : null}
                      </div>
                      <div className="context-new-word-actions">
                        {word.id ? (
                          <button
                            type="button"
                            className={inMine ? 'text-button is-on' : 'text-button'}
                            data-testid={`context-myword-${word.id}`}
                            onClick={() => onToggleMyWord(word.id!)}
                          >
                            {inMine ? 'В моих словах' : 'В мои слова'}
                          </button>
                        ) : null}
                        {word.id ? (
                          <button
                            type="button"
                            className="primary-button context-know-one"
                            data-testid={`context-know-${word.id}`}
                            onClick={() => onKnowWord(word.id!)}
                          >
                            Знаю
                          </button>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          <div className="context-actions">
            <button type="button" className="ghost-button" data-testid="context-reveal" onClick={onReveal}>
              {revealed ? 'Скрыть перевод' : 'Показать перевод'}
            </button>
            {sentenceNewWords.length === 1 && sentenceNewWords[0]?.id ? (
              <button
                type="button"
                className="primary-button"
                data-testid="context-know"
                onClick={() => onKnowWord(sentenceNewWords[0].id!)}
              >
                Знаю слово
              </button>
            ) : null}
            {sentenceNewWords.length >= 2 ? (
              <button
                type="button"
                className="primary-button"
                data-testid="context-know-all"
                onClick={onKnowAll}
              >
                Знаю все
              </button>
            ) : null}
            <button type="button" className="ghost-button" data-testid="context-again" onClick={onLater}>
              Позже
            </button>
          </div>
        </>
      ) : null}

      {status === 'missing' && !sentence ? (
        <div className="context-stage context-stage-muted" data-testid="context-empty">
          <p className="context-empty">{note || 'Нет подходящего предложения.'}</p>
        </div>
      ) : null}

      {note && (sentence || status === 'done' || status === 'missing') ? (
        <p className="context-note" data-testid="context-note">
          {note}
        </p>
      ) : null}
    </section>
  )
}
