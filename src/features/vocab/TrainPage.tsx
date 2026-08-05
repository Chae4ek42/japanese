import { useState } from 'react'
import './styles.css'
import { DEFAULT_VOCAB_PREFERENCES } from '../../shared/state/app-state'
import { useVocabState } from '../../shared/state/AppStateContext'
import { KanjiInfoCard } from '../kanji/KanjiInfoCard'
import { VocabTrainer } from './VocabTrainer'

export function TrainPage() {
  const vocab = useVocabState()
  const [infoKanji, setInfoKanji] = useState<string | null>(null)

  if (!vocab) return null

  return (
    <main className="vocab-page train-page" data-testid="train-page">
      <header className="section-heading vocab-page-head">
        <h2>Тренажёр слов</h2>
      </header>

      <VocabTrainer
        preferences={vocab.preferences ?? DEFAULT_VOCAB_PREFERENCES}
        stats={vocab.stats}
        memory={vocab.memory}
        latencyModel={vocab.latencyModel}
        reviewDay={vocab.reviewDay}
        myWords={vocab.myWords}
        customWords={vocab.customWords}
        hiddenWordIds={vocab.hiddenWordIds}
        learnedWordIds={vocab.learnedWordIds}
        trainingWordIds={vocab.trainingWordIds}
        problemWordIds={vocab.problemWordIds}
        liveSession={vocab.liveSession}
        onSaveLiveSession={vocab.saveLiveSession}
        onPatchPreferences={vocab.patchPreferences}
        onUpdateStats={vocab.updateStats}
        onApplyGradedReview={vocab.applyGradedReview}
        onAddMyWords={vocab.addMyWords}
        onRemoveTrainingWords={vocab.removeTrainingWords}
        onSaveWordEdit={vocab.saveWordEdit}
        onHideWords={vocab.hideWords}
        onToggleLearnedWords={vocab.toggleLearnedWords}
        onAddProblemWords={vocab.addProblemWords}
        onRemoveProblemWords={vocab.removeProblemWords}
        onOpenKanjiInfo={setInfoKanji}
      />

      {infoKanji ? (
        <KanjiInfoCard
          character={infoKanji}
          myWords={vocab.myWords}
          trainingWordIds={vocab.trainingWordIds}
          onClose={() => setInfoKanji(null)}
          onToggleMyWord={vocab.toggleMyWord}
          onToggleTrainingWord={vocab.toggleTrainingWord}
        />
      ) : null}
    </main>
  )
}
