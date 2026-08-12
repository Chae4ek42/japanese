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
import { AuthError, validatePassword } from '../lib/account-auth'
import {
  accountHasPassword,
  defaultAccountName,
  sanitizeAccountName,
  type AccountRecord,
} from '../lib/accounts'
import {
  createAccountRemote,
  deleteAccountRemote,
  fetchAccountState,
  listAccounts,
  loginAccountRemote,
  logoutRemote,
  renameAccountRemote,
  setPasswordRemote,
} from '../lib/accounts-api'
import { clearClientSession, loadClientSession } from '../lib/session'
import {
  bootstrapSession,
  createDefaultAppState,
  parseStoredState,
  pickRicherStateJson,
  readLocalDraft,
  SAVE_MIN_INTERVAL_MS,
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
  bootstrapError: string | null
  createAccount: (name: string, password: string) => Promise<void>
  switchAccount: (accountId: string, password: string) => Promise<void>
  renameAccount: (accountId: string, name: string) => Promise<void>
  deleteAccount: (accountId: string, password: string) => Promise<void>
  setAccountPassword: (
    accountId: string,
    currentPassword: string | null,
    newPassword: string,
  ) => Promise<void>
  signOut: () => Promise<void>
  refreshAccounts: () => Promise<void>
}

const AppStateContext = createContext<AppStateContextValue | null>(null)

/** Debounce before attempting a server sync (also gated by SAVE_MIN_INTERVAL_MS). */
const SAVE_DEBOUNCE_MS = 15_000

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [appState, setAppState] = useState<AppState | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const [needsAccount, setNeedsAccount] = useState(false)
  const [accounts, setAccounts] = useState<AccountRecord[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const appStateRef = useRef<AppState | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<number | null>(null)

  appStateRef.current = appState
  activeIdRef.current = activeAccountId

  const runSave = useCallback(async (force = false) => {
    const state = appStateRef.current
    const id = activeIdRef.current
    if (!state || !id) return
    try {
      const result = await saveAppState(state, id, force ? { force: true } : undefined)
      if (result === 'draft-only') {
        if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = window.setTimeout(() => {
          saveTimerRef.current = null
          void runSave(false)
        }, SAVE_MIN_INTERVAL_MS)
      }
    } catch (error) {
      console.warn('[storage] failed to flush app state', error)
    }
  }, [])

  const flushSave = useCallback(
    async (force = false) => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      await runSave(force)
    },
    [runSave],
  )

  useEffect(() => {
    let cancelled = false
    bootstrapSession().then((session) => {
      if (cancelled) return
      if (session.status === 'ready') {
        setAccounts(session.accounts)
        setActiveAccountId(session.accountId)
        setAppState(session.state)
        setNeedsAccount(false)
        setBootstrapError(null)
      } else {
        setAccounts(session.accounts)
        setActiveAccountId(null)
        setAppState(null)
        setNeedsAccount(true)
        setBootstrapError(session.error ?? null)
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
      void runSave(false)
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [appState, activeAccountId, storageReady, runSave])

  useEffect(() => {
    const onHide = () => {
      void flushSave(true)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flushSave])

  const activateFromAuth = useCallback(async (accountId: string, nextAccounts: AccountRecord[]) => {
    let state = createDefaultAppState()
    try {
      const raw = await fetchAccountState(accountId)
      const draft = readLocalDraft(accountId)
      state = parseStoredState(pickRicherStateJson(raw, draft))
    } catch {
      const draft = readLocalDraft(accountId)
      state = draft ? parseStoredState(draft) : createDefaultAppState()
    }
    setAccounts(nextAccounts)
    setActiveAccountId(accountId)
    setAppState(state)
    setNeedsAccount(false)
    setBootstrapError(null)
  }, [])

  const createAccount = useCallback(
    async (name: string, password: string) => {
      validatePassword(password)
      const result = await createAccountRemote(
        name?.trim() || defaultAccountName(accounts),
        password,
      )
      const state = createDefaultAppState()
      await saveAppState(state, result.session.accountId)
      setAccounts(result.accounts)
      setActiveAccountId(result.session.accountId)
      setAppState(state)
      setNeedsAccount(false)
      setBootstrapError(null)
    },
    [accounts],
  )

  const switchAccount = useCallback(
    async (accountId: string, password: string) => {
      const account = accounts.find((item) => item.id === accountId)
      if (!account) throw new AuthError('Аккаунт не найден', 'invalid')
      if (!accountHasPassword(account)) {
        throw new AuthError('Сначала задайте пароль для этого аккаунта', 'missing')
      }
      await flushSave()
      const prev = loadClientSession()
      if (prev && prev.accountId !== accountId) {
        await logoutRemote()
      }
      const result = await loginAccountRemote(accountId, password)
      await activateFromAuth(result.session.accountId, result.accounts)
    },
    [accounts, activateFromAuth, flushSave],
  )

  const setAccountPassword = useCallback(
    async (accountId: string, currentPassword: string | null, newPassword: string) => {
      validatePassword(newPassword)
      await flushSave()
      const result = await setPasswordRemote(accountId, currentPassword, newPassword)
      await activateFromAuth(result.session.accountId, result.accounts)
    },
    [activateFromAuth, flushSave],
  )

  const renameAccount = useCallback(async (accountId: string, name: string) => {
    const nextName = sanitizeAccountName(name)
    if (!nextName) return
    const next = await renameAccountRemote(accountId, nextName)
    setAccounts(next)
  }, [])

  const deleteAccount = useCallback(
    async (accountId: string, password: string) => {
      const wasActive = activeIdRef.current === accountId
      if (wasActive) await flushSave()
      const next = await deleteAccountRemote(accountId, password)
      setAccounts(next)
      if (wasActive) {
        clearClientSession()
        setActiveAccountId(null)
        setAppState(null)
        setNeedsAccount(true)
      }
    },
    [flushSave],
  )

  const signOut = useCallback(async () => {
    await flushSave()
    await logoutRemote()
    setActiveAccountId(null)
    setAppState(null)
    setNeedsAccount(true)
  }, [flushSave])

  const refreshAccounts = useCallback(async () => {
    try {
      const next = await listAccounts()
      setAccounts(next)
      setBootstrapError(null)
    } catch (error) {
      setBootstrapError(error instanceof Error ? error.message : 'Ошибка загрузки')
    }
  }, [])

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
        bootstrapError,
        createAccount,
        switchAccount,
        renameAccount,
        deleteAccount,
        setAccountPassword,
        signOut,
        refreshAccounts,
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
    bootstrapError: ctx.bootstrapError,
    createAccount: ctx.createAccount,
    switchAccount: ctx.switchAccount,
    renameAccount: ctx.renameAccount,
    deleteAccount: ctx.deleteAccount,
    setAccountPassword: ctx.setAccountPassword,
    signOut: ctx.signOut,
    refreshAccounts: ctx.refreshAccounts,
  }
}
