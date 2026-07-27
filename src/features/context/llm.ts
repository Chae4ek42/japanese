import type { ContextSentence, KanjiWord } from '../../shared/lib/types'
import { detectGrammarIds } from './grammar'
import { matchWordIdsInText, wordContainsSurface } from './matchWords'

export interface LlmGenerateInput {
  target: KanjiWord
  knownWords: KanjiWord[]
  knownGrammarIds: string[]
  themeLabel?: string
}

export type LlmGenerateResult =
  | { ok: true; sentence: ContextSentence }
  | { ok: false; reason: string }

function getLlmConfig(): { endpoint: string; apiKey: string; model: string } | null {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {}
  const endpoint = String(env.VITE_CONTEXT_LLM_ENDPOINT ?? '').trim()
  const apiKey = String(env.VITE_CONTEXT_LLM_API_KEY ?? '').trim()
  const model = String(env.VITE_CONTEXT_LLM_MODEL ?? 'openai/gpt-oss-20b:free').trim()
  if (!endpoint || !apiKey) return null
  return { endpoint, apiKey, model }
}

export function isContextLlmConfigured(): boolean {
  return Boolean(getLlmConfig())
}

function buildPrompt(input: LlmGenerateInput): string {
  const knownList = input.knownWords
    .slice(0, 40)
    .map((word) => `${word.writing}(${word.kana})`)
    .join('、')
  const target = `${input.target.writing} / ${input.target.kana}`
  return [
    'Generate exactly ONE short Japanese sentence for a beginner.',
    `Target NEW word (MUST appear literally in text): ${target}`,
    `Theme: ${input.themeLabel || 'daily life'}`,
    `Allowed known content words besides the target: ${knownList || '(none)'}`,
    'You may also use particles and です／ます／か.',
    'Hard rules:',
    `- Japanese "text" MUST contain the characters「${input.target.writing || input.target.kana}」`,
    '- Only ONE new content word: the target. Do not invent other nouns/verbs/adjectives.',
    '- Max about 16 Japanese characters.',
    '- Prefer polite です／ます.',
    '- "reading" = kana reading of the whole sentence.',
    '- "glossRu" = Russian translation of the sentence.',
    '- Output JSON only, no markdown, no explanation.',
    'Example: {"text":"父です。","reading":"ちちです。","glossRu":"Это отец."}',
  ].join('\n')
}

function parseJsonContent(content: string): { text?: string; reading?: string; glossRu?: string } | null {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1].trim() : trimmed
  try {
    return JSON.parse(raw) as { text?: string; reading?: string; glossRu?: string }
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(raw.slice(start, end + 1)) as { text?: string; reading?: string; glossRu?: string }
    } catch {
      return null
    }
  }
}

function validateGenerated(
  raw: { text?: string; reading?: string; glossRu?: string },
  input: LlmGenerateInput,
): ContextSentence | null {
  const text = String(raw.text ?? '').trim()
  const glossRu = String(raw.glossRu ?? '').trim()
  if (!text || !glossRu) return null
  if (!wordContainsSurface(input.target, text)) return null
  if (!input.target.id) return null

  const known = new Set(input.knownWords.map((word) => word.id!).filter(Boolean))
  const matchedIds = matchWordIdsInText(text)
  const wordIds = matchedIds.includes(input.target.id)
    ? matchedIds
    : [...matchedIds, input.target.id]
  const extraUnknown = wordIds.filter((id) => id !== input.target.id && !known.has(id))
  if (extraUnknown.length > 0) return null

  const grammarIds = detectGrammarIds(text)
  return {
    id: `llm:${input.target.id}:${Date.now()}`,
    text,
    reading: typeof raw.reading === 'string' ? raw.reading.trim() : undefined,
    glossRu,
    wordIds,
    grammarIds,
    themeHints: [],
    source: 'llm',
  }
}

async function requestOnce(
  config: { endpoint: string; apiKey: string; model: string },
  input: LlmGenerateInput,
): Promise<LlmGenerateResult> {
  const isFree = /:free\b/i.test(config.model) || /^openrouter\/free$/i.test(config.model)
  const body: Record<string, unknown> = {
    model: config.model,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'You write tiny Japanese learner sentences. Reply with a single JSON object only. No markdown. No chain-of-thought.',
      },
      { role: 'user', content: buildPrompt(input) },
    ],
  }
  if (!isFree) {
    body.response_format = { type: 'json_object' }
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
      'X-Title': 'JP trainers',
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string } }>
  } | null

  if (!response.ok) {
    const message = payload?.error?.message || `HTTP ${response.status}`
    return { ok: false, reason: `OpenRouter: ${message}` }
  }

  const content = payload?.choices?.[0]?.message?.content
  if (!content) {
    return { ok: false, reason: 'Пустой ответ модели (часто у reasoning/:free). Смените модель.' }
  }

  const parsed = parseJsonContent(content)
  if (!parsed) {
    return { ok: false, reason: 'Модель вернула не-JSON. Попробуйте openai/gpt-oss-20b:free.' }
  }

  const sentence = validateGenerated(parsed, input)
  if (!sentence) {
    return {
      ok: false,
      reason: 'Ответ не прошёл фильтр i+1 (нет целевого слова или лишние неизвестные).',
    }
  }
  return { ok: true, sentence }
}

/** @deprecated Prefer generateSentenceWithLlmResult */
export async function generateSentenceWithLlm(input: LlmGenerateInput): Promise<ContextSentence | null> {
  const result = await generateSentenceWithLlmResult(input)
  return result.ok ? result.sentence : null
}

export async function generateSentenceWithLlmResult(input: LlmGenerateInput): Promise<LlmGenerateResult> {
  const config = getLlmConfig()
  if (!config) return { ok: false, reason: 'LLM не настроен (.env).' }
  if (!input.target.id) return { ok: false, reason: 'У целевого слова нет id.' }

  let last: LlmGenerateResult = { ok: false, reason: 'Не удалось сгенерировать.' }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      last = await requestOnce(config, input)
      if (last.ok) return last
    } catch {
      last = { ok: false, reason: 'Сеть/CORS: запрос к OpenRouter не удался.' }
    }
  }
  return last
}
