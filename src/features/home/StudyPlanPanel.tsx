import { useState } from 'react'
import type { AppPage } from '../../shared/lib/types'
import { studyPlanOptions, studyStepProgress, type StudyMinutes, type StudyPlanStep } from '../../shared/lib/studyPlan'
import { useStudyPlan } from '../../shared/state/study-plan-slice'
import { requestTargetedPractice } from '../../shared/lib/targetedPractice'
import { requestTheoryLesson } from '../theory/theoryNavigation'

export function StudyPlanPanel({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const { appState, plan, start, finish, replace } = useStudyPlan()
  const [minutes, setMinutes] = useState<StudyMinutes>(5)
  if (!appState) return null
  const next = plan?.steps.find((step) => step.status === 'pending')
  const done = plan?.steps.filter((step) => step.status === 'done').length ?? 0
  const skipped = plan?.steps.filter((step) => step.status === 'skipped').length ?? 0
  const options = studyPlanOptions(appState, plan?.minutes ?? minutes)
  function open(step: StudyPlanStep) {
    if (step.kind === 'theory') requestTheoryLesson(step.targetIds[0])
    if (step.kind === 'practice' && step.targetIds.length) {
      if (step.page === 'train') requestTargetedPractice({ section: 'vocab', cardIds: step.targetIds })
      if (step.page === 'kana' || step.page === 'numbers') requestTargetedPractice({ section: step.page, cardIds: step.targetIds })
    }
    onNavigate(step.page)
  }
  return (
    <section className="study-plan" aria-label="Короткое занятие" data-testid="home-study-plan">
      <div className="study-plan-heading">
        <h2>Короткое занятие</h2>
        {plan ? <span>{done}/{plan.steps.length}{skipped ? ` · пропущено ${skipped}` : ''}</span> : null}
      </div>
      {!plan ? <>
        <p>Немного практики и один урок.</p>
        <div className="study-plan-actions">
          <label className="study-plan-time">Около <select aria-label="Длительность занятия" value={minutes} onChange={(event) => setMinutes(Number(event.target.value) as StudyMinutes)}>
            {[5, 10, 20].map((value) => <option key={value} value={value}>{value} минут</option>)}
          </select></label>
          <button className="study-plan-primary" type="button" onClick={() => start(minutes)}>Составить занятие</button>
        </div>
      </> : <>
        {next ? <>
          <div className="study-plan-next"><span>Дальше</span><strong>{next.title}</strong></div>
          <p>{next.reason}</p>
          <button className="study-plan-primary" type="button" onClick={() => open(next)}>Продолжить →</button>
        </> : <p className="study-plan-result">{skipped ? `Занятие закрыто: выполнено ${done}, пропущено ${skipped}.` : 'Занятие завершено.'}</p>}
        <details className="study-plan-details">
          <summary>План · около {plan.minutes} минут</summary>
          <p>Время примерное. После задания вернитесь сюда. Ответы и проверки учитываются автоматически; тренажёр можно продолжать дальше.</p>
          <ol>
            {plan.steps.map((step) => <li key={step.id}>
              <strong>{step.title}</strong>
              <span className="study-plan-status">{step.status === 'done'
                ? step.completion === 'measured' ? 'Выполнено по результатам' : 'Отмечено вами'
                : step.status === 'skipped' ? 'Пропущено' : `${studyStepProgress(step, appState)}/${step.goal} · ${step.kind === 'theory' ? 'проверок' : step.kind === 'reader' ? 'новых примеров' : 'ответов'}`}</span>
              {step.status === 'pending' ? <>
                <p>{step.reason}</p>
                <div className="study-plan-step-actions">
                  <button type="button" onClick={() => open(step)}>Открыть</button>
                  <button type="button" onClick={() => finish(step.id)}>Отметить выполненным</button>
                  <button type="button" onClick={() => finish(step.id, true)}>Пропустить</button>
                  <select aria-label={`Заменить: ${step.title}`} value="" onChange={(event) => replace(step.id, event.target.value)}>
                    <option value="" disabled>Заменить…</option>
                    {options.filter((option) => !plan.steps.some((existing) => existing.id === option.id)).map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
                  </select>
                </div>
              </> : null}
            </li>)}
          </ol>
          <div className="study-plan-actions">
            <label className="study-plan-time">Новое занятие <select aria-label="Длительность нового занятия" value={minutes} onChange={(event) => setMinutes(Number(event.target.value) as StudyMinutes)}>
              {[5, 10, 20].map((value) => <option key={value} value={value}>{value} минут</option>)}
            </select></label>
            <button type="button" onClick={() => start(minutes)}>{next ? 'Заменить весь план' : 'Составить новый'}</button>
          </div>
        </details>
      </>}
    </section>
  )
}
