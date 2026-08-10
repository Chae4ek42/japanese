import { PATHS, shouldHandleClientNav } from '../lib/routes'
import { useAccounts } from '../state/AppStateContext'
import type { AppPage } from '../lib/types'

export function AccountsMenu({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const { activeAccount } = useAccounts()

  if (!activeAccount) return null

  return (
    <div className="accounts-menu">
      <a
        href={PATHS.accounts}
        className="text-button accounts-menu-trigger"
        data-testid="accounts-menu"
        title="Сменить аккаунт"
        onClick={(event) => {
          if (shouldHandleClientNav(event)) {
            event.preventDefault()
            onNavigate('accounts')
          }
        }}
      >
        <span className="accounts-menu-name-label">{activeAccount.name}</span>
        <span className="accounts-menu-hint">сменить</span>
      </a>
    </div>
  )
}
