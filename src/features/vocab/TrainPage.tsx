import { useState } from 'react'
import './styles.css'
import { DEFAULT_VOCAB_PREFERENCES } from '../../shared/state/app-state'
import { useVocabState } from '../../shared/state/AppStateContext'
import { PARTICLES_CHEAT_SHEET, VERB_FORMS_CHEAT_SHEET } from '../../data/cheatSheets'
import {
  CheatSheetActions,
  CheatSheetPopup,
  CheatSheetTrigger,
} from '../../shared/ui/CheatSheetPopup'
import { KanjiInfoCard } from '../kanji/KanjiInfoCard'
import { VocabTrainer } from './VocabTrainer'

export function TrainPage() {
  const vocab = useVocabState()
  const [infoKanji, setInfoKanji] = useState<string | null>(null)
  const [cheatSheet, setCheatSheet] = useState<'particles' | 'verbs' | null>(null)

  if (!vocab) return null

  return (
    <main className="vocab-page train-page" data-testid="train-page">
      <header className="section-heading vocab-page-head">
        <div>
          <h2>Тренажёр слов</h2>
        </div>
        <CheatSheetActions>
          <CheatSheetTrigger
            label="Шпаргалка: частицы"
            testId="train-open-particles-cheatsheet"
            onClick={() => setCheatSheet('particles')}
          />
          <CheatSheetTrigger
            label="Шпаргалка: глаголы"
            testId="train-open-verbs-cheatsheet"
            onClick={() => setCheatSheet('verbs')}
          />
        </CheatSheetActions>
      </header>

      <VocabTrainer
        preferences={vocab.preferences ?? DEFAULT_VOCAB_PREFERENCES}
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
        listTrainingWordIds={vocab.listTrainingWordIds}
        trainingSets={vocab.trainingSets}
        problemWordIds={vocab.problemWordIds}
        liveSession={vocab.liveSession}
        onSaveLiveSession={vocab.saveLiveSession}
        onPatchPreferences={vocab.patchPreferences}
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

      {cheatSheet === 'particles' ? (
        <CheatSheetPopup doc={PARTICLES_CHEAT_SHEET} onClose={() => setCheatSheet(null)} />
      ) : null}
      {cheatSheet === 'verbs' ? (
        <CheatSheetPopup doc={VERB_FORMS_CHEAT_SHEET} onClose={() => setCheatSheet(null)} />
      ) : null}
    </main>
  )
}
