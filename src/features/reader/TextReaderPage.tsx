import { useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'
import type { KanjiWord } from '../../shared/lib/types'
import { speakJapanese } from '../../shared/lib/speech'
import { tokenizeWithKuromoji } from '../../shared/lib/kuromoji-tokenizer'
import { useVocabState } from '../../shared/state/AppStateContext'
import { PARTICLES_CHEAT_SHEET, VERB_FORMS_CHEAT_SHEET } from '../../data/cheatSheets'
import {
  CheatSheetActions,
  CheatSheetPopup,
  CheatSheetTrigger,
} from '../../shared/ui/CheatSheetPopup'
import { KanjiInfoCard } from '../kanji/KanjiInfoCard'
import { KanjiWritingHotspots } from '../kanji/KanjiWritingHotspots'
import { preferLexicalMeanings, wordVariantIds } from '../vocab/mergeHomographs'
import {
  analyzeMorphGroups,
  contentReaderTokens,
  groupTokensIntoSentences,
  type ReaderSentence,
  type ReaderToken,
} from './analyze'
import { lookupParticleInfo } from './particle-info'
import { translateJaToRu } from './translate'

const ANALYZE_DEBOUNCE_MS = 280

type TranslateState = { status: 'idle' | 'loading' | 'ready' | 'error'; text?: string }

export function TextReaderPage() {
  const vocab = useVocabState()
  const [text, setText] = useState('')
  const [tokens, setTokens] = useState<ReaderToken[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading-dict' | 'analyzing' | 'ready' | 'error'>(
    'idle',
  )
  const [error, setError] = useState('')
  const [infoKanji, setInfoKanji] = useState<string | null>(null)
  const [cheatSheet, setCheatSheet] = useState<'particles' | 'verbs' | null>(null)
  const [cheatTopicId, setCheatTopicId] = useState<string | null>(null)
  const [translations, setTranslations] = useState<Record<string, TranslateState>>({})
  const [copiedSentenceId, setCopiedSentenceId] = useState<string | null>(null)
  const analyzeSeqRef = useRef(0)
  const selectedIdRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const copiedTimerRef = useRef<number | null>(null)
  selectedIdRef.current = selectedId
  const translationCacheRef = useRef<Map<string, string>>(new Map())

  const myWordSet = useMemo(() => new Set(vocab?.myWords ?? []), [vocab?.myWords])
  const sentences = useMemo(() => groupTokensIntoSentences(tokens), [tokens])
  const selected = tokens.find((token) => token.id === selectedId) ?? null
  const knownCount = contentReaderTokens(tokens).length
  const missingMine = contentReaderTokens(tokens).filter(
    (token) => !token.words.some((word) => wordVariantIds(word).some((id) => myWordSet.has(id))),
  )

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.45))
    el.style.height = `${Math.max(next, 44)}px`
  }, [text])

  useEffect(() => {
    const trimmed = text.trim()
    if (!trimmed) {
      analyzeSeqRef.current += 1
      setTokens([])
      setSelectedId(null)
      setActiveSentenceId(null)
      setTranslations({})
      setError('')
      setStatus('idle')
      return
    }

    const seq = ++analyzeSeqRef.current
    setStatus((prev) => (prev === 'ready' || prev === 'analyzing' ? 'analyzing' : 'loading-dict'))
    setError('')

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const raw = await tokenizeWithKuromoji(trimmed)
          if (seq !== analyzeSeqRef.current) return
          const next = analyzeMorphGroups(raw)
          setTokens(next)
          const keep = selectedIdRef.current
          const stillThere = keep && next.some((token) => token.id === keep)
          setSelectedId(
            stillThere
              ? keep
              : (next.find((token) => token.kind === 'content')?.id ?? next[0]?.id ?? null),
          )
          setStatus('ready')
        } catch (err) {
          if (seq !== analyzeSeqRef.current) return
          setStatus('error')
          setError(err instanceof Error ? err.message : 'Не удалось разобрать текст')
          setTokens([])
          setSelectedId(null)
          setActiveSentenceId(null)
        }
      })()
    }, ANALYZE_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [text])

  useEffect(() => {
    if (!selectedId) return
    const owner = sentences.find((sentence) =>
      sentence.tokens.some((token) => token.id === selectedId),
    )
    if (owner) setActiveSentenceId(owner.id)
  }, [selectedId, sentences])

  function toggleWord(word: KanjiWord) {
    if (!vocab) return
    const ids = wordVariantIds(word)
    const primary = ids[0] ?? word.id
    if (!primary) return
    const inMine = ids.some((id) => myWordSet.has(id))
    if (inMine) {
      vocab.toggleMyWord(primary)
      return
    }
    vocab.addMyWords(ids)
  }

  function addAllMissing() {
    if (!vocab || !missingMine.length) return
    const ids = missingMine.flatMap((token) =>
      token.words[0] ? wordVariantIds(token.words[0]) : [],
    )
    vocab.addMyWords(ids)
  }

  async function translateSentence(sentence: ReaderSentence) {
    setActiveSentenceId(sentence.id)
    const cached = translationCacheRef.current.get(sentence.text)
    if (cached) {
      setTranslations((prev) => ({
        ...prev,
        [sentence.id]: { status: 'ready', text: cached },
      }))
      return
    }

    setTranslations((prev) => ({
      ...prev,
      [sentence.id]: { status: 'loading' },
    }))
    try {
      const translated = await translateJaToRu(sentence.text)
      translationCacheRef.current.set(sentence.text, translated)
      setTranslations((prev) => ({
        ...prev,
        [sentence.id]: { status: 'ready', text: translated },
      }))
    } catch (err) {
      setTranslations((prev) => ({
        ...prev,
        [sentence.id]: {
          status: 'error',
          text: err instanceof Error ? err.message : 'Ошибка перевода',
        },
      }))
    }
  }

  async function copySentence(sentence: ReaderSentence) {
    setActiveSentenceId(sentence.id)
    try {
      await navigator.clipboard.writeText(sentence.text)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      setCopiedSentenceId(sentence.id)
      copiedTimerRef.current = window.setTimeout(() => {
        setCopiedSentenceId((prev) => (prev === sentence.id ? null : prev))
        copiedTimerRef.current = null
      }, 1600)
    } catch {
      setCopiedSentenceId(null)
    }
  }

  function openParticleCheat(topicId: string) {
    setCheatTopicId(topicId)
    setCheatSheet('particles')
  }

  function closeCheatSheet() {
    setCheatSheet(null)
    setCheatTopicId(null)
  }

  const statusLabel =
    status === 'loading-dict'
      ? 'Загрузка словаря…'
      : status === 'analyzing'
        ? 'Разбор…'
        : status === 'error'
          ? error
          : status === 'ready'
            ? `${sentences.length} предл. · ${knownCount} слов`
            : 'Вставьте текст ниже'

  return (
    <main className="reader-page" data-testid="reader-page">
      <header className="reader-hero">
        <div className="reader-hero-copy">
          <p className="reader-kicker">Чтение</p>
          <h2 className="reader-title">Текст</h2>
          <p className="reader-lead">
            Клик по слову — значение и форма; частица — её роль; «Перевести» / «Копировать» — предложение.
          </p>
          <CheatSheetActions>
            <CheatSheetTrigger
              label="Шпаргалка: частицы"
              testId="reader-open-particles-cheatsheet"
              onClick={() => {
                setCheatTopicId(null)
                setCheatSheet('particles')
              }}
            />
            <CheatSheetTrigger
              label="Шпаргалка: глаголы"
              testId="reader-open-verbs-cheatsheet"
              onClick={() => {
                setCheatTopicId(null)
                setCheatSheet('verbs')
              }}
            />
          </CheatSheetActions>
        </div>
        <p
          className={`reader-status ${status === 'error' ? 'is-error' : ''}`}
          data-testid="reader-status"
        >
          {statusLabel}
        </p>
      </header>

      <section className="reader-workspace" data-testid="reader-workspace">
        <div className="reader-text" data-testid="reader-tokens" aria-label="Разобранный текст">
          {sentences.length ? (
            sentences.map((sentence) => {
              const translation = translations[sentence.id]
              const isActive = activeSentenceId === sentence.id
              return (
                <article
                  key={sentence.id}
                  className={isActive ? 'reader-sentence is-active' : 'reader-sentence'}
                  data-testid={`reader-sentence-${sentence.id}`}
                >
                  <p className="reader-sentence-line">
                    {sentence.tokens.map((token) => (
                      <ReaderTokenView
                        key={token.id}
                        token={token}
                        selected={selectedId === token.id}
                        myWordSet={myWordSet}
                        onSelect={() => {
                          setSelectedId(token.id)
                          setActiveSentenceId(sentence.id)
                        }}
                        onOpenKanji={setInfoKanji}
                      />
                    ))}
                  </p>
                  <div className="reader-sentence-tools">
                    <button
                      type="button"
                      className="text-button reader-translate-button"
                      data-testid={`reader-translate-${sentence.id}`}
                      disabled={translation?.status === 'loading'}
                      onClick={() => void translateSentence(sentence)}
                    >
                      {translation?.status === 'loading'
                        ? 'Перевод…'
                        : translation?.status === 'ready'
                          ? 'Обновить перевод'
                          : 'Перевести'}
                    </button>
                    <button
                      type="button"
                      className="text-button reader-copy-button"
                      data-testid={`reader-copy-${sentence.id}`}
                      onClick={() => void copySentence(sentence)}
                    >
                      {copiedSentenceId === sentence.id ? 'Скопировано' : 'Копировать'}
                    </button>
                  </div>
                  {translation?.status === 'ready' && translation.text ? (
                    <p className="reader-sentence-translation" data-testid="reader-translation">
                      {translation.text}
                    </p>
                  ) : null}
                  {translation?.status === 'error' ? (
                    <p className="reader-sentence-translation is-error">{translation.text}</p>
                  ) : null}
                </article>
              )
            })
          ) : (
            <p className="reader-text-empty">
              {status === 'loading-dict' || status === 'analyzing'
                ? 'Разбираю…'
                : 'Вставьте текст ниже'}
            </p>
          )}
        </div>

        <aside className="reader-panel" data-testid="reader-panel">
          {selected ? (
            <ReaderWordPanel
              token={selected}
              myWordSet={myWordSet}
              onToggleWord={toggleWord}
              onOpenKanji={setInfoKanji}
              onOpenParticleTopic={openParticleCheat}
            />
          ) : (
            <p className="reader-panel-empty">Выберите слово в разборе</p>
          )}

          {missingMine.length ? (
            <button
              type="button"
              className="ghost-button reader-add-all"
              data-testid="reader-add-all-mine"
              onClick={addAllMissing}
            >
              + Все найденные в «Мои» ({missingMine.length})
            </button>
          ) : null}
        </aside>
      </section>

      <section className="reader-compose">
        <label className="reader-label" htmlFor="reader-input">
          Исходный текст
        </label>
        <textarea
          id="reader-input"
          ref={inputRef}
          className="reader-input"
          data-testid="reader-input"
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="日本語の文章を貼り付け…"
        />
      </section>

      {infoKanji ? (
        <KanjiInfoCard
          character={infoKanji}
          myWords={vocab?.myWords}
          trainingWordIds={vocab?.trainingWordIds}
          onClose={() => setInfoKanji(null)}
          onToggleMyWord={vocab?.toggleMyWord}
          onToggleTrainingWord={vocab?.toggleTrainingWord}
        />
      ) : null}

      {cheatSheet === 'particles' ? (
        <CheatSheetPopup
          doc={PARTICLES_CHEAT_SHEET}
          initialTopicId={cheatTopicId}
          onClose={closeCheatSheet}
        />
      ) : null}
      {cheatSheet === 'verbs' ? (
        <CheatSheetPopup doc={VERB_FORMS_CHEAT_SHEET} onClose={closeCheatSheet} />
      ) : null}
    </main>
  )
}

function ReaderTokenView({
  token,
  selected,
  myWordSet,
  onSelect,
  onOpenKanji,
}: {
  token: ReaderToken
  selected: boolean
  myWordSet: Set<string>
  onSelect: () => void
  onOpenKanji: (character: string) => void
}) {
  if (token.kind === 'punct') {
    return <span className="reader-token is-punct">{token.surface}</span>
  }

  const known = token.words.length > 0
  const inMine = token.words.some((word) =>
    wordVariantIds(word).some((id) => myWordSet.has(id)),
  )
  const classes = [
    'reader-token',
    `is-${token.kind}`,
    known ? 'is-known' : 'is-unknown',
    inMine ? 'is-mine' : '',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      data-testid={`reader-token-${token.surface}`}
      onClick={onSelect}
    >
      {token.hasKanji ? (
        <KanjiWritingHotspots
          writing={token.surface}
          className="reader-token-writing"
          onOpenInfo={onOpenKanji}
        />
      ) : (
        <span className="reader-token-writing">{token.surface}</span>
      )}
    </button>
  )
}

function ReaderWordPanel({
  token,
  myWordSet,
  onToggleWord,
  onOpenKanji,
  onOpenParticleTopic,
}: {
  token: ReaderToken
  myWordSet: Set<string>
  onToggleWord: (word: KanjiWord) => void
  onOpenKanji: (character: string) => void
  onOpenParticleTopic: (topicId: string) => void
}) {
  const primary = token.words[0] ?? null
  const ids = primary ? wordVariantIds(primary) : []
  const inMine = ids.some((id) => myWordSet.has(id))
  const showLemma = token.lemma && token.lemma !== token.surface && token.lemma !== '*'
  const particleInfo =
    token.kind === 'particle' ? lookupParticleInfo(token.surface) || lookupParticleInfo(token.lemma) : null

  return (
    <div className="reader-word">
      <div className="reader-word-head">
        {token.hasKanji ? (
          <KanjiWritingHotspots
            writing={token.surface}
            className="reader-word-writing"
            onOpenInfo={onOpenKanji}
          />
        ) : (
          <span className="reader-word-writing">{token.surface}</span>
        )}
        <button
          type="button"
          className="text-button"
          aria-label={`Озвучить ${token.surface}`}
          onClick={() => speakJapanese(token.reading || token.surface)}
        >
          ▶
        </button>
      </div>

      <dl className="reader-word-forms" data-testid="reader-word-forms">
        <div>
          <dt>В тексте</dt>
          <dd>{token.surface}</dd>
        </div>
        {showLemma ? (
          <div>
            <dt>Начальная форма</dt>
            <dd>{token.lemma}</dd>
          </div>
        ) : null}
        {token.formLabel ? (
          <div>
            <dt>Форма</dt>
            <dd data-testid="reader-form-label">{token.formLabel}</dd>
          </div>
        ) : null}
        <div>
          <dt>Часть речи</dt>
          <dd>{token.posLabel}</dd>
        </div>
      </dl>

      <p className="reader-word-meta">
        {token.reading ? <span>{token.reading}</span> : null}
        {token.romaji ? <span>{token.romaji}</span> : null}
        {particleInfo?.reading && !token.romaji ? <span>{particleInfo.reading}</span> : null}
      </p>

      {particleInfo ? (
        <div className="reader-particle" data-testid="reader-particle-info">
          <p className="reader-particle-label">{particleInfo.shortLabel}</p>
          {particleInfo.lead ? <p className="reader-particle-lead">{particleInfo.lead}</p> : null}
          {particleInfo.topic?.senses.length ? (
            <ul className="reader-particle-senses">
              {particleInfo.topic.senses.slice(0, 4).map((sense) => (
                <li key={sense.id}>{sense.title}</li>
              ))}
            </ul>
          ) : null}
          {particleInfo.examples.length ? (
            <ul className="reader-particle-examples">
              {particleInfo.examples.slice(0, 3).map((example) => (
                <li key={`${example.jp}-${example.gloss}`}>
                  <span className="reader-particle-jp">{example.jp}</span>
                  <span className="reader-particle-gloss">{example.gloss}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {particleInfo.topic ? (
            <button
              type="button"
              className="ghost-button reader-particle-more"
              data-testid="reader-particle-open-cheat"
              onClick={() => onOpenParticleTopic(particleInfo.topic!.id)}
            >
              Все примеры · {particleInfo.surface}
            </button>
          ) : null}
        </div>
      ) : null}

      {primary ? (
        <>
          <p className="reader-word-meaning" data-testid="reader-word-meaning">
            {preferLexicalMeanings(primary.meanings.length ? primary.meanings : ['—'])
              .slice(0, 4)
              .join(' · ')}
          </p>
          <div className="reader-word-actions">
            <button
              type="button"
              className={inMine ? 'ghost-button is-saved' : 'primary-button'}
              data-testid="reader-toggle-mine"
              onClick={() => onToggleWord(primary)}
            >
              {inMine ? 'В моих' : '+ В мои'}
            </button>
          </div>
          {token.words.length > 1 ? (
            <ul className="reader-word-alts" data-testid="reader-word-alts">
              {token.words.slice(1, 5).map((word) => {
                const altIds = wordVariantIds(word)
                const altMine = altIds.some((id) => myWordSet.has(id))
                return (
                  <li key={word.id ?? `${word.writing}-${word.kana}`}>
                    <span>
                      {word.writing}
                      {word.kana ? ` (${word.kana})` : ''} —{' '}
                      {(word.meanings[0] || '—').slice(0, 60)}
                    </span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onToggleWord(word)}
                    >
                      {altMine ? 'В моих' : '+ В мои'}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </>
      ) : !particleInfo ? (
        <p className="reader-panel-empty">
          В словаре приложения нет точного совпадения для «{token.lemma}».
        </p>
      ) : null}
    </div>
  )
}
