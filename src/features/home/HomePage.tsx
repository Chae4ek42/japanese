import type { HomePageProps } from '../../shared/lib/component-props'
import { PATHS, shouldHandleClientNav } from '../../shared/lib/routes'
import './styles.css'

const ENTRIES = [
  {
    id: 'kana',
    href: PATHS.kana,
    symbol: 'あ',
    title: 'Кана',
    text: 'Хирагана и катакана. Адаптивная очередь и разбор похожих знаков.',
    action: 'Начать',
    testId: 'open-kana',
  },
  {
    id: 'kanji',
    href: PATHS.kanji,
    symbol: '字',
    title: 'Кандзи',
    text: 'Знаки JLPT N5–N3, слова из словаря и прогресс по выученным.',
    action: 'Открыть',
    testId: 'open-kanji',
  },
  {
    id: 'numbers',
    href: PATHS.numbers,
    symbol: '十',
    title: 'Числа и возраст',
    text: 'Чтение чисел и возраста по-японски. Со шпаргалкой под рукой.',
    action: 'Начать',
    testId: 'open-numbers',
  },
  {
    id: 'vocab-train',
    href: PATHS.vocabTrain,
    symbol: '練',
    title: 'Слова',
    text: 'Тренировка слов: ромадзи или выбор перевода из шести вариантов.',
    action: 'Начать',
    testId: 'open-vocab-train',
  },
  {
    id: 'vocab',
    href: PATHS.vocab,
    symbol: '語',
    title: 'Словарь',
    text: 'Все слова библиотеки и ваш личный список с чтением и озвучкой.',
    action: 'Открыть',
    testId: 'open-vocab',
  },
] as const

export function HomePage({
  onOpenKana,
  onOpenKanji,
  onOpenNumbers,
  onOpenVocab,
  onOpenVocabTrain,
}: HomePageProps) {
  const openers = {
    kana: onOpenKana,
    kanji: onOpenKanji,
    numbers: onOpenNumbers,
    'vocab-train': onOpenVocabTrain,
    vocab: onOpenVocab,
  } as const

  return (
    <main className="home-page">
      <section className="home-hero">
        <h1 className="home-title">JP тренажёры</h1>
        <p className="home-lead">Практика японского: кана, кандзи, числа и словарь — в одном месте.</p>
      </section>

      <section className="home-entries" aria-label="Разделы">
        {ENTRIES.map((entry) => (
          <a
            key={entry.id}
            href={entry.href}
            className="home-entry"
            data-testid={entry.testId}
            onClick={(event) => {
              if (shouldHandleClientNav(event)) {
                event.preventDefault()
                openers[entry.id]()
              }
            }}
          >
            <span className="home-entry-symbol" aria-hidden="true">
              {entry.symbol}
            </span>
            <span className="home-entry-body">
              <span className="home-entry-title">{entry.title}</span>
              <span className="home-entry-text">{entry.text}</span>
            </span>
            <span className="home-entry-action">{entry.action}</span>
          </a>
        ))}
      </section>
    </main>
  )
}
