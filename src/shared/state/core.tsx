import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import type { AppState } from '../lib/types'
import {
  accountHasPassword,
  AuthError,
  hashPassword,
  validatePassword,
  verifyPassword,
} from '../lib/account-auth'
import {
  createAccountRecord,
  defaultAccountName,
  loadAccountState,
  loadAccountsMeta,
  saveAccountState,
  saveAccountsMeta,
  sanitizeAccountName,
  updateAccountPassword,
  type AccountRecord,
} from '../lib/accounts'
import {
  bootstrapSession,
  createDefaultAppState,
  removeAccountCompletely,
  saveAppState,
} from '../lib/storage'

export interface AppStateContextValue {
  appState: AppState | null
  setAppState: Dispatch<SetStateAction<AppState | null>>
  storageReady: boolean
  needsAccount: boolean
  accounts: AccountRecord[]
  activeAccountId: string | null
  activeAccount: AccountRecord | null
  createAccount: (name: string, password: string) => Promise<void>
  switchAccount: (accountId: string, password: string) => Promise<void>
  renameAccount: (accountId: string, name: string) => void
  deleteAccount: (accountId: string, password: string) => Promise<void>
  setAccountPassword: (
    accountId: string,
    currentPassword: string | null,
    newPassword: string,
  ) => Promise<void>
  signOut: () => Promise<void>
}

const AppStateContext = createContext<AppStateContextValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [appState, setAppState] = useState<AppState | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const [needsAccount, setNeedsAccount] = useState(false)
  const [accounts, setAccounts] = useState<AccountRecord[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const appStateRef = useRef<AppState | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<number | null>(null)

  appStateRef.current = appState
  activeIdRef.current = activeAccountId

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const state = appStateRef.current
    const id = activeIdRef.current
    if (!state || !id) return
    try {
      await saveAppState(state, id)
    } catch (error) {
      console.warn('[storage] failed to flush app state', error)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    bootstrapSession().then((session) => {
      if (cancelled) return
      if (session.status === 'ready') {
        setAccounts(session.accounts)
        setActiveAccountId(session.accountId)
        setAppState(session.state)
        setNeedsAccount(false)
      } else {
        setAccounts(session.accounts)
        setActiveAccountId(null)
        setAppState(null)
        setNeedsAccount(true)
      }
      setStorageReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storageReady || !appState || !activeAccountId) return
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void saveAppState(appState, activeAccountId).catch((error) => {
        console.warn('[storage] failed to save app state', error)
      })
    }, 250)
    return () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [appState, activeAccountId, storageReady])

  const activateAccount = useCallback((accountId: string, metaAccounts: AccountRecord[]) => {
    const state = loadAccountState(accountId)
    const nextMeta = { activeId: accountId, accounts: metaAccounts }
    saveAccountsMeta(nextMeta)
    setAccounts(metaAccounts)
    setActiveAccountId(accountId)
    setAppState(state)
    setNeedsAccount(false)
  }, [])

  const createAccount = useCallback(
    async (name: string, password: string) => {
      validatePassword(password)
      const meta = loadAccountsMeta()
      const { salt, hash } = await hashPassword(password)
      const account = createAccountRecord(
        name?.trim() || defaultAccountName(meta.accounts),
        meta.accounts,
        { passwordSalt: salt, passwordHash: hash },
      )
      const state = createDefaultAppState()
      saveAccountState(account.id, state)
      const accountsNext = [...meta.accounts, account]
      activateAccount(account.id, accountsNext)
    },
    [activateAccount],
  )

  const switchAccount = useCallback(
    async (accountId: string, password: string) => {
      const meta = loadAccountsMeta()
      const account = meta.accounts.find((item) => item.id === accountId)
      if (!account) throw new AuthError('Аккаунт не найден', 'invalid')
      if (!accountHasPassword(account)) {
        throw new AuthError('Сначала задайте пароль для этого аккаунта', 'missing')
      }
      const ok = await verifyPassword(password, account.passwordSalt!, account.passwordHash!)
      if (!ok) throw new AuthError('Неверный пароль', 'invalid')
      await flushSave()
      activateAccount(accountId, meta.accounts)
    },
    [activateAccount, flushSave],
  )

  const setAccountPassword = useCallback(
    async (accountId: string, currentPassword: string | null, newPassword: string) => {
      validatePassword(newPassword)
      const meta = loadAccountsMeta()
      const account = meta.accounts.find((item) => item.id === accountId)
      if (!account) throw new AuthError('Аккаунт не найден', 'invalid')

      if (accountHasPassword(account)) {
        if (currentPassword == null) {
          throw new AuthError('Введите текущий пароль', 'missing')
        }
        const ok = await verifyPassword(
          currentPassword,
          account.passwordSalt!,
          account.passwordHash!,
        )
        if (!ok) throw new AuthError('Неверный пароль', 'invalid')
      }

      const { salt, hash } = await hashPassword(newPassword)
      const next = updateAccountPassword(accountId, {
        passwordSalt: salt,
        passwordHash: hash,
      })
      setAccounts(next.accounts)
    },
    [],
  )

  const renameAccount = useCallback((accountId: string, name: string) => {
    const meta = loadAccountsMeta()
    const nextName = sanitizeAccountName(name)
    if (!nextName) return
    const accountsNext = meta.accounts.map((item) =>
      item.id === accountId ? { ...item, name: nextName } : item,
    )
    const nextMeta = { ...meta, accounts: accountsNext }
    saveAccountsMeta(nextMeta)
    setAccounts(accountsNext)
  }, [])

  const deleteAccount = useCallback(
    async (accountId: string, password: string) => {
      const meta = loadAccountsMeta()
      const account = meta.accounts.find((item) => item.id === accountId)
      if (!account) throw new AuthError('Аккаунт не найден', 'invalid')

      if (accountHasPassword(account)) {
        const ok = await verifyPassword(password, account.passwordSalt!, account.passwordHash!)
        if (!ok) throw new AuthError('Неверный пароль', 'invalid')
      }

      const wasActive = activeIdRef.current === accountId
      if (wasActive) await flushSave()
      const nextMeta = removeAccountCompletely(accountId)
      setAccounts(nextMeta.accounts)
      if (wasActive || !nextMeta.activeId) {
        setActiveAccountId(null)
        setAppState(null)
        setNeedsAccount(true)
      } else {
        setActiveAccountId(nextMeta.activeId)
      }
    },
    [flushSave],
  )

  const signOut = useCallback(async () => {
    await flushSave()
    const meta = loadAccountsMeta()
    saveAccountsMeta({ ...meta, activeId: null })
    setActiveAccountId(null)
    setAppState(null)
    setNeedsAccount(true)
  }, [flushSave])

  const activeAccount = accounts.find((item) => item.id === activeAccountId) ?? null

  return (
    <AppStateContext.Provider
      value={{
        appState,
        setAppState,
        storageReady,
        needsAccount,
        accounts,
        activeAccountId,
        activeAccount,
        createAccount,
        switchAccount,
        renameAccount,
        deleteAccount,
        setAccountPassword,
        signOut,
      }}
    >
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppStateContext(): AppStateContextValue {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('App state hooks must be used within AppStateProvider')
  }
  return context
}

export function useAppState(): AppState | null {
  return useAppStateContext().appState
}

export function useAccounts() {
  const ctx = useAppStateContext()
  return {
    storageReady: ctx.storageReady,
    needsAccount: ctx.needsAccount,
    accounts: ctx.accounts,
    activeAccountId: ctx.activeAccountId,
    activeAccount: ctx.activeAccount,
    createAccount: ctx.createAccount,
    switchAccount: ctx.switchAccount,
    renameAccount: ctx.renameAccount,
    deleteAccount: ctx.deleteAccount,
    setAccountPassword: ctx.setAccountPassword,
    signOut: ctx.signOut,
  }
}
