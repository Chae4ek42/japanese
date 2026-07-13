import { useEffect, useState } from 'react'
import './App.css'
import { updateCardStats } from './lib/trainer'
import {
  bootstrapAppState,
  createDefaultAppState,
  isRemoteStorageEnabled,
  resetStoredState,
  saveAppState,
} from './lib/storage'
import { NumbersTrainer } from './components/NumbersTrainer'
import { NUMBER_HYPERPARAMS, ensureNumberStats } from './data/numbers'

function App() {
  const [appState, setAppState] = useState(null)
  const [storageReady, setStorageReady] = useState(false)
  const [remoteStorage, setRemoteStorage] = useState(false)

  useEffect(() => {
    let cancelled = false
    bootstrapAppState().then((state) => {
      if (cancelled) {
        return
      }
      setAppState(state)
      setRemoteStorage(isRemoteStorageEnabled())
      setStorageReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storageReady || !appState) {
      return
    }
    saveAppState(appState)
  }, [appState, storageReady])

  function patchNumbersPreferences(patch) {
    setAppState((prevState) => ({
      ...prevState,
      numbers: {
        ...prevState.numbers,
        preferences: {
          ...prevState.numbers.preferences,
          ...patch,
        },
      },
    }))
  }

  function updateNumberStats(cardId, outcome, context) {
    setAppState((prevState) => ({
      ...prevState,
      numbers: {
        ...prevState.numbers,
        stats: {
          ...prevState.numbers.stats,
          [cardId]: updateCardStats(
            ensureNumberStats(prevState.numbers.stats, cardId),
            outcome,
            context,
            NUMBER_HYPERPARAMS,
          ),
        },
      },
    }))
  }

  async function resetStats() {
    await resetStoredState()
    setAppState(createDefaultAppState())
    setRemoteStorage(isRemoteStorageEnabled())
  }

  if (!appState) {
    return (
      <div className="app-shell app-loading">
        <p>Загрузка прогресса…</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Японские числа</h1>
          <p className="subtitle">
            {remoteStorage ? 'Прогресс сохраняется в PostgreSQL. ' : ''}
            Вспомните чтение — пробел покажет кандзи и кану, ещё раз — следующее число.
          </p>
        </div>
        <button type="button" className="text-button" data-testid="reset-stats" onClick={resetStats}>
          Сбросить прогресс
        </button>
      </header>

      <main className="trainer-layout">
        <NumbersTrainer
          numbersState={appState.numbers}
          onPatchPreferences={patchNumbersPreferences}
          onUpdateStats={updateNumberStats}
        />
      </main>
    </div>
  )
}

export default App
