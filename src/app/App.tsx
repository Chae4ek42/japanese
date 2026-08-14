import { useEffect } from 'react'
import { AppHeader } from '../shared/ui/AppHeader'
import { HomePage } from '../features/home/HomePage'
import { KanaTrainer } from '../features/kana/KanaTrainer'
import { KanjiPage } from '../features/kanji/KanjiPage'
import { NumbersTrainer } from '../features/numbers/NumbersTrainer'
import { ParticlesTrainer } from '../features/particles/ParticlesTrainer'
import { VerbsTrainer } from '../features/verbs/VerbsTrainer'
import { TextReaderPage } from '../features/reader/TextReaderPage'
import { DictionaryPage } from '../features/vocab/DictionaryPage'
import { MineWordsPage } from '../features/vocab/MineWordsPage'
import { TrainPage } from '../features/vocab/TrainPage'
import { TheoryPage } from '../features/theory/TheoryPage'
import { AnalyticsPage } from '../features/analytics/AnalyticsPage'
import { AccountGate } from '../features/accounts/AccountGate'
import { useAppRouter } from '../shared/lib/useAppRouter'
import { useActiveTimeTracker } from '../shared/lib/useActiveTimeTracker'
import type { AppPage } from '../shared/lib/types'
import {
  AppStateProvider,
  useAccounts,
  useAnalyticsState,
  useAppState,
} from '../shared/state/AppStateContext'
import { useBackupApp } from '../shared/state/backup'

function AppPageView({ page, onNavigate }: { page: AppPage; onNavigate: (page: AppPage) => void }) {
  switch (page) {
    case 'home':
      return <HomePage onNavigate={onNavigate} />
    case 'kanji':
      return <KanjiPage />
    case 'train':
      return <TrainPage />
    case 'vocab':
      return <DictionaryPage />
    case 'mine':
      return <MineWordsPage />
    case 'theory':
      return <TheoryPage onOpenTrain={() => onNavigate('train')} onOpenPage={onNavigate} />
    case 'analytics':
      return <AnalyticsPage />
    case 'reader':
      return <TextReaderPage onNavigate={onNavigate} />
    case 'kana':
      return (
        <main className="trainer-layout">
          <KanaTrainer />
        </main>
      )
    case 'numbers':
      return (
        <main className="trainer-layout">
          <NumbersTrainer />
        </main>
      )
    case 'particles':
      return (
        <main className="trainer-layout">
          <ParticlesTrainer />
        </main>
      )
    case 'verbs':
      return (
        <main className="trainer-layout">
          <VerbsTrainer />
        </main>
      )
    default:
      return <HomePage onNavigate={onNavigate} />
  }
}

function AppRoutes() {
  const appState = useAppState()
  const { storageReady, needsAccount } = useAccounts()
  const { page, goPage } = useAppRouter()
  const { exportBackup, openImportPicker, fileInputRef, onImportFileChange, canExport } = useBackupApp()
  const { applyActiveDeltas } = useAnalyticsState()

  useActiveTimeTracker({
    page,
    enabled: Boolean(appState) && page !== 'accounts',
    onFlush: applyActiveDeltas,
  })

  useEffect(() => {
    if (!storageReady) return
    if (needsAccount && page !== 'accounts') {
      goPage('accounts', { replace: true })
    }
  }, [storageReady, needsAccount, page, goPage])

  if (!storageReady) {
    return (
      <div className="app-shell app-loading">
        <p>Загрузка…</p>
      </div>
    )
  }

  if (needsAccount || page === 'accounts') {
    return (
      <div className="app-shell">
        <AccountGate
          onEntered={() => goPage('home')}
          onCancel={needsAccount ? undefined : () => goPage('home')}
        />
      </div>
    )
  }

  if (!appState) {
    return (
      <div className="app-shell">
        <AccountGate onEntered={() => goPage('home')} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <AppHeader
        currentPage={page}
        onNavigate={goPage}
        onExportBackup={canExport ? exportBackup : undefined}
        onImportBackup={openImportPicker}
        importInputRef={fileInputRef}
        onImportFileChange={onImportFileChange}
      />
      <AppPageView page={page} onNavigate={goPage} />
    </div>
  )
}

function App() {
  return (
    <AppStateProvider>
      <AppRoutes />
    </AppStateProvider>
  )
}

export default App
