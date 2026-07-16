export function AppHeader({ currentPage, onNavigate, onResetStats }) {
  return (
    <header className="site-header">
      <div className="site-header-brand">
        <button type="button" className="site-logo" data-testid="nav-home" onClick={() => onNavigate('home')}>
          JP тренажёры
        </button>
        <p className="site-tagline">Тренировка японского</p>
      </div>

      <nav className="site-nav" aria-label="Навигация">
        <button
          type="button"
          data-testid="nav-main"
          className={currentPage === 'home' ? 'site-nav-link is-active' : 'site-nav-link'}
          onClick={() => onNavigate('home')}
        >
          Главная
        </button>
        <button
          type="button"
          data-testid="nav-kana"
          className={currentPage === 'kana' ? 'site-nav-link is-active' : 'site-nav-link'}
          onClick={() => onNavigate('kana')}
        >
          Кана
        </button>
        <button
          type="button"
          data-testid="nav-numbers"
          className={currentPage === 'numbers' ? 'site-nav-link is-active' : 'site-nav-link'}
          onClick={() => onNavigate('numbers')}
        >
          Числа
        </button>
        <button
          type="button"
          data-testid="nav-stats"
          className={currentPage === 'stats' ? 'site-nav-link is-active' : 'site-nav-link'}
          onClick={() => onNavigate('stats')}
        >
          Статистика
        </button>
      </nav>

      <button type="button" className="text-button site-reset" data-testid="reset-stats" onClick={onResetStats}>
        Сбросить прогресс
      </button>
    </header>
  )
}
