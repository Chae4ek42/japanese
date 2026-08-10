import { useEffect } from 'react'
import { AppHeader } from '../shared/ui/AppHeader'
import { HomePage } from '../features/home/HomePage'
import { KanaTrainer } from '../features/kana/KanaTrainer'
import { KanjiPage } from '../features/kanji/KanjiPage'
import { NumbersTrainer } from '../features/numbers/NumbersTrainer'
import { DictionaryPage } from '../features/vocab/DictionaryPage'
import { MineWordsPage } from '../features/vocab/MineWordsPage'
import { TrainPage } from '../features/vocab/TrainPage'
import { TheoryPage } from '../features/theory/TheoryPage'
import { AnalyticsPage } from '../features/analytics/AnalyticsPage'
import { AccountGate } from '../features/accounts/AccountGate'
import { useAppRouter } from '../shared/lib/useAppRouter'
import { useActiveTimeTracker } from '../shared/lib/useActiveTimeTracker'
import {
  AppStateProvider,
  useAccounts,
  useAnalyticsState,
  useAppState,
} from '../shared/state/AppStateContext'
import { useBackupApp } from '../shared/state/backup'

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

      {page === 'home' ? (
        <HomePage
          onOpenKana={() => goPage('kana')}
          onOpenKanji={() => goPage('kanji')}
          onOpenNumbers={() => goPage('numbers')}
          onOpenVocab={() => goPage('vocab')}
          onOpenMine={() => goPage('mine')}
          onOpenVocabTrain={() => goPage('train')}
          onOpenTheory={() => goPage('theory')}
          onOpenAnalytics={() => goPage('analytics')}
        />
      ) : page === 'kanji' ? (
        <KanjiPage />
      ) : page === 'train' ? (
        <TrainPage />
      ) : page === 'vocab' ? (
        <DictionaryPage />
      ) : page === 'mine' ? (
        <MineWordsPage />
      ) : page === 'theory' ? (
        <TheoryPage onOpenTrain={() => goPage('train')} />
      ) : page === 'analytics' ? (
        <AnalyticsPage />
      ) : (
        <main className="trainer-layout">
          {page === 'kana' ? <KanaTrainer /> : <NumbersTrainer />}
        </main>
      )}
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
