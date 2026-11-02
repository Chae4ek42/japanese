import { KANA_STATS_CARDS } from '../../data/kana'
import { getParticleCard, PARTICLE_LABELS } from '../../data/particles'
import { getVerbCard, VERB_FORM_LABELS, verbGroupLabel } from '../../data/verbs'
import { getWordById } from '../../data/words/bank'
import { allNumberCards } from '../../shared/lib/numberCards'
import type { PracticeSection } from '../../shared/lib/targetedPractice'
import type { AppState, StatsRecord } from '../../shared/lib/types'

export const JOURNAL_SECTIONS: Record<PracticeSection, string> = {
  kana: 'Кана', vocab: 'Слова', numbers: 'Числа', particles: 'Частицы', verbs: 'Глаголы',
}

export interface MistakeEntry {
  id: string
  cardId: string
  section: PracticeSection
  title: string
  answer: string
  detail: string
  stats: StatsRecord
  lastDifficultyAt: number
  recentErrors: number
  confusion?: { label: string; count: number; cardId: string }
}

export type JournalPeriod = '7' | '30' | 'all'

/** One row per card with aggregate evidence; this is not a reconstructed event log. */
export function collectMistakes(state: AppState): MistakeEntry[] {
  const kana = new Map(KANA_STATS_CARDS.map((card) => [card.id, card]))
  const numbers = new Map(allNumberCards().map((card) => [card.id, card]))
  const result: MistakeEntry[] = []
  for (const section of Object.keys(JOURNAL_SECTIONS) as PracticeSection[]) {
    for (const [cardId, stats] of Object.entries(state[section].stats)) {
      if (!(stats.errors > 0 || stats.hints > 0 || stats.recentAnswers?.includes('wrong'))) continue
      let title = ''
      let answer = ''
      let detail = ''
      let confusion: MistakeEntry['confusion']
      if (section === 'kana') {
        const card = kana.get(cardId)
        if (!card) continue
        title = card.symbol
        answer = card.primaryAnswer
        detail = card.scriptLabel
        for (const [pair, count] of Object.entries(state.kana.history.confusions)) {
          const [from, to] = pair.split('>')
          const other = kana.get(to)
          if (from === cardId && other && count > (confusion?.count ?? 0)) {
            confusion = { label: `${other.symbol} (${other.primaryAnswer})`, count, cardId: to }
          }
        }
      } else if (section === 'numbers') {
        const card = numbers.get(cardId)
        if (!card) continue
        title = card.symbol
        answer = `${card.kanji} · ${card.kana} · ${card.romaji}`
        detail = ({ plain: 'Число', age: 'Возраст', clock: 'Время', counter: 'Счётное слово' })[card.mode]
      } else if (section === 'particles') {
        const card = getParticleCard(cardId)
        if (!card) continue
        title = card.prompt
        answer = `${card.answer} · ${PARTICLE_LABELS[card.answer]}`
        detail = card.glossRu
      } else if (section === 'verbs') {
        const card = getVerbCard(cardId)
        if (!card) continue
        title = `${card.dictionary.writing} → ${VERB_FORM_LABELS[card.form]}`
        answer = `${card.target.writing} · ${card.target.kana}`
        detail = `${card.meaning} · ${verbGroupLabel(card.group)}`
      } else {
        const word = state.vocab.customWords[cardId] ?? getWordById(cardId)
        if (!word || state.vocab.hiddenWordIds.includes(cardId)) continue
        title = word.writing
        answer = `${word.kana} · ${word.meanings.join('; ')}`
        detail = 'Чтение / значение: вид задания в общей статистике не сохранён.'
      }
      result.push({
        id: `${section}:${cardId}`, cardId, section, title, answer, detail, stats, confusion,
        lastDifficultyAt: Math.max(stats.lastErrorAt || 0, stats.lastHintAt || 0),
        recentErrors: stats.recentAnswers?.filter((answer) => answer === 'wrong').length ?? 0,
      })
    }
  }
  return result.sort((a, b) => b.lastDifficultyAt - a.lastDifficultyAt || b.stats.errors - a.stats.errors || a.id.localeCompare(b.id))
}

export function filterMistakes(
  entries: MistakeEntry[], section: PracticeSection | 'all', period: JournalPeriod, now: number,
): MistakeEntry[] {
  const since = period === 'all' ? 0 : now - Number(period) * 86_400_000
  return entries.filter((entry) => (section === 'all' || entry.section === section)
    && (period === 'all' || entry.lastDifficultyAt >= since))
}
