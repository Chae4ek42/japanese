import { useState } from 'react'
import { useAccounts } from '../../shared/state/AppStateContext'
import { AuthError, MIN_PASSWORD_LENGTH } from '../../shared/lib/account-auth'
import {
  accountHasPassword,
  defaultAccountName,
  type AccountRecord,
} from '../../shared/lib/accounts'
import './styles.css'

export interface AccountGateProps {
  onEntered?: () => void
  onCancel?: () => void
}

type PanelMode = 'login' | 'setup' | 'delete' | 'change'

function errorMessage(error: unknown): string {
  if (error instanceof AuthError) return error.message
  if (error instanceof Error) return error.message
  return 'Не удалось выполнить действие'
}

export function AccountGate({ onEntered, onCancel }: AccountGateProps) {
  const {
    accounts,
    activeAccount,
    activeAccountId,
    createAccount,
    switchAccount,
    renameAccount,
    deleteAccount,
    setAccountPassword,
    storageReady,
    needsAccount,
    bootstrapError,
    refreshAccounts,
  } = useAccounts()

  const [creating, setCreating] = useState(false)
  const [nameDraft, setNameDraft] = useState(() => defaultAccountName(accounts))
  const [createPassword, setCreatePassword] = useState('')
  const [createError, setCreateError] = useState('')

  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>('login')
  const [passwordDraft, setPasswordDraft] = useState('')
  const [passwordDraft2, setPasswordDraft2] = useState('')
  const [currentPasswordDraft, setCurrentPasswordDraft] = useState('')
  const [panelError, setPanelError] = useState('')
  const [busy, setBusy] = useState(false)

  const switching = Boolean(activeAccountId) && !needsAccount
  const selected = accounts.find((item) => item.id === selectedId) ?? null

  if (!storageReady) {
    return (
      <div className="account-gate">
        <p className="account-gate-loading">Загрузка…</p>
      </div>
    )
  }

  function resetPanel() {
    setSelectedId(null)
    setPanelMode('login')
    setPasswordDraft('')
    setPasswordDraft2('')
    setCurrentPasswordDraft('')
    setPanelError('')
  }

  function openPanel(account: AccountRecord, mode: PanelMode) {
    setCreating(false)
    setSelectedId(account.id)
    setPanelMode(mode)
    setPasswordDraft('')
    setPasswordDraft2('')
    setCurrentPasswordDraft('')
    setPanelError('')
  }

  function beginRename(id: string, name: string) {
    setRenameId(id)
    setRenameDraft(name)
  }

  function commitRename() {
    if (!renameId) return
    const id = renameId
    const name = renameDraft
    setRenameId(null)
    void renameAccount(id, name).catch((error) => {
      setPanelError(errorMessage(error))
    })
  }

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault()
    setCreateError('')
    setBusy(true)
    try {
      await createAccount(nameDraft, createPassword)
      onEntered?.()
    } catch (error) {
      setCreateError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function submitPanel(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    setPanelError('')
    setBusy(true)
    try {
      if (panelMode === 'login') {
        if (selected.id === activeAccountId) {
          onEntered?.()
          return
        }
        await switchAccount(selected.id, passwordDraft)
        onEntered?.()
        return
      }

      if (panelMode === 'setup') {
        if (passwordDraft !== passwordDraft2) {
          throw new AuthError('Пароли не совпадают', 'mismatch')
        }
        await setAccountPassword(selected.id, null, passwordDraft)
        onEntered?.()
        return
      }

      if (panelMode === 'change') {
        if (passwordDraft !== passwordDraft2) {
          throw new AuthError('Пароли не совпадают', 'mismatch')
        }
        const current = accountHasPassword(selected) ? currentPasswordDraft : null
        await setAccountPassword(selected.id, current, passwordDraft)
        resetPanel()
        return
      }

      if (panelMode === 'delete') {
        if (
          !window.confirm(
            `Удалить аккаунт «${selected.name}» и весь его прогресс? Это нельзя отменить.`,
          )
        ) {
          return
        }
        await deleteAccount(selected.id, passwordDraft)
        resetPanel()
      }
    } catch (error) {
      setPanelError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  function onPickAccount(account: AccountRecord) {
    if (account.id === activeAccountId) {
      onEntered?.()
      return
    }
    if (!accountHasPassword(account)) {
      openPanel(account, 'setup')
      return
    }
    openPanel(account, 'login')
  }

  return (
    <main className="account-gate" data-testid="account-gate">
      <header className="account-gate-hero">
        <p className="account-gate-kicker">JP тренажёры</p>
        <h1 className="account-gate-title">{switching ? 'Смена аккаунта' : 'Аккаунты'}</h1>
        {switching ? (
          <p className="account-gate-lead">
            Чтобы переключиться, введите пароль выбранного аккаунта.
          </p>
        ) : null}
      </header>

      {activeAccount ? (
        <p className="account-gate-current" data-testid="account-current">
          Сейчас: <strong>{activeAccount.name}</strong>
        </p>
      ) : null}

      {bootstrapError ? (
        <div className="account-gate-section" data-testid="account-bootstrap-error">
          <p className="account-gate-error">{bootstrapError}</p>
          <button
            type="button"
            className="account-gate-secondary"
            onClick={() => void refreshAccounts()}
          >
            Повторить
          </button>
        </div>
      ) : null}

      <section className="account-gate-section" aria-label="Список аккаунтов">
        <h2 className="account-gate-section-title">
          {switching ? 'Переключить на' : 'Войти'}
        </h2>
        {accounts.length ? (
          <ul className="account-gate-list">
            {accounts.map((account) => {
              const isActive = account.id === activeAccountId
              const isSelected = account.id === selectedId
              return (
                <li
                  key={account.id}
                  className={
                    isActive
                      ? 'account-gate-item is-active'
                      : isSelected
                        ? 'account-gate-item is-selected'
                        : 'account-gate-item'
                  }
                >
                  {renameId === account.id ? (
                    <form
                      className="account-gate-rename"
                      onSubmit={(event) => {
                        event.preventDefault()
                        commitRename()
                      }}
                    >
                      <input
                        value={renameDraft}
                        maxLength={32}
                        autoFocus
                        data-testid={`account-rename-input-${account.id}`}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onBlur={commitRename}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="account-gate-enter"
                      data-testid={`account-enter-${account.id}`}
                      disabled={busy}
                      onClick={() => onPickAccount(account)}
                    >
                      <span className="account-gate-enter-name">{account.name}</span>
                      {isActive ? (
                        <span className="account-gate-enter-tag">текущий</span>
                      ) : (
                        <span className="account-gate-enter-action">
                          {!accountHasPassword(account)
                            ? 'Задать пароль'
                            : switching
                              ? 'Переключить'
                              : 'Войти'}
                        </span>
                      )}
                    </button>
                  )}
                  <div className="account-gate-item-actions">
                    {isActive ? (
                      <button
                        type="button"
                        className="account-gate-rename-btn"
                        data-testid={`account-rename-${account.id}`}
                        onClick={() => beginRename(account.id, account.name)}
                      >
                        Имя
                      </button>
                    ) : null}
                    {accountHasPassword(account) || isActive ? (
                      <button
                        type="button"
                        className="account-gate-rename-btn"
                        data-testid={`account-change-password-${account.id}`}
                        onClick={() =>
                          openPanel(account, accountHasPassword(account) ? 'change' : 'setup')
                        }
                      >
                        Пароль
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="account-gate-delete"
                      data-testid={`account-delete-${account.id}`}
                      onClick={() => openPanel(account, 'delete')}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="account-gate-empty" data-testid="account-list-empty">
            Пока нет аккаунтов. Создайте первый — кнопка ниже.
          </p>
        )}
      </section>

      {selected && panelMode ? (
        <section className="account-gate-section" data-testid="account-auth-panel">
          <h2 className="account-gate-section-title">
            {panelMode === 'login'
              ? `Пароль — ${selected.name}`
              : panelMode === 'setup'
                ? `Задайте пароль — ${selected.name}`
                : panelMode === 'change'
                  ? `Смена пароля — ${selected.name}`
                  : `Удаление — ${selected.name}`}
          </h2>
          <form className="account-gate-form" onSubmit={(event) => void submitPanel(event)}>
            {panelMode === 'change' && accountHasPassword(selected) ? (
              <>
                <label className="account-gate-label" htmlFor="account-current-password">
                  Текущий пароль
                </label>
                <input
                  id="account-current-password"
                  type="password"
                  className="account-gate-input"
                  value={currentPasswordDraft}
                  autoComplete="current-password"
                  data-testid="account-current-password"
                  onChange={(event) => setCurrentPasswordDraft(event.target.value)}
                />
              </>
            ) : null}

            {panelMode !== 'delete' ? (
              <>
                <label className="account-gate-label" htmlFor="account-password">
                  {panelMode === 'login' ? 'Пароль' : 'Новый пароль'}
                </label>
                <input
                  id="account-password"
                  type="password"
                  className="account-gate-input"
                  value={passwordDraft}
                  autoFocus
                  autoComplete={panelMode === 'login' ? 'current-password' : 'new-password'}
                  minLength={MIN_PASSWORD_LENGTH}
                  data-testid="account-password"
                  onChange={(event) => setPasswordDraft(event.target.value)}
                />
              </>
            ) : (
              <>
                <label className="account-gate-label" htmlFor="account-password">
                  {accountHasPassword(selected)
                    ? 'Пароль аккаунта'
                    : 'Подтверждение (можно оставить пустым)'}
                </label>
                <input
                  id="account-password"
                  type="password"
                  className="account-gate-input"
                  value={passwordDraft}
                  autoFocus
                  autoComplete="current-password"
                  data-testid="account-password"
                  onChange={(event) => setPasswordDraft(event.target.value)}
                />
              </>
            )}

            {panelMode === 'setup' || panelMode === 'change' ? (
              <>
                <label className="account-gate-label" htmlFor="account-password2">
                  Повтор пароля
                </label>
                <input
                  id="account-password2"
                  type="password"
                  className="account-gate-input"
                  value={passwordDraft2}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  data-testid="account-password-confirm"
                  onChange={(event) => setPasswordDraft2(event.target.value)}
                />
              </>
            ) : null}

            {panelError ? (
              <p className="account-gate-error" data-testid="account-auth-error">
                {panelError}
              </p>
            ) : null}

            <div className="account-gate-form-actions">
              <button
                type="submit"
                className="account-gate-primary"
                disabled={busy}
                data-testid="account-auth-submit"
              >
                {panelMode === 'login'
                  ? switching
                    ? 'Переключить'
                    : 'Войти'
                  : panelMode === 'setup'
                    ? 'Сохранить и войти'
                    : panelMode === 'change'
                      ? 'Сменить пароль'
                      : 'Удалить'}
              </button>
              <button
                type="button"
                className="account-gate-secondary"
                disabled={busy}
                onClick={resetPanel}
              >
                Отмена
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="account-gate-section">
        {creating ? (
          <form
            className="account-gate-form"
            onSubmit={(event) => void submitCreate(event)}
            data-testid="account-create-form"
          >
            <label className="account-gate-label" htmlFor="account-name">
              Имя нового аккаунта
            </label>
            <input
              id="account-name"
              className="account-gate-input"
              value={nameDraft}
              maxLength={32}
              autoFocus
              data-testid="account-name-input"
              onChange={(event) => setNameDraft(event.target.value)}
            />
            <label className="account-gate-label" htmlFor="account-create-password">
              Пароль
            </label>
            <input
              id="account-create-password"
              type="password"
              className="account-gate-input"
              value={createPassword}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              data-testid="account-create-password"
              onChange={(event) => setCreatePassword(event.target.value)}
            />
            {createError ? (
              <p className="account-gate-error" data-testid="account-create-error">
                {createError}
              </p>
            ) : null}
            <div className="account-gate-form-actions">
              <button
                type="submit"
                className="account-gate-primary"
                disabled={busy}
                data-testid="account-create-submit"
              >
                Создать и войти
              </button>
              <button
                type="button"
                className="account-gate-secondary"
                disabled={busy}
                onClick={() => {
                  setCreating(false)
                  setCreateError('')
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="account-gate-primary"
            data-testid="account-create-open"
            onClick={() => {
              resetPanel()
              setNameDraft(defaultAccountName(accounts))
              setCreatePassword('')
              setCreateError('')
              setCreating(true)
            }}
          >
            Новый аккаунт
          </button>
        )}
      </section>

      {switching && onCancel ? (
        <div className="account-gate-footer">
          <button
            type="button"
            className="account-gate-secondary"
            data-testid="account-cancel"
            onClick={onCancel}
          >
            Остаться в «{activeAccount?.name}»
          </button>
        </div>
      ) : null}
    </main>
  )
}
