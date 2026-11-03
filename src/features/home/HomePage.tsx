import { pathForPage, shouldHandleClientNav } from '../../shared/lib/routes'
import { homeEntries } from '../../shared/lib/pages'
import type { AppPage } from '../../shared/lib/types'
import {
  useKanaState,
  useNumbersState,
} from '../../shared/state/AppStateContext'
import { collectContinueItems } from './dashboard'
import './styles.css'

export interface HomePageProps {
  onNavigate: (page: AppPage) => void
}

const visibleEntries = (group: 'practice' | 'reference') => homeEntries(group).filter((entry) => entry.id !== 'particles' && entry.id !== 'verbs')
const PRACTICE = visibleEntries('practice')
const REFERENCE = visibleEntries('reference')

export function HomePage({ onNavigate }: HomePageProps) {
  const kana = useKanaState()
  const numbers = useNumbersState()

  const continues = collectContinueItems({
    kana: kana?.liveSession,
    numbers: numbers?.liveSession,
  })

  return (
    <main className="home-page">
      <section className="home-hero">
        <h1 className="home-title">Японский</h1>
        <p className="home-lead">Практика каждый день.</p>
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

      <div className="home-catalogs">
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
      </div>
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
