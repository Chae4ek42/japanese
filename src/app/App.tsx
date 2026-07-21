import { AppHeader } from '../shared/ui/AppHeader'
import { HomePage } from '../features/home/HomePage'
import { KanaTrainer } from '../features/kana/KanaTrainer'
import { KanjiPage } from '../features/kanji/KanjiPage'
import { NumbersTrainer } from '../features/numbers/NumbersTrainer'
import { DictionaryPage } from '../features/vocab/DictionaryPage'
import { useAppRouter } from '../shared/lib/useAppRouter'
import {
  AppStateProvider,
  useAppState,
  useKanaState,
  useKanjiState,
  useNumbersState,
  useResetApp,
  useVocabState,
} from '../shared/state/AppStateContext'

function AppRoutes() {
  const appState = useAppState()
  const { page, vocabSection, goPage } = useAppRouter()
  const kana = useKanaState()
  const numbers = useNumbersState()
  const kanji = useKanjiState()
  const vocab = useVocabState()
  const resetStats = useResetApp()

  if (!appState || !kana || !numbers || !kanji || !vocab) {
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
      />

      {page === 'home' ? (
        <HomePage
          onOpenKana={() => goPage('kana')}
          onOpenKanji={() => goPage('kanji')}
          onOpenNumbers={() => goPage('numbers')}
          onOpenVocab={() => goPage('vocab', 'catalog')}
          onOpenVocabTrain={() => goPage('vocab', 'train')}
        />
      ) : page === 'kanji' ? (
        <KanjiPage
          kanjiState={{ learned: kanji.learned, preferences: kanji.preferences }}
          myWords={vocab.myWords}
          onToggleLearned={kanji.toggleLearned}
          onPatchPreferences={kanji.patchPreferences}
          onToggleMyWord={vocab.toggleMyWord}
        />
      ) : page === 'vocab' ? (
        <DictionaryPage
          myWords={vocab.myWords}
          customWords={vocab.customWords}
          preferences={vocab.preferences}
          stats={vocab.stats}
          section={vocabSection}
          onSectionChange={(section) => goPage('vocab', section)}
          onToggleMyWord={vocab.toggleMyWord}
          onAddCustomWord={vocab.addCustomWord}
          onPatchPreferences={vocab.patchPreferences}
          onUpdateStats={vocab.updateStats}
        />
      ) : (
        <main className="trainer-layout">
          {page === 'kana' ? (
            <KanaTrainer
              preferences={kana.preferences}
              stats={kana.stats}
              onPatchPreferences={kana.patchPreferences}
              onPatchHyperparam={kana.patchHyperparam}
              onPracticeUpdate={kana.updatePractice}
            />
          ) : (
            <NumbersTrainer
              numbersState={{ preferences: numbers.preferences, stats: numbers.stats }}
              onPatchPreferences={numbers.patchPreferences}
              onUpdateStats={numbers.updateStats}
            />
          )}
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
