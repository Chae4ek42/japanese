export interface GrammarPoint {
  id: string
  labelRu: string
  /** Short Japanese cue shown in UI. */
  cue: string
}

/** Minimal grammar inventory for i+1 sentence gating. */
export const GRAMMAR_CATALOG: GrammarPoint[] = [
  { id: 'copula_desu', labelRu: 'связка です／ます', cue: 'です' },
  { id: 'particle_wa', labelRu: 'частица は (тема)', cue: 'は' },
  { id: 'particle_ga', labelRu: 'частица が', cue: 'が' },
  { id: 'particle_wo', labelRu: 'частица を', cue: 'を' },
  { id: 'particle_ni', labelRu: 'частица に', cue: 'に' },
  { id: 'particle_no', labelRu: 'частица の', cue: 'の' },
  { id: 'particle_de', labelRu: 'частица で', cue: 'で' },
  { id: 'particle_to', labelRu: 'частица と', cue: 'と' },
  { id: 'particle_mo', labelRu: 'частица も', cue: 'も' },
  { id: 'question_ka', labelRu: 'вопрос か', cue: 'か' },
  { id: 'past_ta', labelRu: 'прошедшее ～た', cue: 'た' },
  { id: 'te_form', labelRu: 'форма ～て', cue: 'て' },
  { id: 'negative_nai', labelRu: 'отрицание ～ない', cue: 'ない' },
  { id: 'want_tai', labelRu: 'желание ～たい', cue: 'たい' },
  { id: 'existence_aru_iru', labelRu: 'ある／いる', cue: 'ある' },
]

/** Unlocked by default so absolute beginners can start with です／は sentences. */
export { STARTER_GRAMMAR_IDS } from '../../data/grammar'

export const GRAMMAR_BY_ID = Object.fromEntries(GRAMMAR_CATALOG.map((item) => [item.id, item]))

const GRAMMAR_DETECT: Array<{ id: string; test: (text: string) => boolean }> = [
  { id: 'copula_desu', test: (t) => /です|ます/.test(t) },
  { id: 'particle_wa', test: (t) => /は/.test(t) },
  { id: 'particle_ga', test: (t) => /が/.test(t) },
  { id: 'particle_wo', test: (t) => /を/.test(t) },
  { id: 'particle_ni', test: (t) => /に/.test(t) },
  { id: 'particle_no', test: (t) => /の/.test(t) },
  { id: 'particle_de', test: (t) => /で/.test(t) },
  { id: 'particle_to', test: (t) => /と/.test(t) },
  { id: 'particle_mo', test: (t) => /も/.test(t) },
  { id: 'question_ka', test: (t) => /か[？?]?$|か。/.test(t) || /ですか|ますか/.test(t) },
  { id: 'past_ta', test: (t) => /[っいん]た|ました|だった/.test(t) },
  { id: 'te_form', test: (t) => /[っいん]?て[、。]?|[んで]/.test(t) && /て/.test(t) },
  { id: 'negative_nai', test: (t) => /ない|ません/.test(t) },
  { id: 'want_tai', test: (t) => /たい/.test(t) },
  { id: 'existence_aru_iru', test: (t) => /ある|いる|あります|います/.test(t) },
]

export function detectGrammarIds(text: string): string[] {
  return GRAMMAR_DETECT.filter((rule) => rule.test(text)).map((rule) => rule.id)
}
