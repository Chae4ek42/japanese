import { PATHS, shouldHandleClientNav } from '../../shared/lib/routes'
import './styles.css'

export interface HomePageProps {
  onOpenKana: () => void
  onOpenKanji: () => void
  onOpenNumbers: () => void
  onOpenParticles: () => void
  onOpenReader: () => void
  onOpenVocab: () => void
  onOpenMine: () => void
  onOpenVocabTrain: () => void
  onOpenTheory: () => void
  onOpenAnalytics: () => void
}

const ENTRIES = [
  {
    id: 'kana',
    href: PATHS.kana,
    symbol: 'あ',
    title: 'Кана',
    action: 'Начать',
    testId: 'open-kana',
  },
  {
    id: 'kanji',
    href: PATHS.kanji,
    symbol: '字',
    title: 'Кандзи',
    action: 'Открыть',
    testId: 'open-kanji',
  },
  {
    id: 'numbers',
    href: PATHS.numbers,
    symbol: '十',
    title: 'Числа и возраст',
    action: 'Начать',
    testId: 'open-numbers',
  },
  {
    id: 'particles',
    href: PATHS.particles,
    symbol: 'は',
    title: 'Частицы',
    action: 'Начать',
    testId: 'open-particles',
  },
  {
    id: 'reader',
    href: PATHS.reader,
    symbol: '文',
    title: 'Текст',
    action: 'Открыть',
    testId: 'open-reader',
  },
  {
    id: 'vocab-train',
    href: PATHS.train,
    symbol: '練',
    title: 'Слова',
    action: 'Начать',
    testId: 'open-vocab-train',
  },
  {
    id: 'vocab',
    href: PATHS.vocab,
    symbol: '語',
    title: 'Словарь',
    action: 'Открыть',
    testId: 'open-vocab',
  },
  {
    id: 'mine',
    href: PATHS.mine,
    symbol: '私',
    title: 'Мои слова',
    action: 'Открыть',
    testId: 'open-mine',
  },
  {
    id: 'theory',
    href: PATHS.theory,
    symbol: '理',
    title: 'Теория',
    action: 'Открыть',
    testId: 'open-theory',
  },
  {
    id: 'analytics',
    href: PATHS.analytics,
    symbol: '統',
    title: 'Аналитика',
    action: 'Открыть',
    testId: 'open-analytics',
  },
] as const

export function HomePage({
  onOpenKana,
  onOpenKanji,
  onOpenNumbers,
  onOpenParticles,
  onOpenReader,
  onOpenVocab,
  onOpenMine,
  onOpenVocabTrain,
  onOpenTheory,
  onOpenAnalytics,
}: HomePageProps) {
  const openers = {
    kana: onOpenKana,
    kanji: onOpenKanji,
    numbers: onOpenNumbers,
    particles: onOpenParticles,
    reader: onOpenReader,
    'vocab-train': onOpenVocabTrain,
    vocab: onOpenVocab,
    mine: onOpenMine,
    theory: onOpenTheory,
    analytics: onOpenAnalytics,
  } as const

  return (
    <main className="home-page">
      <section className="home-hero">
        <h1 className="home-title">JP тренажёры</h1>
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
            </span>
            <span className="home-entry-action">{entry.action}</span>
          </a>
        ))}
      </section>
    </main>
  )
}
