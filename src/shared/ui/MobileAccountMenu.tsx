import { useEffect, useId, useRef, useState } from 'react'
import type { AppPage } from '../lib/types'
import { AccountsMenu } from './AccountsMenu'

export function MobileAccountMenu({ onNavigate, onExport, onImport }: {
  onNavigate: (page: AppPage) => void
  onExport?: () => void
  onImport?: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  function run(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div className="mobile-account-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="mobile-header-icon"
        aria-label="Аккаунт и данные"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        data-testid="mobile-account-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><circle cx="12" cy="9" r="3" /><path d="M5 18c1-5 13-5 14 0" />
        </svg>
      </button>
      {open ? (
        <div id={id} className="mobile-account-panel" role="dialog" aria-label="Аккаунт и данные" data-testid="mobile-account-panel" onKeyDown={(event) => event.stopPropagation()}>
          <AccountsMenu onNavigate={(page) => run(() => onNavigate(page))} />
          <div className="mobile-account-data">
            {onExport ? <button type="button" data-testid="export-backup" onClick={() => run(onExport)}>Скачать резервную копию</button> : null}
            {onImport ? <button type="button" data-testid="import-backup" onClick={() => run(onImport)}>Загрузить резервную копию</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
