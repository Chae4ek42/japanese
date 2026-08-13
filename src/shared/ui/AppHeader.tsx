import type { AppPage } from '../lib/types'
import { PATHS, shouldHandleClientNav } from '../lib/routes'
import { navItems } from '../lib/pages'
import type { RefObject, ChangeEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
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

const PRIMARY_NAV = navItems('primary')
const MORE_NAV = navItems('more')

export function AppHeader({
  currentPage,
  onNavigate,
  onExportBackup,
  onImportBackup,
  importInputRef,
  onImportFileChange,
}: AppHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const moreActive = MORE_NAV.some((item) => item.id === currentPage)

  useEffect(() => {
    setMoreOpen(false)
  }, [currentPage])

  useEffect(() => {
    if (!moreOpen) return
    function onPointerDown(event: PointerEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

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
        {PRIMARY_NAV.map((item) => (
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

        <div className="site-nav-more" ref={moreRef}>
          <button
            type="button"
            className={moreActive || moreOpen ? 'site-nav-link is-active' : 'site-nav-link'}
            data-testid="nav-more"
            aria-expanded={moreOpen}
            aria-haspopup="true"
            onClick={() => setMoreOpen((open) => !open)}
          >
            Ещё
          </button>
          {moreOpen ? (
            <div className="site-nav-more-panel" role="menu" data-testid="nav-more-panel">
              {MORE_NAV.map((item) => (
                <a
                  key={item.id}
                  href={item.path}
                  role="menuitem"
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
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  )
}
