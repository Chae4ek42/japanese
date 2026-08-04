import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ContextSentence, ContextSession, KanjiWord } from '../../shared/lib/types'
import { KanjiInfoCard } from '../kanji/KanjiInfoCard'
import { getWordById } from '../../data/words/bank'
import { useContextState, useKanjiState, useVocabState } from '../../shared/state/AppStateContext'
import { VOCAB_GROUPS, getWordsForGroup } from '../vocab/groups'
import { ContextPractice } from './ContextPractice'
import { ContextSetup } from './ContextSetup'
import { GRAMMAR_CATALOG } from './grammar'
import { generateSentenceWithLlmResult, isContextLlmConfigured } from './llm'
import {
  groupCoverage,
  pickActiveBatch,
  pickIPlusOneSentence,
  pickSentenceForBatch,
  scoreBatchSentence,
  unknownWordIdsInSentence,
} from './picker'
import {
  addWordToBatch,
  appendSentencePage,
  canGoNextInHistory,
  canGoPrev as sessionCanGoPrev,
  createEmptySession,
  createTrainingLogEntry,
  currentPage,
  goNextInHistory,
  goPrevPage,
  markSessionDone,
  pickRandomUnknownGrammar,
  pickRandomUnknownWord,
  recordWordsLearned,
  sentenceStillHasBatchUnknowns,
  togglePageRevealed,
  withBatchIds,
} from './session'
import './styles.css'

type View = 'setup' | 'practice'

const PREFETCH_TARGET = 3

function resolveWords(ids: string[]): KanjiWord[] {
  return ids.map((id) => getWordById(id)).filter((word): word is KanjiWord => Boolean(word))
}

function mergeBatch(
  remainingIds: string[],
  groupWords: KanjiWord[],
  pickOptions: Parameters<typeof pickActiveBatch>[1],
  batchSize: number,
  knownIds: string[],
): string[] {
  const known = new Set(knownIds)
  const filled = pickActiveBatch(groupWords, {
    ...pickOptions,
    knownWordIds: knownIds,
    batchSize,
  })
  const merged = remainingIds.filter((id) => id !== '' && !known.has(id))
  for (const word of filled) {
    if (!word.id || merged.includes(word.id) || known.has(word.id)) continue
    merged.push(word.id)
    if (merged.length >= batchSize) break
  }
  return merged
}

function sentenceFitsBatch(
  sentence: ContextSentence,
  activeIds: string[],
  options: Parameters<typeof pickSentenceForBatch>[1],
): boolean {
  const score = scoreBatchSentence(
    sentence,
    new Set(activeIds),
    new Set(options.knownWordIds),
    new Set(options.knownGrammarIds),
    {
      ...options,
      maxNewPerSentence: options.maxNewPerSentence ?? 1,
    },
  )
  return score != null
}

export function ContextPage() {
  const contextState = useContextState()
  const vocab = useVocabState()
  const kanji = useKanjiState()
  const [view, setView] = useState<View>('setup')
  const [status, setStatus] = useState<'ready' | 'loading-llm' | 'missing' | 'done'>('ready')
  const [note, setNote] = useState('')
  const [infoKanji, setInfoKanji] = useState<string | null>(null)
  const [prefetchReady, setPrefetchReady] = useState(0)
  const [restored, setRestored] = useState(false)

  const loadTokenRef = useRef(0)
  const prefetchQueueRef = useRef<ContextSentence[]>([])
  const prefetchBusyRef = useRef(false)
  const prefetchFocusIndexRef = useRef(0)
  const batchIdsRef = useRef<string[]>([])
  const sessionRef = useRef<ContextSession | null>(null)
  const statusRef = useRef(status)

  statusRef.current = status

  const context = contextState?.context
  const myWords = vocab?.myWords ?? []
  const kanjiLearned = kanji?.learned ?? []
  const onPatchPreferences = contextState?.patchPreferences ?? (() => {})
  const onMarkWordsKnown = contextState?.markWordsKnown ?? (() => {})
  const onToggleGrammar = contextState?.toggleGrammar ?? (() => {})
  const onCacheGenerated = contextState?.cacheGenerated ?? (() => {})
  const onSaveSession = contextState?.saveSession ?? (() => {})
  const onUpsertTrainingLog = contextState?.upsertTrainingLog ?? (() => {})
  const onToggleMyWord = vocab?.toggleMyWord ?? (() => {})
  const onToggleKanjiLearned = kanji?.toggleLearned ?? (() => {})

  const session = context?.session ?? null
  sessionRef.current = session

  const groupId = session?.groupId ?? context?.preferences.groupId ?? 'family'
  const groupWords = useMemo(() => getWordsForGroup(groupId), [groupId])
  const knownSet = useMemo(() => new Set(context?.knownWordIds ?? []), [context?.knownWordIds])
  const coverage = useMemo(
    () => groupCoverage(groupWords, context?.knownWordIds ?? []),
    [groupWords, context?.knownWordIds],
  )
  const learnedSet = useMemo(() => new Set(kanjiLearned), [kanjiLearned])

  const pickOptions = useMemo(
    () => ({
      knownWordIds: context?.knownWordIds ?? [],
      knownGrammarIds: context?.knownGrammarIds ?? [],
      allowOneNewGrammar: context?.preferences.allowOneNewGrammar ?? true,
      maxNewPerSentence: context?.preferences.maxNewPerSentence ?? 1,
      preferThemes: [groupId],
      generatedCache: context?.generatedCache ?? {},
    }),
    [
      context?.knownWordIds,
      context?.knownGrammarIds,
      context?.preferences.allowOneNewGrammar,
      context?.preferences.maxNewPerSentence,
      context?.generatedCache,
      groupId,
    ],
  )

  const batchIds = session?.batchIds ?? []
  batchIdsRef.current = batchIds
  const page = session ? currentPage(session) : null
  const sentence = status === 'loading-llm' ? null : (page?.sentence ?? null)
  const revealed = page?.revealed ?? false
  const batchWords = useMemo(() => resolveWords(batchIds), [batchIds])
  const sentenceNewWords = useMemo(() => {
    if (!sentence) return []
    return resolveWords(unknownWordIdsInSentence(sentence, knownSet))
  }, [sentence, knownSet])

  const llmReady = isContextLlmConfigured()

  const commitSession = useCallback(
    (next: ContextSession | null) => {
      sessionRef.current = next
      onSaveSession(next)
    },
    [onSaveSession],
  )

  const syncActiveLog = useCallback(
    (next: ContextSession) => {
      onUpsertTrainingLog(createTrainingLogEntry(next, 'active'))
    },
    [onUpsertTrainingLog],
  )

  useEffect(() => {
    if (restored || !context) return
    setRestored(true)
    if (context.session?.status === 'active') {
      setView('practice')
      setStatus(context.session.pages.length ? 'ready' : 'ready')
      setNote('')
    } else if (context.session?.status === 'done') {
      setView('practice')
      setStatus('done')
    }
  }, [context, restored])

  const presentNewSentence = useCallback(
    (nextSentence: ContextSentence, noteText = '') => {
      const base = sessionRef.current
      if (!base) return
      const next = appendSentencePage(base, nextSentence)
      commitSession(next)
      syncActiveLog(next)
      setStatus('ready')
      setNote(noteText)
    },
    [commitSession, syncActiveLog],
  )

  const goPrevSentence = useCallback(() => {
    const base = sessionRef.current
    if (!base || !sessionCanGoPrev(base)) return
    commitSession(goPrevPage(base))
    setStatus('ready')
    setNote('')
  }, [commitSession])

  const takeFromPrefetch = useCallback(
    (activeIds: string[], excludeIds: string[]): ContextSentence | null => {
      const excluded = new Set(excludeIds)
      const kept: ContextSentence[] = []
      let found: ContextSentence | null = null
      for (const item of prefetchQueueRef.current) {
        if (found) {
          kept.push(item)
          continue
        }
        if (excluded.has(item.id)) continue
        if (!sentenceFitsBatch(item, activeIds, pickOptions)) continue
        found = item
      }
      prefetchQueueRef.current = kept
      setPrefetchReady(kept.length)
      return found
    },
    [pickOptions],
  )

  const fillPrefetch = useCallback(
    async (activeIds: string[]) => {
      if (!activeIds.length || prefetchBusyRef.current) return
      prefetchBusyRef.current = true
      try {
        while (prefetchQueueRef.current.length < PREFETCH_TARGET) {
          if (batchIdsRef.current.join('|') !== activeIds.join('|')) break
          const live = sessionRef.current
          const exclude = [
            ...(live?.recentSentenceIds ?? []),
            ...prefetchQueueRef.current.map((item) => item.id),
            ...(live ? [currentPage(live)?.sentence.id].filter(Boolean) as string[] : []),
          ]

          const picked = pickSentenceForBatch(activeIds, pickOptions, {
            excludeSentenceIds: exclude,
          })
          if (picked.sentence) {
            prefetchQueueRef.current = [...prefetchQueueRef.current, picked.sentence]
            setPrefetchReady(prefetchQueueRef.current.length)
            continue
          }

          if (!llmReady) break

          const focusId =
            activeIds[prefetchFocusIndexRef.current % activeIds.length] ??
            activeIds.find((id) => !pickIPlusOneSentence(id, pickOptions).sentence) ??
            activeIds[0]
          prefetchFocusIndexRef.current += 1
          const focus = focusId ? getWordById(focusId) : null
          if (!focus?.id) break

          const knownWords = (context?.knownWordIds ?? [])
            .map((id) => getWordById(id))
            .filter((item): item is KanjiWord => Boolean(item))
          const themeLabel = VOCAB_GROUPS.find((group) => group.id === groupId)?.label
          const generated = await generateSentenceWithLlmResult({
            target: focus,
            knownWords,
            knownGrammarIds: context?.knownGrammarIds ?? [],
            themeLabel,
          })
          if (!generated.ok) break
          if (batchIdsRef.current.join('|') !== activeIds.join('|')) break
          if (prefetchQueueRef.current.some((item) => item.id === generated.sentence.id)) continue
          if (!sentenceFitsBatch(generated.sentence, activeIds, pickOptions)) continue

          onCacheGenerated(focus.id, generated.sentence)
          prefetchQueueRef.current = [...prefetchQueueRef.current, generated.sentence]
          setPrefetchReady(prefetchQueueRef.current.length)
        }
      } finally {
        prefetchBusyRef.current = false
      }
    },
    [
      context?.knownGrammarIds,
      context?.knownWordIds,
      groupId,
      llmReady,
      onCacheGenerated,
      pickOptions,
    ],
  )

  const loadSentence = useCallback(
    async (activeIds: string[], excludeIds: string[] = []) => {
      const token = ++loadTokenRef.current
      batchIdsRef.current = activeIds
      const live = sessionRef.current
      if (live) {
        commitSession(withBatchIds(live, activeIds))
      }

      if (!activeIds.length) {
        if (live) {
          const done = markSessionDone(live)
          commitSession(done)
          onUpsertTrainingLog(createTrainingLogEntry(done, 'completed'))
        }
        setStatus('done')
        setNote('Все слова темы отмечены как известные.')
        prefetchQueueRef.current = []
        setPrefetchReady(0)
        return
      }

      setNote('')

      const queued = takeFromPrefetch(activeIds, excludeIds)
      if (queued) {
        if (token !== loadTokenRef.current) return
        presentNewSentence(queued)
        void fillPrefetch(activeIds)
        return
      }

      const picked = pickSentenceForBatch(activeIds, pickOptions, {
        excludeSentenceIds: excludeIds,
      })
      if (picked.sentence) {
        if (token !== loadTokenRef.current) return
        presentNewSentence(picked.sentence)
        void fillPrefetch(activeIds)
        return
      }

      const focusId =
        activeIds.find((id) => !pickIPlusOneSentence(id, pickOptions).sentence) ?? activeIds[0]
      const focus = focusId ? getWordById(focusId) : null
      if (!focus?.id || !llmReady) {
        if (token !== loadTokenRef.current) return
        setStatus('missing')
        setNote(
          'Нет подходящего предложения. Отметьте больше известных слов, уменьшите пакет или включите LLM в .env.',
        )
        return
      }

      if (token !== loadTokenRef.current) return
      setStatus('loading-llm')
      const knownWords = (context?.knownWordIds ?? [])
        .map((id) => getWordById(id))
        .filter((item): item is KanjiWord => Boolean(item))
      const themeLabel = VOCAB_GROUPS.find((group) => group.id === groupId)?.label
      const generated = await generateSentenceWithLlmResult({
        target: focus,
        knownWords,
        knownGrammarIds: context?.knownGrammarIds ?? [],
        themeLabel,
      })
      if (token !== loadTokenRef.current) return
      if (generated.ok) {
        onCacheGenerated(focus.id, generated.sentence)
        presentNewSentence(generated.sentence, 'Предложение сгенерировано LLM и проверено фильтром.')
        void fillPrefetch(activeIds)
        return
      }
      setStatus('missing')
      setNote(generated.reason || 'LLM не смог сделать валидное предложение.')
    },
    [
      commitSession,
      context?.knownGrammarIds,
      context?.knownWordIds,
      fillPrefetch,
      groupId,
      llmReady,
      onCacheGenerated,
      onUpsertTrainingLog,
      pickOptions,
      presentNewSentence,
      takeFromPrefetch,
    ],
  )

  const handleNextSentence = useCallback(() => {
    const base = sessionRef.current
    if (!base) return
    if (canGoNextInHistory(base)) {
      commitSession(goNextInHistory(base))
      setStatus('ready')
      setNote('')
      return
    }
    const current = currentPage(base)
    const exclude = current
      ? [current.sentence.id, ...base.recentSentenceIds]
      : [...base.recentSentenceIds]
    void loadSentence(base.batchIds, exclude)
  }, [commitSession, loadSentence])

  const handleToggleReveal = useCallback(() => {
    const base = sessionRef.current
    if (!base) return
    commitSession(togglePageRevealed(base))
  }, [commitSession])

  useEffect(() => {
    if (view !== 'practice') return

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (statusRef.current === 'loading-llm' || statusRef.current === 'done') return

      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        goPrevSentence()
        return
      }
      if (event.code === 'ArrowRight') {
        event.preventDefault()
        handleNextSentence()
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        handleToggleReveal()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view, goPrevSentence, handleNextSentence, handleToggleReveal])

  if (!contextState || !vocab || !kanji || !context) return null

  const ctx = context
  const practiceGroupWords = getWordsForGroup(session?.groupId ?? ctx.preferences.groupId)

  function startPractice({ fresh }: { fresh: boolean }) {
    const live = sessionRef.current
    if (!fresh && live?.status === 'active') {
      setView('practice')
      setStatus('ready')
      setNote('')
      if (!live.pages.length && live.batchIds.length) {
        void loadSentence(live.batchIds)
      }
      return
    }

    if (fresh && live) {
      const outcome = live.status === 'done' ? 'completed' : 'abandoned'
      onUpsertTrainingLog(createTrainingLogEntry(live, outcome))
    }

    const gid = ctx.preferences.groupId
    const words = getWordsForGroup(gid)
    const batch = pickActiveBatch(words, {
      ...pickOptions,
      knownWordIds: ctx.knownWordIds,
      batchSize: ctx.preferences.batchSize,
      preferThemes: [gid],
    })
    const ids = batch.map((word) => word.id!).filter(Boolean)
    const nextSession = createEmptySession(gid, ids)
    commitSession(nextSession)
    syncActiveLog(nextSession)
    prefetchQueueRef.current = []
    setPrefetchReady(0)
    prefetchFocusIndexRef.current = 0
    batchIdsRef.current = ids
    setView('practice')
    setNote('')
    if (!ids.length) {
      const done = markSessionDone(nextSession)
      commitSession(done)
      onUpsertTrainingLog(createTrainingLogEntry(done, 'completed'))
      setStatus('done')
      setNote('Все слова темы уже известны.')
      return
    }
    setStatus('ready')
    void loadSentence(ids)
  }

  function applyKnowWords(wordIds: string[]) {
    const ids = [...new Set(wordIds.filter(Boolean))]
    if (!ids.length) return
    const live = sessionRef.current
    if (!live) return

    onMarkWordsKnown(ids)
    const nextKnown = [...new Set([...ctx.knownWordIds, ...ids])]
    let remaining = live.batchIds.filter((id) => !ids.includes(id))
    const merged = mergeBatch(
      remaining,
      practiceGroupWords,
      { ...pickOptions, knownWordIds: nextKnown, batchSize: ctx.preferences.batchSize },
      ctx.preferences.batchSize,
      nextKnown,
    )

    let updated = recordWordsLearned(withBatchIds(live, merged), ids)
    prefetchQueueRef.current = prefetchQueueRef.current.filter((item) =>
      sentenceFitsBatch(item, merged, { ...pickOptions, knownWordIds: nextKnown }),
    )
    setPrefetchReady(prefetchQueueRef.current.length)

    if (!merged.length) {
      updated = markSessionDone(updated)
      commitSession(updated)
      onUpsertTrainingLog(createTrainingLogEntry(updated, 'completed'))
      setStatus('done')
      setNote('Пакет разобран — все доступные слова темы известны.')
      return
    }

    const pageNow = currentPage(updated)
    if (
      pageNow &&
      sentenceStillHasBatchUnknowns(pageNow.sentence, merged, nextKnown)
    ) {
      commitSession(updated)
      syncActiveLog(updated)
      setNote('')
      return
    }

    commitSession(updated)
    syncActiveLog(updated)
    const exclude = pageNow
      ? [pageNow.sentence.id, ...updated.recentSentenceIds]
      : [...updated.recentSentenceIds]
    void loadSentence(merged, exclude)
  }

  function handleKnowWord(wordId: string) {
    applyKnowWords([wordId])
  }

  function handleKnowAll() {
    applyKnowWords(sentenceNewWords.map((word) => word.id!).filter(Boolean))
  }

  function handleAddRandomWord() {
    const live = sessionRef.current
    if (!live) return
    const word = pickRandomUnknownWord(practiceGroupWords, ctx.knownWordIds, live.batchIds)
    if (!word?.id) {
      setNote('Нет новых слов темы вне пакета.')
      return
    }
    const protect = sentenceNewWords.map((item) => item.id!).filter(Boolean)
    const nextBatch = addWordToBatch(live.batchIds, word.id, {
      maxSize: 5,
      protectIds: protect,
    })
    const updated = withBatchIds(live, nextBatch)
    commitSession(updated)
    batchIdsRef.current = nextBatch
    prefetchQueueRef.current = []
    setPrefetchReady(0)
    setNote(`Добавлено слово: ${word.writing}${word.kana ? ` (${word.kana})` : ''}`)
    const exclude = currentPage(updated)
      ? [currentPage(updated)!.sentence.id, ...updated.recentSentenceIds]
      : [...updated.recentSentenceIds]
    void loadSentence(nextBatch, exclude)
  }

  function handleAddRandomGrammar() {
    const point = pickRandomUnknownGrammar(GRAMMAR_CATALOG, ctx.knownGrammarIds)
    if (!point) {
      setNote('Вся грамматика из каталога уже разблокирована.')
      return
    }
    onToggleGrammar(point.id)
    setNote(`Разблокирована грамматика: ${point.cue} — ${point.labelRu}`)
    prefetchQueueRef.current = []
    setPrefetchReady(0)
  }

  const coverageLabel = `${coverage.known} / ${coverage.total}${llmReady ? ' · LLM' : ''}${
    prefetchReady ? ` · запас ${prefetchReady}` : ''
  }`

  return (
    <main className="context-page" data-testid="context-page">
      {view === 'setup' ? (
        <ContextSetup
          context={ctx}
          onPatchPreferences={onPatchPreferences}
          onToggleGrammar={onToggleGrammar}
          onContinue={() => startPractice({ fresh: false })}
          onStartFresh={() => startPractice({ fresh: true })}
        />
      ) : (
        <ContextPractice
          coverageLabel={coverageLabel}
          batchWords={batchWords}
          sentenceNewWords={sentenceNewWords}
          sentence={sentence}
          revealed={revealed}
          status={status}
          note={note}
          myWords={myWords}
          canGoPrev={session ? sessionCanGoPrev(session) : false}
          pagesAnswered={session?.pages.length ?? 0}
          wordsLearned={session?.wordsLearnedIds.length ?? 0}
          onReveal={handleToggleReveal}
          onKnowWord={handleKnowWord}
          onKnowAll={handleKnowAll}
          onLater={handleNextSentence}
          onPrevSentence={goPrevSentence}
          onNextSentence={handleNextSentence}
          onBackToSetup={() => setView('setup')}
          onAddRandomWord={handleAddRandomWord}
          onAddRandomGrammar={handleAddRandomGrammar}
          onToggleMyWord={onToggleMyWord}
          onOpenKanji={setInfoKanji}
        />
      )}

      {infoKanji ? (
        <KanjiInfoCard
          character={infoKanji}
          learned={learnedSet.has(infoKanji)}
          myWords={myWords}
          onClose={() => setInfoKanji(null)}
          onToggleLearned={onToggleKanjiLearned}
          onToggleMyWord={onToggleMyWord}
        />
      ) : null}
    </main>
  )
}
