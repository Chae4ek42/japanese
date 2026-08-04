import { AppHeader } from '../shared/ui/AppHeader'
import { HomePage } from '../features/home/HomePage'
import { KanaTrainer } from '../features/kana/KanaTrainer'
import { KanjiPage } from '../features/kanji/KanjiPage'
import { NumbersTrainer } from '../features/numbers/NumbersTrainer'
import { DictionaryPage } from '../features/vocab/DictionaryPage'
import { TrainPage } from '../features/vocab/TrainPage'
import { ContextPage } from '../features/context/ContextPage'
import { useAppRouter } from '../shared/lib/useAppRouter'
import { AppStateProvider, useAppState, useResetApp } from '../shared/state/AppStateContext'
import { useBackupApp } from '../shared/state/backup'

function AppRoutes() {
  const appState = useAppState()
  const { page, goPage } = useAppRouter()
  const resetStats = useResetApp()
  const { exportBackup, openImportPicker, fileInputRef, onImportFileChange, canExport } = useBackupApp()

  if (!appState) {
    return (
      <div className="app-shell app-loading">
        <p>Загрузка…</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <AppHeader
        currentPage={page}
        onNavigate={(nextPage) => goPage(nextPage, nextPage === 'vocab' ? 'catalog' : undefined)}
        onResetStats={resetStats}
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
          onOpenVocab={() => goPage('vocab', 'catalog')}
          onOpenVocabTrain={() => goPage('train')}
          onOpenContext={() => goPage('context')}
        />
      ) : page === 'kanji' ? (
        <KanjiPage />
      ) : page === 'train' ? (
        <TrainPage />
      ) : page === 'vocab' ? (
        <DictionaryPage />
      ) : page === 'context' ? (
        <ContextPage />
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
