import { useCallback, useEffect, useRef, useState } from 'react'
import './styles.css'
import type { CardTrainerLiveSession, VocabPreferences } from '../../shared/lib/types'
import { readTargetedPractice } from '../../shared/lib/targetedPractice'
import { getTrainingSetWordIds, resolveActiveTrainingSetId } from '../../shared/lib/trainingSets'
import { useVocabState } from '../../shared/state/AppStateContext'
import { useVocabSessions } from '../../shared/state/vocab-sessions-slice'
import { KanjiInfoCard } from '../kanji/KanjiInfoCard'
import { AUTOSTART_TRAIN_KEY } from './autostart'
import { VocabSessionManager } from './VocabSessionManager'
import { VocabTrainer } from './VocabTrainer'

export function TrainPage() {
  const vocab = useVocabState()
  const { sessions, createSession, selectSession, renameSession, deleteSession, saveSessionLive, patchSessionPreferences } = useVocabSessions()
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [infoKanji, setInfoKanji] = useState<string | null>(null)
  const incomingHandledRef = useRef(false)

  useEffect(() => {
    if (!vocab || incomingHandledRef.current) return
    incomingHandledRef.current = true
    const target = readTargetedPractice('vocab')
    let autostart = false
    try { autostart = sessionStorage.getItem(AUTOSTART_TRAIN_KEY) === '1' } catch { /* Storage may be disabled. */ }
    if (!target && !autostart) return
    const id = createSession(vocab.preferences, target ? 'Практика выбранных слов' : 'Тренировка из библиотеки')
    setOpenedId(id)
  }, [vocab, createSession])

  const saveLiveSession = useCallback((live: CardTrainerLiveSession | null) => {
    if (openedId) saveSessionLive(openedId, live)
  }, [openedId, saveSessionLive])
  const patchPreferences = useCallback((patch: Partial<VocabPreferences>) => {
    if (openedId) patchSessionPreferences(openedId, patch)
  }, [openedId, patchSessionPreferences])

  if (!vocab) return null
  const activeSession = sessions.find((session) => session.id === openedId)

  return (
    <main className="vocab-page train-page" data-testid="train-page">
      <header className="section-heading vocab-page-head">
        <div>
          <h2>Тренажёр слов</h2>
        </div>
      </header>

      {activeSession ? <>
      <div className="vocab-session-current">
        <button className="vocab-session-back" data-testid="vocab-sessions-back" type="button" onClick={() => { setOpenedId(null); setInfoKanji(null); selectSession(null) }}>← Все тренировки</button>
        <strong>{activeSession.name}</strong>
      </div>
      <VocabTrainer
        key={activeSession.id}
        preferences={activeSession.preferences}
        stats={vocab.stats}
        memory={vocab.memory}
        latencyModel={vocab.latencyModel}
        reviewDay={vocab.reviewDay}
        myWords={vocab.myWords}
        myWordAddedAt={vocab.myWordAddedAt}
        customWords={vocab.customWords}
        hiddenWordIds={vocab.hiddenWordIds}
        learnedWordIds={vocab.learnedWordIds}
        trainingWordIds={vocab.trainingWordIds}
        listTrainingWordIds={getTrainingSetWordIds(vocab.trainingSets, resolveActiveTrainingSetId(activeSession.preferences.trainingSetId, vocab.trainingSets))}
        trainingSets={vocab.trainingSets}
        problemWordIds={vocab.problemWordIds}
        liveSession={activeSession.liveSession}
        onSaveLiveSession={saveLiveSession}
        onPause={() => { setOpenedId(null); setInfoKanji(null); selectSession(null) }}
        onPatchPreferences={patchPreferences}
        onUpdateStats={vocab.updateStats}
        onApplyGradedReview={vocab.applyGradedReview}
        onAddMyWords={vocab.addMyWords}
        onAddTrainingWords={vocab.addTrainingWords}
        onRemoveTrainingWords={vocab.removeTrainingWords}
        onSaveWordEdit={vocab.saveWordEdit}
        onHideWords={vocab.hideWords}
        onToggleLearnedWords={vocab.toggleLearnedWords}
        onAddProblemWords={vocab.addProblemWords}
        onRemoveProblemWords={vocab.removeProblemWords}
        onOpenKanjiInfo={setInfoKanji}
      />
      </> : <VocabSessionManager
        sessions={sessions}
        trainingSets={vocab.trainingSets}
        onCreate={() => setOpenedId(createSession())}
        onOpen={(id) => { selectSession(id); setOpenedId(id) }}
        onRename={renameSession}
        onDelete={deleteSession}
      />}

      {infoKanji ? (
        <KanjiInfoCard
          character={infoKanji}
          myWords={vocab.myWords}
          trainingWordIds={vocab.trainingWordIds}
          onClose={() => setInfoKanji(null)}
          onToggleMyWord={vocab.toggleMyWord}
          onToggleTrainingWord={(id) => vocab.toggleTrainingWord(id)}
        />
      ) : null}
    </main>
  )
}
