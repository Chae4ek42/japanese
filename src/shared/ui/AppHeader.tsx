import type { AppHeaderProps } from '../../shared/lib/component-props'
import { PATHS, shouldHandleClientNav } from '../../shared/lib/routes'

const NAV_ITEMS = [
  { id: 'home', label: 'Главная', href: PATHS.home, testId: 'nav-main' },
  { id: 'kana', label: 'Кана', href: PATHS.kana, testId: 'nav-kana' },
  { id: 'kanji', label: 'Кандзи', href: PATHS.kanji, testId: 'nav-kanji' },
  { id: 'numbers', label: 'Числа', href: PATHS.numbers, testId: 'nav-numbers' },
  { id: 'vocab', label: 'Словарь', href: PATHS.vocab, testId: 'nav-vocab' },
  { id: 'stats', label: 'Прогресс', href: PATHS.stats, testId: 'nav-stats' },
] as const

export function AppHeader({ currentPage, onNavigate, onResetStats }: AppHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header-top">
        <div className="site-header-brand">
          <a
            href={PATHS.home}
            className="site-logo"
            data-testid="nav-home"
            onClick={(event) => {
              if (shouldHandleClientNav(event)) {
                event.preventDefault()
                onNavigate('home')
              }
            }}
          >
            JP тренажёры
          </a>
          <p className="site-tagline">Японский · каждый день</p>
        </div>

        <button type="button" className="text-button site-reset" data-testid="reset-stats" onClick={onResetStats}>
          <span className="site-reset-full">Сбросить данные</span>
          <span className="site-reset-short">Сброс</span>
        </button>
      </div>

      <nav className="site-nav" aria-label="Основная навигация">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            data-testid={item.testId}
            className={currentPage === item.id ? 'site-nav-link is-active' : 'site-nav-link'}
            onClick={(event) => {
              if (shouldHandleClientNav(event)) {
                event.preventDefault()
                onNavigate(item.id)
              }
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
