import type { ContextPreferences, ContextState, ContextTrainingLogEntry } from '../../shared/lib/types'
import { VOCAB_GROUPS, getWordsForGroup } from '../vocab/groups'
import { GRAMMAR_CATALOG } from './grammar'
import { groupCoverage } from './picker'

export interface ContextSetupProps {
  context: ContextState
  onPatchPreferences: (patch: Partial<ContextPreferences>) => void
  onToggleGrammar: (grammarId: string) => void
  onContinue: () => void
  onStartFresh: () => void
}

function formatLogDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function logOutcomeLabel(entry: ContextTrainingLogEntry): string {
  if (entry.outcome === 'completed') return 'завершена'
  if (entry.outcome === 'abandoned') return 'прервана'
  return 'в процессе'
}

export function ContextSetup({
  context,
  onPatchPreferences,
  onToggleGrammar,
  onContinue,
  onStartFresh,
}: ContextSetupProps) {
  const groupId = context.preferences.groupId
  const batchSize = context.preferences.batchSize
  const maxNew = context.preferences.maxNewPerSentence
  const coverage = groupCoverage(getWordsForGroup(groupId), context.knownWordIds)
  const canStart = coverage.known < coverage.total && coverage.total > 0
  const hasActiveSession = context.session?.status === 'active'
  const recentLog = [...context.trainingLog].reverse().slice(0, 8)

  return (
    <section className="context-setup" data-testid="context-setup">
      <header className="context-hero">
        <p className="context-eyebrow">Контекст</p>
        <h2 className="context-title">Учите слова в предложениях</h2>
        <p className="context-lead">
          Новые слова идут пакетом; в одном предложении — не больше выбранного числа новых. Грамматика и тема
          задают, какие фразы можно показывать.
        </p>
      </header>

      <div>
        <h3>Тема</h3>
        <div className="context-group-grid">
          {VOCAB_GROUPS.map((group) => {
            const words = getWordsForGroup(group.id)
            const cov = groupCoverage(words, context.knownWordIds)
            return (
              <button
                key={group.id}
                type="button"
                className={group.id === groupId ? 'context-group-button is-active' : 'context-group-button'}
                data-testid={`context-group-${group.id}`}
                onClick={() => onPatchPreferences({ groupId: group.id })}
              >
                <span className="context-group-label">{group.label}</span>
                <span className="context-group-meta">
                  {cov.known}/{cov.total}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="context-pref-row">
        <label className="context-number-field">
          <span>Новых слов в пакете</span>
          <input
            type="number"
            min={1}
            max={5}
            data-testid="context-batch-size"
            value={batchSize}
            onChange={(event) => {
              const next = Math.min(5, Math.max(1, Number(event.target.value) || 1))
              onPatchPreferences({
                batchSize: next,
                maxNewPerSentence: Math.min(context.preferences.maxNewPerSentence, next),
              })
            }}
          />
        </label>
        <label className="context-number-field">
          <span>Новых в одном предложении</span>
          <input
            type="number"
            min={1}
            max={batchSize}
            data-testid="context-max-new"
            value={Math.min(maxNew, batchSize)}
            onChange={(event) => {
              const next = Math.min(batchSize, Math.max(1, Number(event.target.value) || 1))
              onPatchPreferences({ maxNewPerSentence: next })
            }}
          />
        </label>
      </div>
      <p className="subsection-note">
        Пакет — сколько незнакомых слов держать в работе сразу. «В предложении» — сколько новых слов темы
        может встретиться сразу (1 = классический i+1, 2+ = более плотные фразы).
      </p>

      <div>
        <h3>Грамматика</h3>
        <p className="subsection-note">Вкл. = уже знакомо и можно использовать в предложениях.</p>
        <div className="context-grammar" data-testid="context-grammar">
          {GRAMMAR_CATALOG.map((item) => {
            const on = context.knownGrammarIds.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                className={on ? 'context-grammar-chip is-on' : 'context-grammar-chip'}
                data-testid={`context-grammar-${item.id}`}
                title={item.labelRu}
                onClick={() => onToggleGrammar(item.id)}
              >
                {item.cue}
              </button>
            )
          })}
        </div>
      </div>

      <label className="kanji-filter-toggle">
        <input
          type="checkbox"
          data-testid="context-allow-new-grammar"
          checked={context.preferences.allowOneNewGrammar}
          onChange={(event) => onPatchPreferences({ allowOneNewGrammar: event.target.checked })}
        />
        Разрешить одну новую грамматику в предложении
      </label>

      <div className="context-setup-actions">
        <p className="context-progress" data-testid="context-setup-coverage">
          В теме: {coverage.known} / {coverage.total} известных
        </p>
        <div className="context-setup-buttons">
          {hasActiveSession ? (
            <button
              type="button"
              className="primary-button"
              data-testid="context-continue"
              onClick={onContinue}
            >
              Продолжить
            </button>
          ) : null}
          <button
            type="button"
            className={hasActiveSession ? 'ghost-button' : 'primary-button'}
            data-testid="context-start"
            disabled={!canStart}
            onClick={onStartFresh}
          >
            {hasActiveSession ? 'Новая тренировка' : 'Начать тренировку'}
          </button>
        </div>
      </div>

      {recentLog.length ? (
        <div className="context-log" data-testid="context-training-log">
          <h3>Недавние тренировки</h3>
          <ul className="context-log-list">
            {recentLog.map((entry) => {
              const theme = VOCAB_GROUPS.find((group) => group.id === entry.groupId)?.label ?? entry.groupId
              return (
                <li key={entry.id}>
                  <span className="context-log-date">{formatLogDate(entry.startedAt)}</span>
                  <span className="context-log-theme">{theme}</span>
                  <span className="context-log-meta">
                    {entry.wordsLearnedIds.length} слов · {entry.sentencesSeen} фраз · {logOutcomeLabel(entry)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
