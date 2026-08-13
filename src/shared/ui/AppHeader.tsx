import type { AppPage } from '../lib/types'
import { PATHS, shouldHandleClientNav } from '../lib/routes'
import { navItems } from '../lib/pages'
import type { RefObject, ChangeEvent } from 'react'
import { TrainingSetsMenu } from './TrainingSetsMenu'
import { AccountsMenu } from './AccountsMenu'

export interface AppHeaderProps {
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
  onExportBackup?: () => void
  onImportBackup?: () => void
  importInputRef?: RefObject<HTMLInputElement | null>
  onImportFileChange?: (event: ChangeEvent<HTMLInputElement>) => void
}

const NAV_ITEMS = navItems('primary')

export function AppHeader({
  currentPage,
  onNavigate,
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
        </div>

        <div className="site-header-actions">
          <AccountsMenu onNavigate={onNavigate} />
          <TrainingSetsMenu onNavigate={onNavigate} />
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
            href={item.path}
            data-testid={item.navTestId}
            className={currentPage === item.id ? 'site-nav-link is-active' : 'site-nav-link'}
            onClick={(event) => {
              if (shouldHandleClientNav(event)) {
                event.preventDefault()
                onNavigate(item.id)
              }
            }}
          >
            {item.navLabel}
          </a>
        ))}
      </nav>
    </header>
  )
}
