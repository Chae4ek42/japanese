import type { AppPage } from '../lib/types'
import { PATHS, shouldHandleClientNav } from '../lib/routes'
import type { RefObject, ChangeEvent } from 'react'

export interface AppHeaderProps {
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
  onResetStats: () => void
  onExportBackup?: () => void
  onImportBackup?: () => void
  importInputRef?: RefObject<HTMLInputElement | null>
  onImportFileChange?: (event: ChangeEvent<HTMLInputElement>) => void
}

const NAV_ITEMS = [
  { id: 'home', label: 'Главная', href: PATHS.home, testId: 'nav-main' },
  { id: 'kana', label: 'Кана', href: PATHS.kana, testId: 'nav-kana' },
  { id: 'kanji', label: 'Кандзи', href: PATHS.kanji, testId: 'nav-kanji' },
  { id: 'numbers', label: 'Числа', href: PATHS.numbers, testId: 'nav-numbers' },
  { id: 'train', label: 'Слова', href: PATHS.train, testId: 'nav-train' },
  { id: 'vocab', label: 'Словарь', href: PATHS.vocab, testId: 'nav-vocab' },
  { id: 'context', label: 'Контекст', href: PATHS.context, testId: 'nav-context' },
] as const

export function AppHeader({
  currentPage,
  onNavigate,
  onResetStats,
  onExportBackup,
  onImportBackup,
  importInputRef,
  onImportFileChange,
}: AppHeaderProps) {
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

        <div className="site-header-actions">
          {onExportBackup ? (
            <button type="button" className="text-button" data-testid="export-backup" onClick={onExportBackup}>
              Экспорт
            </button>
          ) : null}
          {onImportBackup ? (
            <button type="button" className="text-button" data-testid="import-backup" onClick={onImportBackup}>
              Импорт
            </button>
          ) : null}
          <button type="button" className="text-button site-reset" data-testid="reset-stats" onClick={onResetStats}>
            <span className="site-reset-full">Сбросить данные</span>
            <span className="site-reset-short">Сброс</span>
          </button>
          {importInputRef && onImportFileChange ? (
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              data-testid="import-backup-file"
              onChange={onImportFileChange}
            />
          ) : null}
        </div>
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
