import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { getComponent, getKanjiInfo, getPopularWordsForKanji, POPULAR_WORDS_PER_KANJI } from '../../data/words/bank'
import { formatKanjiReadings } from '../../shared/lib/format'
import { useIsMobileTouch } from '../../shared/lib/media'
import { speakJapanese, speakKanjiReadings } from '../../shared/lib/speech'
import { mergeWordsByWriting, wordVariantIds } from '../vocab/mergeHomographs'
import { HighlightedReading } from './HighlightedReading'
import { KanjiComposition } from './KanjiComposition'
import { KanjiGlyph } from './KanjiGlyph'

export interface KanjiInfoCardProps {
  character: string
  learned?: boolean
  myWords?: string[]
  trainingWordIds?: string[]
  onClose: () => void
  onToggleLearned?: (character: string) => void
  onToggleMyWord?: (wordId: string) => void
  onToggleTrainingWord?: (wordId: string) => void
  onStartPractice?: (character: string) => void
}

const INFO_TABS = [
  { id: 'overview', label: 'Знак' },
  { id: 'composition', label: 'Состав' },
  { id: 'words', label: 'Слова' },
] as const
type InfoTab = (typeof INFO_TABS)[number]['id']

interface KanjiView {
  character: string
  tab: InfoTab
  scroll: Partial<Record<InfoTab, number>>
}

function createKanjiView(character: string): KanjiView {
  return { character, tab: 'overview', scroll: {} }
}

export function KanjiInfoCard({
  character,
  learned = false,
  myWords = [],
  trainingWordIds = [],
  onClose,
  onToggleLearned,
  onToggleMyWord,
  onToggleTrainingWord,
  onStartPractice,
}: KanjiInfoCardProps) {
  const isMobile = useIsMobileTouch()
  const [stack, setStack] = useState<KanjiView[]>(() => [createKanjiView(character)])
  const [highlightElement, setHighlightElement] = useState<string | null>(null)
  const activeView = stack[stack.length - 1]!
  const current = activeView.character
  const bodyRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef(document.activeElement)
  const id = useId()
  const info = getKanjiInfo(current)
  const component = getComponent(current)
  const words = useMemo(
    () => mergeWordsByWriting(getPopularWordsForKanji(current, POPULAR_WORDS_PER_KANJI)),
    [current],
  )
  const myWordSet = useMemo(() => new Set(myWords), [myWords])
  const trainingSet = useMemo(() => new Set(trainingWordIds), [trainingWordIds])

  useEffect(() => {
    setStack([createKanjiView(character)])
    setHighlightElement(null)
  }, [character])

  useEffect(() => {
    setHighlightElement(null)
  }, [current])

  useEffect(() => {
    if (!character) return
    const previousFocus = returnFocusRef.current
    const root = document.getElementById('root')
    const previousInert = root?.inert ?? false
    const body = document.body
    const previousStyle = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    }
    const scrollY = window.scrollY
    if (root) root.inert = true
    Object.assign(body.style, { overflow: 'hidden', position: 'fixed', top: `-${scrollY}px`, width: '100%' })
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      if (root) root.inert = previousInert
      Object.assign(body.style, previousStyle)
      window.scrollTo(0, scrollY)
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [character])

  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = activeView.scroll[activeView.tab] ?? 0
    const focused = document.activeElement
    if (!(focused instanceof HTMLElement) || !cardRef.current?.contains(focused) || !focused.getClientRects().length) {
      const target = isMobile ? document.getElementById(`${id}-tab-${activeView.tab}`) : closeRef.current
      target?.focus({ preventScroll: true })
    }
  }, [activeView, id, isMobile])

  if (!character) {
    return null
  }

  function openComponent(next: string) {
    if (!next || next === current) return
    const scrollTop = bodyRef.current?.scrollTop ?? 0
    setHighlightElement(null)
    setStack((prev) => [
      ...prev.slice(0, -1),
      { ...activeView, scroll: { ...activeView.scroll, [activeView.tab]: scrollTop } },
      createKanjiView(next),
    ])
  }

  function goBack() {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }

  function selectTab(tab: InfoTab) {
    const scrollTop = bodyRef.current?.scrollTop ?? 0
    setStack((prev) => [
      ...prev.slice(0, -1),
      { ...activeView, tab, scroll: { ...activeView.scroll, [activeView.tab]: scrollTop } },
    ])
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Keep trainer shortcuts behind the dialog from grading or changing the word.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      if (stack.length > 1) goBack()
      else onClose()
    }
    if (event.key === 'Tab') {
      const controls = Array.from(cardRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled):not([tabindex="-1"]), [href], [tabindex="0"]',
      ) ?? []).filter((element) => element.getClientRects().length > 0)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  const meanings = info?.meaningsRu?.length ? info.meaningsRu : info?.meanings ?? component?.meaningsRu ?? []

  return createPortal(
    <div
      className="kanji-info-overlay"
      data-testid="kanji-info-overlay"
      onClick={onClose}
      role="presentation"
    >
      <article
        ref={cardRef}
        className="kanji-info-card"
        data-testid="kanji-info-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Карточка кандзи ${current}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header className="kanji-info-head">
          <div className="kanji-info-heading">
            <span className="kanji-info-title">{current} <span>{info ? 'Кандзи' : 'Компонент'}</span></span>
            <div className="kanji-info-badges">
              <span className="script-badge">{info?.levelLabel ?? '—'}</span>
              {info?.joyo ? <span className="script-badge is-joyo">Jōyō</span> : null}
              {learned && current === character ? <span className="kanji-info-learned">выучено</span> : null}
            </div>
          </div>
          <div className="kanji-info-head-actions">
            {stack.length > 1 ? (
              <button type="button" className="text-button" data-testid="kanji-info-stack-back" onClick={goBack} aria-label={`Назад к ${stack[stack.length - 2]?.character}`}>
                ← {stack[stack.length - 2]?.character}
              </button>
            ) : null}
            <button ref={closeRef} type="button" className="text-button" data-testid="kanji-info-close" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </header>

        {isMobile ? (
          <div className="kanji-info-tabs" role="tablist" aria-label="О кандзи">
            {INFO_TABS.map(({ id: tab, label }, index) => (
              <button
                key={tab}
                id={`${id}-tab-${tab}`}
                type="button"
                role="tab"
                aria-selected={activeView.tab === tab}
                aria-controls={`${id}-panel-${tab}`}
                tabIndex={activeView.tab === tab ? 0 : -1}
                data-testid={`kanji-info-tab-${tab}`}
                onClick={() => selectTab(tab)}
                onKeyDown={(event) => {
                  let next = index
                  if (event.key === 'ArrowRight') next = (index + 1) % INFO_TABS.length
                  else if (event.key === 'ArrowLeft') next = (index + INFO_TABS.length - 1) % INFO_TABS.length
                  else if (event.key === 'Home') next = 0
                  else if (event.key === 'End') next = INFO_TABS.length - 1
                  else return
                  event.preventDefault()
                  const nextTab = INFO_TABS[next]!.id
                  selectTab(nextTab)
                  document.getElementById(`${id}-tab-${nextTab}`)?.focus()
                }}
              >
                {label}{tab === 'words' ? <span className="kanji-info-tab-count">{words.length}</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        <div ref={bodyRef} className="kanji-info-body" data-testid="kanji-info-body">
          {stack.length > 1 ? (
            <p className="kanji-stack-path" data-testid="kanji-stack-path">
              {stack.map((view) => view.character).join(' → ')}
            </p>
          ) : null}

          <div
            className="kanji-info-overview"
            id={`${id}-panel-overview`}
            role={isMobile ? 'tabpanel' : undefined}
            aria-labelledby={isMobile ? `${id}-tab-overview` : undefined}
            hidden={isMobile && activeView.tab !== 'overview'}
          >
            <KanjiGlyph
              character={current}
              size="card"
              testId="kanji-info-char"
              highlightElement={highlightElement}
              onHoverElement={(element) => setHighlightElement(element)}
              className="kanji-info-char"
              onActivateElement={openComponent}
            />

            {info || component ? (
              <>
                <section className="kanji-info-section">
                  <h4>Значение</h4>
                  <ul className="kanji-info-list">
                    {meanings.map((meaning) => (
                      <li key={meaning}>{meaning}</li>
                    ))}
                  </ul>
                </section>

                {(info?.strokes ?? component?.strokes) ? (
                  <p className="kanji-info-strokes">Черт: {info?.strokes ?? component?.strokes}</p>
                ) : null}

                {info ? (
                  <section className="kanji-info-section">
                    <h4>Чтения</h4>
                    <div className="kanji-hero-readings">
                      <div className="kanji-reading is-on">
                        <span className="kanji-reading-label">он</span>
                        <span className="kanji-reading-value">{formatKanjiReadings(info.onyomi)}</span>
                      </div>
                      <div className="kanji-reading is-kun">
                        <span className="kanji-reading-label">кун</span>
                        <span className="kanji-reading-value" title="· отделяет чтение знака от окуриганы">
                          {formatKanjiReadings(info.kunyomi)}
                        </span>
                      </div>
                    </div>
                  </section>
                ) : component?.mnemonicRu ? (
                  <p className="kanji-composition-mnemonic">{component.mnemonicRu}</p>
                ) : null}

                {info && onToggleLearned && current === character ? (
                  <button
                    type="button"
                    className="ghost-button kanji-info-learn-button"
                    data-testid="kanji-info-toggle-learned"
                    aria-pressed={learned}
                    onClick={() => onToggleLearned(character)}
                  >
                    {learned ? '✓ В изученных' : 'Отметить изученным'}
                  </button>
                ) : null}
              </>
            ) : (
              <p className="kanji-info-empty">Знака нет в банке кандзи.</p>
            )}
          </div>

          <div
            id={`${id}-panel-composition`}
            role={isMobile ? 'tabpanel' : undefined}
            aria-labelledby={isMobile ? `${id}-tab-composition` : undefined}
            hidden={isMobile && activeView.tab !== 'composition'}
          >
            <KanjiComposition
              character={current}
              highlightElement={highlightElement}
              onHoverElement={setHighlightElement}
              onOpenCharacter={openComponent}
              emptyMessage="Для этого знака состав пока не описан."
            />
          </div>

          <section
            className="kanji-info-section"
            data-testid="kanji-info-words"
            id={`${id}-panel-words`}
            role={isMobile ? 'tabpanel' : undefined}
            aria-labelledby={isMobile ? `${id}-tab-words` : undefined}
            hidden={isMobile && activeView.tab !== 'words'}
          >
            <h4>Слова</h4>
            {!words.length ? <p className="kanji-info-empty">Для этого знака пока нет примеров слов.</p> : null}
            <ul className="kanji-info-words">
              {words.map((word) => {
                const ids = wordVariantIds(word)
                const primaryId = word.id ?? ids[0]
                const inMine = ids.some((id) => myWordSet.has(id))
                const inTraining = ids.some((id) => trainingSet.has(id))
                return (
                  <li key={primaryId ?? `${word.writing}-${word.kana}`}>
                    <div className="kanji-info-word-main">
                      <span className="kanji-info-word-writing">{word.writing}</span>
                      <button
                        type="button"
                        className="text-button kanji-info-word-speak"
                        data-testid={`kanji-info-speak-word-${word.writing}`}
                        aria-label={`Озвучить ${word.writing}`}
                        onClick={() => speakJapanese(word.kana || word.writing)}
                      >
                        ▶
                      </button>
                    </div>
                    <HighlightedReading
                      writing={word.writing}
                      kana={word.kana}
                      focusKanji={current}
                      fallbackRomaji={word.romaji}
                    />
                    <p className="kanji-info-word-meaning">
                      {word.meanings.slice(0, 2).join(' · ') || '—'}
                      {word.readings && word.readings.length > 1
                        ? ` · ${word.readings.length} чтения`
                        : ''}
                    </p>
                    <div className="kanji-info-word-actions">
                      {primaryId && onToggleTrainingWord ? (
                        <button
                          type="button"
                          className="text-button"
                          data-testid={`kanji-info-train-word-${primaryId}`}
                          aria-pressed={inTraining}
                          aria-label={`${inTraining ? 'Убрать' : 'Добавить'} ${word.writing} ${inTraining ? 'из набора' : 'в набор'}`}
                          onClick={() => {
                            for (const id of ids) {
                              if (inTraining === trainingSet.has(id)) onToggleTrainingWord(id)
                            }
                          }}
                        >
                          {inTraining ? 'В наборе' : '+ В набор'}
                        </button>
                      ) : null}
                      {primaryId && onToggleMyWord ? (
                        <button
                          type="button"
                          className="text-button"
                          data-testid={`kanji-info-save-word-${primaryId}`}
                          aria-pressed={inMine}
                          aria-label={`${inMine ? 'Убрать' : 'Добавить'} ${word.writing} ${inMine ? 'из моих слов' : 'в мои слова'}`}
                          onClick={() => {
                            for (const wordId of ids) {
                              if (inMine === myWordSet.has(wordId)) onToggleMyWord(wordId)
                            }
                          }}
                        >
                          {inMine ? 'В моих' : '+ В мои'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <footer className="kanji-info-actions">
          <button
            type="button"
            className="ghost-button"
            data-testid="kanji-info-speak"
            onClick={() => speakKanjiReadings(info ?? { character: current })}
          >
            {isMobile ? '▶ Чтения' : 'Прослушать чтения'}
          </button>
          {info && onStartPractice ? (
            <button
              type="button"
              className="primary-button"
              data-testid="kanji-info-practice"
              onClick={() => onStartPractice(current)}
            >
              К словам
            </button>
          ) : isMobile ? (
            <button type="button" className="primary-button" data-testid="kanji-info-done" onClick={onClose}>
              Готово
            </button>
          ) : null}
        </footer>
      </article>
    </div>,
    document.body,
  )
}
