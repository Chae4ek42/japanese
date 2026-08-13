import { pathForPage, shouldHandleClientNav } from '../../shared/lib/routes'
import { homeEntries } from '../../shared/lib/pages'
import type { AppPage } from '../../shared/lib/types'
import {
  useKanaState,
  useNumbersState,
  useParticlesState,
  useVerbsState,
  useVocabState,
} from '../../shared/state/AppStateContext'
import { collectContinueItems, countHomeVocabDue } from './dashboard'
import './styles.css'

export interface HomePageProps {
  onNavigate: (page: AppPage) => void
}

const PRACTICE = homeEntries('practice')
const REFERENCE = homeEntries('reference')

export function HomePage({ onNavigate }: HomePageProps) {
  const kana = useKanaState()
  const numbers = useNumbersState()
  const particles = useParticlesState()
  const verbs = useVerbsState()
  const vocab = useVocabState()

  const continues = collectContinueItems({
    train: vocab?.liveSession,
    kana: kana?.liveSession,
    particles: particles?.liveSession,
    verbs: verbs?.liveSession,
    numbers: numbers?.liveSession,
  })
  const due = countHomeVocabDue({
    myWords: vocab?.myWords ?? [],
    memory: vocab?.memory ?? {},
    targetRetention: vocab?.preferences.targetRetention ?? 0.9,
  })

  function openDueReview() {
    vocab?.patchPreferences({ sessionMode: 'srs', source: 'mine' })
    onNavigate('train')
  }

  return (
    <main className="home-page">
      <section className="home-hero">
        <h1 className="home-title">JP тренажёры</h1>
        <p className="home-lead">Продолжите сессию или откройте раздел.</p>
      </section>

      {continues.length ? (
        <section className="home-now" aria-label="Продолжить">
          {continues.map((item) => (
            <button
              key={item.page}
              type="button"
              className="home-continue"
              data-testid={item.testId}
              onClick={() => onNavigate(item.page)}
            >
              <span className="home-continue-kicker">Продолжить</span>
              <span className="home-continue-title">{item.title}</span>
              <span className="home-continue-meta">
                {item.answered ? `${item.answered} в этой сессии` : 'Сессия открыта'}
              </span>
            </button>
          ))}
        </section>
      ) : null}

      {due.due > 0 || due.newCards > 0 ? (
        <section className="home-now" aria-label="Повторение">
          <button
            type="button"
            className="home-continue is-secondary"
            data-testid="home-open-srs"
            onClick={openDueReview}
          >
            <span className="home-continue-kicker">Интервальные</span>
            <span className="home-continue-title">Повторить слова</span>
            <span className="home-continue-meta">
              {due.due ? `${due.due} к повторению` : null}
              {due.due && due.newCards ? ' · ' : null}
              {due.newCards ? `${due.newCards} новых` : null}
            </span>
          </button>
        </section>
      ) : null}

      <HomeCatalog
        label="Практика"
        entries={PRACTICE}
        onNavigate={onNavigate}
      />
      <HomeCatalog
        label="Справочник"
        entries={REFERENCE}
        onNavigate={onNavigate}
      />
    </main>
  )
}

function HomeCatalog({
  label,
  entries,
  onNavigate,
}: {
  label: string
  entries: ReturnType<typeof homeEntries>
  onNavigate: (page: AppPage) => void
}) {
  return (
    <section className="home-entries" aria-label={label}>
      <h2 className="home-group-title">{label}</h2>
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={pathForPage(entry.id)}
          className="home-entry"
          data-testid={entry.home.testId}
          onClick={(event) => {
            if (shouldHandleClientNav(event)) {
              event.preventDefault()
              onNavigate(entry.id)
            }
          }}
        >
          <span className="home-entry-symbol" aria-hidden="true">
            {entry.home.symbol}
          </span>
          <span className="home-entry-body">
            <span className="home-entry-title">{entry.home.title}</span>
          </span>
          <span className="home-entry-action">{entry.home.action}</span>
        </a>
      ))}
    </section>
  )
}
